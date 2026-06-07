import axios from 'axios';
import { cache, cacheKeys } from './cache.js';
import { calculateScores } from './scorer.js';
import { generateStockSummary, generateFallbackSummaries } from './aiSummary.js';
import { getChinaStockBasic } from './chinaStocks.js';
// API 配置
const TUSHARE_TOKEN = '51fbaa947c34a4caa000e1323fa20153f93a34b1fea1f6b98196e59e';
const FINNHUB_KEY = 'd8fo3d9r01qn443auhngd8fo3d9r01qn443auho0';
const ALPHA_VANTAGE_KEY = 'G8IYR0VLFJNTZHDS';
// 判断股票类型 (A股/港股/美股)，可被 market 参数覆盖
export function getStockMarket(symbol, forced) {
    if (forced === 'us')
        return 'us';
    if (forced === 'china')
        return 'china';
    if (/^(sh|sz|688|002|003|600|601|603|000|001|002003)/i.test(symbol))
        return 'china';
    if (/^(hk|港|\d{5})$/i.test(symbol))
        return 'hk';
    return 'us';
}
// 用户输入的代码 → TuShare ts_code 格式
function toTsCode(symbol) {
    const s = symbol.toUpperCase().replace(/\.(SH|SZ|BJ)/i, '');
    if (/^6\d{5}$/.test(s))
        return `${s}.SH`; // 上交所
    if (/^(000|001|002|003)\d{3}$/.test(s))
        return `${s}.SZ`; // 深交所
    if (/^688\d{3}$/.test(s))
        return `${s}.SH`; // 科创板
    if (/^430\d{3}$/.test(s))
        return `${s}.BJ`; // 北交所
    return `${s}.SH`; // 默认上交所
}
// 获取股票基本信息
export async function getStockBasic(symbol, forcedMarket) {
    const cacheKey = cacheKeys.stockBasic(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const market = getStockMarket(symbol, forcedMarket);
    if (market === 'china') {
        return await fetchChinaStock(symbol);
    }
    else if (market === 'us') {
        return await fetchUsStock(symbol);
    }
    return null;
}
// 获取股票价格
export async function getStockPrice(symbol, forcedMarket) {
    const cacheKey = cacheKeys.stockPrice(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const market = getStockMarket(symbol, forcedMarket);
    if (market === 'china') {
        return await fetchChinaPrice(symbol);
    }
    else if (market === 'us') {
        return await fetchUsPrice(symbol);
    }
    return null;
}
// 获取 K 线数据
export async function getStockKLine(symbol, period = 'daily', forcedMarket) {
    const cacheKey = cacheKeys.stockKLine(symbol, period);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const market = getStockMarket(symbol, forcedMarket);
    if (market === 'china') {
        return await fetchChinaKLine(symbol, period);
    }
    else if (market === 'us') {
        return await fetchUsKLine(symbol, period);
    }
    return null;
}
// ===== A股数据源 =====
async function fetchPeerBenchmarks(symbol) {
    try {
        const peersRes = await axios.get(`https://finnhub.io/api/v1/stock/peers`, {
            params: { symbol, token: FINNHUB_KEY },
            timeout: 5000
        });
        const peers = peersRes.data?.slice(0, 6) || [];
        if (!peers.length)
            return {};
        const peerMetricsRaw = await Promise.allSettled(peers.slice(0, 5).map(s => axios.get(`https://finnhub.io/api/v1/stock/metric`, {
            params: { symbol: s, token: FINNHUB_KEY, metric: 'all' },
            timeout: 5000
        }).then(r => r.data?.metric || {})));
        const collect = (key) => peerMetricsRaw
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value[key])
            .filter(v => v != null && v > 0);
        const median = (arr) => {
            if (!arr.length)
                return 0;
            const s = [...arr].sort((a, b) => a - b);
            return s[Math.floor(s.length / 2)];
        };
        const myMetrics = await axios.get(`https://finnhub.io/api/v1/stock/metric`, {
            params: { symbol, token: FINNHUB_KEY, metric: 'all' },
            timeout: 5000
        }).then(r => r.data?.metric || {});
        const peMed = median(collect('peTTM'));
        const pbMed = median(collect('pb'));
        const psMed = median(collect('psTTM'));
        const pegMed = median(collect('pegTTM'));
        const compare = (myVal, med) => {
            if (!myVal || !med)
                return null;
            if (myVal < med * 0.85)
                return 'low';
            if (myVal > med * 1.15)
                return 'high';
            return 'medium';
        };
        return {
            pe: compare(myMetrics['peTTM'] || myMetrics['peBasicExclExtraTTM'] || 0, peMed),
            pb: compare(myMetrics['pb'] || 0, pbMed),
            ps: compare(myMetrics['psTTM'] || 0, psMed),
            peg: compare(myMetrics['pegTTM'] || myMetrics['forwardPEG'] || 0, pegMed),
        };
    }
    catch {
        return {};
    }
}
// 获取同行股票列表（用于同行对比卡片）
async function fetchPeerList(symbol) {
    try {
        // 1. 获取同行代码列表
        const peersRes = await axios.get(`https://finnhub.io/api/v1/stock/peers`, {
            params: { symbol, token: FINNHUB_KEY },
            timeout: 5000
        });
        const peers = peersRes.data?.slice(0, 6) || [];
        if (!peers.length)
            return [];
        // 2. 并行获取每个同行的 profile + metrics
        const peerRaw = await Promise.allSettled(peers.slice(0, 6).map(async (s) => {
            const [profileRes, metricRes] = await Promise.all([
                axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
                    params: { symbol: s, token: FINNHUB_KEY },
                    timeout: 5000
                }),
                axios.get(`https://finnhub.io/api/v1/stock/metric`, {
                    params: { symbol: s, token: FINNHUB_KEY, metric: 'all' },
                    timeout: 5000
                })
            ]);
            const m = metricRes.data?.metric || {};
            return {
                symbol: s,
                name: profileRes.data?.name || s,
                marketCap: (m.marketCapitalization || 0) * 1_000_000,
                pe: m.peBasicExclExtraTTM || m.peTTM || 0,
                roe: m.roeBasicExclExtraTTMAnn || 0,
                revenueGrowth: m.revenueGrowthTTMYoy || m.revenueGrowth5Y || 0,
                profitGrowth: m.epsGrowthTTMYoy || m.epsGrowthQuarterlyYoy || 0,
            };
        }));
        const valid = peerRaw
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value)
            .filter(p => p.marketCap > 0);
        // 按市值降序
        return valid.sort((a, b) => b.marketCap - a.marketCap).slice(0, 6);
    }
    catch {
        return [];
    }
}
async function fetchChinaStock(symbol) {
    // 优先使用本地缓存（无 API 调用）
    const local = getChinaStockBasic(symbol);
    if (local)
        return local;
    // 本地没有则查 TuShare（注意：stock_basic 限速 1次/小时）
    try {
        const tsCode = toTsCode(symbol);
        const res = await axios.post('http://api.tushare.pro', {
            api_name: 'stock_basic',
            token: TUSHARE_TOKEN,
            params: { ts_code: tsCode, list_status: 'L' },
            fields: 'ts_code,symbol,name,area,industry,market,list_date,enname,cnspell'
        });
        if (res.data.code !== 0 || !res.data.data.items?.length)
            return null;
        const [ts_code, sym, name, area, industry, market] = res.data.data.items[0];
        return { symbol: sym, name, market, industry, area };
    }
    catch (e) {
        console.error('TuShare stock_basic error:', e.message);
        return null;
    }
}
async function fetchChinaPrice(symbol) {
    try {
        const tsCode = toTsCode(symbol);
        const [dailyRes, fundRes] = await Promise.all([
            axios.post('http://api.tushare.pro', {
                api_name: 'daily',
                token: TUSHARE_TOKEN,
                params: { ts_code: tsCode, start_date: getDateNDaysAgo(7), end_date: getTodayDate() },
                fields: 'ts_code,trade_date,open,high,low,close,vol,amount'
            }),
            // 获取 A股 基本面数据（PE/PB/ROE等）
            fetchChinaFundamentals(symbol)
        ]);
        if (dailyRes.data.code !== 0 || !dailyRes.data.data.items?.length)
            return null;
        const items = dailyRes.data.data.items.map(([ts_code, trade_date, open, high, low, close, vol, amount]) => ({
            date: trade_date,
            open, high, low, close, volume: vol, amount
        })).reverse();
        const latest = items[items.length - 1];
        const prev = items[items.length - 2] || latest;
        return {
            current: latest.close,
            change: latest.close - prev.close,
            changePercent: ((latest.close - prev.close) / prev.close) * 100,
            volume: latest.volume,
            high: latest.high,
            low: latest.low,
            pe: fundRes.pe || 0,
            pb: fundRes.pb || 0,
            ps: fundRes.ps || 0,
            peg: 0,
            marketCap: fundRes.marketCap || 0,
            roe: fundRes.roe || 0,
            revenueGrowth: fundRes.revenueGrowth || 0,
            profitGrowth: fundRes.profitGrowth || 0,
            history: items
        };
    }
    catch (e) {
        console.error('TuShare daily error:', e.message);
        return null;
    }
}
// 获取 A股 基本面数据（PE/PB/ROE/市值/营收增速/利润增速）
// 注意：fina_indicator 限速 1次/分钟，需要缓存 + 降级处理
async function fetchChinaFundamentals(symbol) {
    const cacheKey = cacheKeys.chinaFund(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const tsCode = toTsCode(symbol);
    // ── 方案1：fina_indicator（财务指标）───────────────────────
    try {
        const period = getLastQuarter();
        const res = await axios.post('http://api.tushare.pro', {
            api_name: 'fina_indicator',
            token: TUSHARE_TOKEN,
            params: { ts_code: tsCode, period },
            fields: 'ts_code,pe,pb,ps_ttm,roe,yoy_net_profit,yoy_operate_revenue,yoy_eps'
        }, { timeout: 8000 });
        if (res.data.code === 40203) {
            // 限速中，记录并返回空数据（下次请求缓存命中）
            console.log(`TuShare fina_indicator rate-limited for ${symbol}, will retry later`);
            return { pe: 0, pb: 0, ps: 0, marketCap: 0, roe: 0, revenueGrowth: 0, profitGrowth: 0 };
        }
        if (res.data.code === 0 && res.data.data.items?.length) {
            const fields = res.data.data.fields;
            const item = res.data.data.items[0];
            const get = (name) => { const i = fields.indexOf(name); return i >= 0 ? item[i] : null; };
            const result = {
                pe: Number(get('pe')) || 0,
                pb: Number(get('pb')) || 0,
                ps: Number(get('ps_ttm')) || 0,
                marketCap: 0,
                roe: Number(get('roe')) || 0,
                revenueGrowth: Number(get('yoy_operate_revenue')) || Number(get('yoy_net_profit')) || 0,
                profitGrowth: Number(get('yoy_net_profit')) || Number(get('yoy_eps')) || 0
            };
            cache.set(cacheKey, result, 86400); // 缓存24小时
            return result;
        }
    }
    catch (e) {
        console.error('TuShare fina_indicator error:', e.message);
    }
    // ── 方案2：daily_basic（PE/PB/市值等）────────────────────
    try {
        const res = await axios.post('http://api.tushare.pro', {
            api_name: 'daily_basic',
            token: TUSHARE_TOKEN,
            params: { ts_code: tsCode, trade_date: getTodayDate() },
            fields: 'ts_code,pe,pb,ps,total_mv,circ_mv'
        }, { timeout: 8000 });
        if (res.data.code === 0 && res.data.data.items?.length) {
            const fields = res.data.data.fields;
            const item = res.data.data.items[0];
            const get = (name) => { const i = fields.indexOf(name); return i >= 0 ? item[i] : null; };
            const marketCap = (get('total_mv') || 0) * 10_000;
            const result = {
                pe: Number(get('pe')) || 0,
                pb: Number(get('pb')) || 0,
                ps: Number(get('ps')) || 0,
                marketCap,
                roe: 0, // daily_basic 不含 ROE
                revenueGrowth: 0,
                profitGrowth: 0
            };
            cache.set(cacheKey, result, 86400); // 缓存24小时
            return result;
        }
    }
    catch (e) {
        console.error('TuShare daily_basic error:', e.message);
    }
    return { pe: 0, pb: 0, ps: 0, marketCap: 0, roe: 0, revenueGrowth: 0, profitGrowth: 0 };
}
// 获取最近季度（格式：YYYYMMDD，取上一季度末）
function getLastQuarter() {
    const now = new Date();
    let m = now.getMonth();
    let y = now.getFullYear();
    // 上季度末：3月=0331, 6月=0630, 9月=0930, 12月=1231
    let month = '';
    if (m < 3) {
        month = '1231';
        y--;
    }
    else if (m < 6) {
        month = '0331';
    }
    else if (m < 9) {
        month = '0630';
    }
    else {
        month = '0930';
    }
    return `${y}${month}`;
}
async function fetchChinaKLine(symbol, period) {
    try {
        const apiMap = {
            daily: 'daily',
            weekly: 'weekly',
            monthly: 'monthly'
        };
        const res = await axios.post('http://api.tushare.pro', {
            api_name: apiMap[period] || 'daily',
            token: TUSHARE_TOKEN,
            params: { ts_code: toTsCode(symbol), start_date: getDateNDaysAgo(365) },
            fields: 'trade_date,open,high,low,close,vol'
        });
        if (res.data.code !== 0 || !res.data.data.items?.length)
            return null;
        const data = res.data.data.items.map(([date, open, high, low, close, vol]) => ({
            date, open, high, low, close, volume: vol
        })).reverse();
        return {
            data,
            ma: calculateMA(data)
        };
    }
    catch (e) {
        console.error('TuShare kline error:', e.message);
        return null;
    }
}
// ===== 美股数据源 =====
async function fetchUsStock(symbol) {
    const cacheKey = cacheKeys.usStockBasic(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    try {
        const res = await axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
            params: { symbol, token: FINNHUB_KEY }
        });
        if (!res.data?.name)
            return null;
        const result = {
            symbol: res.data.ticker,
            name: res.data.name,
            market: 'US',
            industry: res.data.finnhubIndustry || 'Unknown',
            area: res.data.country || 'US'
        };
        cache.set(cacheKey, result, 86400);
        return result;
    }
    catch (e) {
        console.error('Finnhub profile error:', e.message);
        return null;
    }
}
async function fetchUsPrice(symbol) {
    const cacheKey = cacheKeys.usStockPrice(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    try {
        // Finnhub quote + metrics + analyst recommendation + peer benchmarks (并行请求)
        const [quoteRes, metricRes, recRes, benchmarks] = await Promise.all([
            axios.get(`https://finnhub.io/api/v1/quote`, {
                params: { symbol, token: FINNHUB_KEY }
            }),
            axios.get(`https://finnhub.io/api/v1/stock/metric`, {
                params: { symbol, token: FINNHUB_KEY, metric: 'all' }
            }),
            axios.get(`https://finnhub.io/api/v1/stock/recommendation`, {
                params: { symbol, token: FINNHUB_KEY }
            }),
            fetchPeerBenchmarks(symbol),
        ]);
        const q = quoteRes.data;
        if (!q.c)
            return null;
        const metrics = metricRes.data?.metric || {};
        const rec = recRes.data?.[0] || {};
        // Finnhub 实际字段名
        const mcap = metrics.marketCapitalization; // 市值（百万）
        const pbVal = metrics.pb; // 市净率
        const psVal = metrics.psRatioTTM || metrics.evRevenueTTM; // 市销率
        const pegVal = metrics.pegTTM || metrics.forwardPEG; // PEG
        const roeVal = metrics.roeBasicExclExtraTTMAnn || (metrics.netProfitMarginAnnual && metrics.assetTurnoverAnnual ?
            (metrics.netProfitMarginAnnual * metrics.assetTurnoverAnnual / 10) : null); // ROE
        const revGrowth = metrics.revenueGrowthTTMYoy || metrics.revenueGrowth5Y;
        const profitGrowth = metrics.epsGrowthTTMYoy || metrics.epsGrowthQuarterlyYoy;
        // 分析师数据
        const totalAnalysts = rec.buy + rec.hold + rec.sell + rec.strongBuy + rec.strongSell;
        const ratingStr = rec.strongBuy > rec.buy + rec.hold ? '强烈买入' :
            rec.strongBuy + rec.buy > rec.hold + rec.sell ? '买入' :
                rec.hold > rec.strongBuy + rec.buy ? '持有' : '中性';
        const result = {
            current: q.c,
            change: q.d,
            changePercent: q.dp,
            volume: metrics['vol10dAvg'] || 0,
            high: q.h,
            low: q.l,
            pe: metrics.peBasicExclExtraTTM || metrics.peTTM || 0,
            pb: pbVal || 0,
            ps: psVal || 0,
            peg: pegVal || 0,
            marketCap: mcap ? mcap * 1_000_000 : 0, // 转为完整数值
            roe: roeVal || 0,
            revenueGrowth: revGrowth || 0,
            profitGrowth: profitGrowth || 0,
            history: [],
            high52: metrics['52WeekHigh'] || 0,
            low52: metrics['52WeekLow'] || 0,
            analyst: { rating: ratingStr, totalAnalysts, targetPrice: 0 },
            revenueGrowthCagr: metrics.revenueGrowth3Y ?? 0, // 近3年CAGR作近似
            profitGrowthCagr: metrics.epsGrowth3Y ?? 0,
            benchmarks,
        };
        cache.set(cacheKey, result, 86400);
        return result;
    }
    catch (e) {
        console.error('Finnhub quote error:', e.message);
        return null;
    }
}
async function fetchUsKLine(symbol, period) {
    const cacheKey = cacheKeys.usKLine(symbol, period);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    // console.log(`[fetchUsKLine] calling AlphaVantage for ${symbol}`)
    try {
        const res = await axios.get(`https://www.alphavantage.co/query`, {
            params: {
                function: 'TIME_SERIES_DAILY',
                symbol,
                outputsize: 'compact', // 免费版仅支持 compact（100条）
                apikey: 'G8IYR0VLFJNTZHDS'
            },
            timeout: 8000
        });
        const info = res.data['Information'];
        if (info) {
            console.log(`AlphaVantage limit: ${info} — falling through to TwelveData`);
            // 不 return null，继续尝试 TwelveData
        }
        const timeSeries = res.data['Time Series (Daily)'];
        if (timeSeries) {
            const entries = Object.entries(timeSeries);
            console.log(`AlphaV entries count: ${entries.length}`);
            if (entries.length > 0) {
                const data = entries.map(([date, vals]) => ({
                    date,
                    open: parseFloat(vals['1. open']),
                    high: parseFloat(vals['2. high']),
                    low: parseFloat(vals['3. low']),
                    close: parseFloat(vals['4. close']),
                    volume: parseInt(vals['5. volume'])
                }));
                // 按日期升序排列
                data.sort((a, b) => a.date.localeCompare(b.date));
                const result = { data, ma: calculateMA(data) };
                cache.set(cacheKey, result, 86400);
                return result;
            }
        }
    }
    catch (e) {
        // AlphaVantage 超时/限流不算致命错误，继续尝试 TwelveData
        console.error('AlphaVantage kline error (falling through):', e.message);
    }
    // ── 方案二：TwelveData 历史K线（免费 800 credits/天 ≈ 100条/天）───
    try {
        const res = await axios.get('https://api.twelvedata.com/time_series', {
            params: {
                symbol,
                interval: '1day',
                outputsize: 100, // 免费层限制
                apikey: '068cc5a843614ac9a1b2a74e6324dbab',
                format: 'JSON',
                timezone: 'Asia/Shanghai'
            },
            timeout: 8000
        });
        const values = res.data?.values;
        if (values?.length) {
            console.log(`TwelveData entries: ${values.length}`);
            const data = values.map(v => ({
                date: v.datetime,
                open: parseFloat(v.open),
                high: parseFloat(v.high),
                low: parseFloat(v.low),
                close: parseFloat(v.close),
                volume: parseInt(v.volume)
            }));
            // TwelveData 返回倒序，取最新100天
            data.reverse();
            const result = { data, ma: calculateMA(data) };
            cache.set(cacheKey, result, 86400);
            return result;
        }
    }
    catch (e) {
        console.error('TwelveData kline error:', e.message);
    }
    // ── 方案三：yfinance（腾讯云IP已被封，仅作本地开发参考）───────────
    // try {
    //   const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
    //     params: { interval: '1d', range: '2y' },
    //     timeout: 8000
    //   })
    //   const chart = res.data?.chart?.result?.[0]
    //   if (chart) {
    //     const timestamps = chart.timestamp as number[]
    //     const quotes = chart.indicators?.quote?.[0]
    //     const volumes = chart.indicators?.quote?.[0]?.volume || []
    //     if (timestamps?.length) {
    //       const data = timestamps.map((t: number, i: number) => ({
    //         date: new Date(t * 1000).toISOString().split('T')[0],
    //         open: quotes.open[i],
    //         high: quotes.high[i],
    //         low: quotes.low[i],
    //         close: quotes.close[i],
    //         volume: volumes[i] || 0
    //       })).filter((d: any) => d.close != null)
    //       const result = { data, ma: calculateMA(data) }
    //       cache.set(cacheKey, result, 86400)
    //       return result
    //     }
    //   }
    // } catch (e: any) {
    //   console.error('yfinance kline error:', e.message)
    // }
    return null;
}
// ===== 工具函数 =====
function calculateMA(data) {
    const closes = data.map(d => d.close);
    return {
        ma30: calculateSingleMA(closes, 30),
        ma60: calculateSingleMA(closes, 60),
        ma120: calculateSingleMA(closes, 120),
        ma240: calculateSingleMA(closes, 240)
    };
}
function calculateSingleMA(prices, period) {
    const result = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            result.push(prices[i]);
        }
        else {
            const slice = prices.slice(i - period + 1, i + 1);
            result.push(slice.reduce((a, b) => a + b, 0) / period);
        }
    }
    return result;
}
function getTodayDate() {
    return new Date().toISOString().split('T')[0].replace(/-/g, '');
}
function getDateNDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0].replace(/-/g, '');
}
// ===== 主入口：获取完整股票数据 + 评分 =====
export async function getStockData(symbol, forcedMarket) {
    const [basic, price, kline] = await Promise.all([
        getStockBasic(symbol, forcedMarket),
        getStockPrice(symbol, forcedMarket),
        getStockKLine(symbol, 'daily', forcedMarket)
    ]);
    if (!basic || !price)
        return null;
    const stockData = { basic, price, kline, risk: null };
    const scoreResult = calculateScores(stockData);
    // 同行对比数据（同步等待，确保首次返回即包含）
    let peerData = [];
    try {
        peerData = await fetchPeerList(symbol);
    }
    catch (e) {
        console.error("[peer] fetch failed:", e);
    }
    scoreResult.peerBenchmarks = peerData;
    // 生成 AI 摘要（同步，等待完成再返回，超时用fallback）
    try {
        scoreResult.summary = await Promise.race([
            generateStockSummary(scoreResult.symbol, scoreResult.name, scoreResult.cedarScore, scoreResult.cedarLevel, scoreResult.trackScore, scoreResult.growthScore, scoreResult.valuationScore, scoreResult.riskScore, scoreResult.marketTemp, scoreResult.price, scoreResult.industry, scoreResult.industryTrack, scoreResult.maEvaluation, scoreResult.chinaUsMapping),
            new Promise(resolve => setTimeout(() => {
                resolve(generateFallbackSummaries(scoreResult.symbol, scoreResult.name, scoreResult.cedarScore, scoreResult.cedarLevel, scoreResult.trackScore, scoreResult.growthScore, scoreResult.valuationScore, scoreResult.riskScore, scoreResult.marketTemp, scoreResult.price, scoreResult.industry, scoreResult.industryTrack, scoreResult.maEvaluation, scoreResult.chinaUsMapping));
            }, 8000))
        ]);
    }
    catch (err) {
        console.error("AI summary failed:", err);
        scoreResult.summary = [];
    }
    cache.set(`stock:score:${symbol.toUpperCase()}`, scoreResult, 3600);
    return scoreResult;
}
