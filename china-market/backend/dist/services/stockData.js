import axios from 'axios';
import { cache, cacheKeys } from './cache.js';
import { calculateScores } from './scorer.js';
import { generateStockSummary } from './aiSummary.js';
import { getChinaStockBasic, CHINA_STOCKS_MAP } from './chinaStocks.js';
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
    const s = symbol.toUpperCase();
    if (/^(SH|SZ|BJ)\./i.test(symbol))
        return 'china';
    if (/^(sh|sz|688|002|003|300|600|601|603|000|001|002003)/i.test(s))
        return 'china';
    if (/^(HK|港|\d{5})$/i.test(s))
        return 'hk';
    // 拼音缩写或全拼也在A股本地库中 → 判定为A股
    if (getChinaStockBasic(s))
        return 'china';
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
    if (/^300\d{3}$/.test(s))
        return `${s}.SZ`; // 创业板(3开头)
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
// 获取同行股票列表（top 6，按市值降序排列）
async function fetchPeerStockList(symbol, finnhubKey) {
    try {
        // 1. 获取同行列表
        const peersRes = await axios.get(`https://finnhub.io/api/v1/stock/peers`, {
            params: { symbol, token: finnhubKey },
            timeout: 5000
        });
        const peers = peersRes.data?.slice(0, 6) || [];
        if (!peers.length)
            return [];
        // 2. 获取当前股票和所有同行的 metrics（并行）
        const allSymbols = [symbol, ...peers];
        const metricsResults = await Promise.allSettled(allSymbols.map(s => axios.get(`https://finnhub.io/api/v1/stock/metric`, {
            params: { symbol: s, token: finnhubKey, metric: 'all' },
            timeout: 5000
        }).then(r => ({ symbol: s, metric: r.data?.metric || {} }))));
        const validMetrics = metricsResults
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
        // 3. 获取所有股票的 profile（用于股票名称）
        const profileResults = await Promise.allSettled(allSymbols.map(s => axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
            params: { symbol: s, token: finnhubKey },
            timeout: 5000
        }).then(r => ({ symbol: s, name: r.data?.name || s }))));
        const profiles = new Map();
        for (const r of profileResults) {
            if (r.status === 'fulfilled') {
                profiles.set(r.value.symbol, r.value.name);
            }
        }
        // 4. 转换为 peerBenchmarks 格式，按市值降序排列
        const peerList = validMetrics
            .map(({ symbol: s, metric }) => ({
            symbol: s,
            name: profiles.get(s) || s,
            marketCap: (metric.marketCapitalization || 0) * 1_000_000,
            pe: metric.peBasicExclExtraTTM || metric.peTTM || 0,
            roe: metric.roeBasicExclExtraTTMAnn || 0,
            revenueGrowth: metric.revenueGrowthTTMYoy || metric.revenueGrowth5Y || 0,
            profitGrowth: metric.epsGrowthTTMYoy || metric.epsGrowthQuarterlyYoy || 0,
        }))
            .sort((a, b) => b.marketCap - a.marketCap)
            .slice(0, 6);
        return peerList;
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
        if (res.data.code !== 0 || !res.data.data.items?.length) {
            // TuShare 无数据，继续往下走 EM 兜底
        }
        else {
            const [ts_code, sym, name, area, industry, market] = res.data.data.items[0];
            return { symbol: sym, name, market, industry, area };
        }
    }
    catch (e) {
        console.error('TuShare stock_basic error:', e.message);
        // TuShare 异常也继续走 EM 兜底
    }
    // ── TuShare 限速/无数据兜底：从东方财富获取基础信息 ──
    try {
        const emCode = symbol.replace(/\D/g, '').slice(0, 6);
        const isShanghai = /^(600|601|603|688)/.test(emCode);
        const secid = isShanghai ? `1.${emCode}` : `0.${emCode}`;
        const quoteRes = await axios.get('https://push2delay.eastmoney.com/api/qt/stock/get', {
            params: { secid, fields: 'f57,f58' },
            headers: { Referer: 'https://quote.eastmoney.com/' },
            timeout: 10000
        });
        const emData = quoteRes.data?.data;
        if (emData) {
            console.log('[EM fallback basic] success:', emData.f57, emData.f58);
            return {
                symbol: emData.f57 || symbol,
                name: emData.f58 || symbol,
                market: isShanghai ? '沪A' : '深A',
                industry: '未知行业',
                area: '未知地区',
            };
        }
        console.log('[EM fallback basic] no data returned');
    }
    catch (e2) {
        console.error('EM fallback basic error:', e2.message);
    }
    return null;
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
        if (dailyRes.data.code !== 0 || !dailyRes.data.data.items?.length) {
            // TuShare daily 无数据 → 从东方财富兜底
            const emPrice = await fetchEMPrice(symbol);
            if (emPrice)
                return { ...emPrice, history: [] };
            return null;
        }
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
            peg: fundRes.peg || 0,
            marketCap: fundRes.marketCap || 0,
            roe: fundRes.roe || 0,
            revenueGrowth: fundRes.revenueGrowth || 0,
            profitGrowth: fundRes.profitGrowth || 0,
            history: items
        };
    }
    catch (e) {
        console.error('TuShare daily error:', e.message);
        // 异常也尝试 EM 兜底
        const emPrice = await fetchEMPrice(symbol);
        if (emPrice)
            return { ...emPrice, history: [] };
        return null;
    }
}
// ── 东方财富实时行情兜底（用于 TuShare 限速/无数据时）────────────────────
async function fetchEMPrice(symbol) {
    const code = symbol.replace(/\D/g, '').slice(0, 6);
    const isShanghai = /^(600|601|603|688)/.test(code);
    const secid = isShanghai ? `1.${code}` : `0.${code}`;
    try {
        const res = await axios.get('https://push2delay.eastmoney.com/api/qt/stock/get', {
            params: { secid, fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f169,f170,f116,f162,f163' },
            headers: { Referer: 'https://quote.eastmoney.com/' },
            timeout: 10000
        });
        const q = res.data?.data;
        if (!q)
            return null;
        return {
            current: (q.f43 || 0) / 100,
            change: (q.f44 || 0) / 100,
            changePercent: (q.f170 || 0) / 100,
            volume: (q.f47 || 0),
            high: (q.f45 || 0) / 100,
            low: (q.f46 || 0) / 100,
            pe: (q.f162 || 0) / 100,
            pb: (q.f163 || 0) / 100,
            ps: 0,
            peg: 0,
            marketCap: (q.f116 || 0) / 1e8,
            roe: 0,
            revenueGrowth: 0,
            profitGrowth: 0,
            history: [], // 避免 scorer 崩溃
        };
    }
    catch (e) {
        console.error('EM price fallback error:', e.message);
        return null;
    }
}
// 获取 A股 基本面数据（PE/PB/ROE/市值/营收增速/利润增速）
// 优先东方财富（免费），降级 TuShare
async function fetchChinaFundamentals(symbol) {
    const cacheKey = cacheKeys.chinaFund(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    // ── 方案1：东方财富（免费，稳定）───────────────────────
    try {
        const result = await fetchEMFundamentals(symbol);
        if (result.pe > 0 || result.marketCap > 0) {
            cache.set(cacheKey, result, 86400); // 缓存24小时
            return result;
        }
    }
    catch (e) {
        console.error('EM fundamentals error:', e.message);
    }
    // ── 方案2：TuShare fina_indicator ──────────────────────
    try {
        const tsCode = toTsCode(symbol);
        const period = getLastQuarter();
        const res = await axios.post('http://api.tushare.pro', {
            api_name: 'fina_indicator',
            token: TUSHARE_TOKEN,
            params: { ts_code: tsCode, period },
            fields: 'ts_code,pe,pb,ps_ttm,roe,yoy_net_profit,yoy_operate_revenue,yoy_eps'
        }, { timeout: 8000 });
        if (res.data.code === 40203) {
            console.log(`TuShare rate-limited for ${symbol}`);
            return { pe: 0, pb: 0, ps: 0, peg: 0, marketCap: 0, roe: 0, revenueGrowth: 0, profitGrowth: 0 };
        }
        if (res.data.code === 0 && res.data.data.items?.length) {
            const fields = res.data.data.fields;
            const item = res.data.data.items[0];
            const get = (name) => { const i = fields.indexOf(name); return i >= 0 ? item[i] : null; };
            const result = {
                pe: Number(get('pe')) || 0,
                pb: Number(get('pb')) || 0,
                ps: Number(get('ps_ttm')) || 0,
                peg: 0,
                marketCap: 0,
                roe: Number(get('roe')) || 0,
                revenueGrowth: Number(get('yoy_operate_revenue')) || Number(get('yoy_net_profit')) || 0,
                profitGrowth: Number(get('yoy_net_profit')) || Number(get('yoy_eps')) || 0
            };
            cache.set(cacheKey, result, 86400);
            return result;
        }
    }
    catch (e) {
        console.error('TuShare fina_indicator error:', e.message);
    }
    // ── 方案3：TuShare daily_basic（PE/PB/市值）──────────
    try {
        const tsCode = toTsCode(symbol);
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
            const result = {
                pe: Number(get('pe')) || 0,
                pb: Number(get('pb')) || 0,
                ps: Number(get('ps')) || 0,
                peg: 0,
                marketCap: (get('total_mv') || 0) * 10_000,
                roe: 0,
                revenueGrowth: 0,
                profitGrowth: 0
            };
            cache.set(cacheKey, result, 86400);
            return result;
        }
    }
    catch (e) {
        console.error('TuShare daily_basic error:', e.message);
    }
    return { pe: 0, pb: 0, ps: 0, peg: 0, marketCap: 0, roe: 0, revenueGrowth: 0, profitGrowth: 0 };
}
// 东方财富基本面（PE/PB/市值 + ROE/营收增长/利润增长 + PS/PEG）
async function fetchEMFundamentals(symbol) {
    const code = symbol.replace(/\D/g, '').slice(0, 6);
    const isShanghai = /^(600|601|603|688)/.test(code);
    const secid = isShanghai ? `1.${code}` : `0.${code}`;
    const emCode = (isShanghai ? 'SH' : 'SZ') + code;
    // 并行请求：实时行情 + 财务数据
    const [quoteRes, finRes] = await Promise.all([
        axios.get('https://push2delay.eastmoney.com/api/qt/stock/get', {
            params: { secid, fields: 'f57,f58,f43,f162,f163,f167,f168,f116' },
            headers: { Referer: 'https://quote.eastmoney.com/', 'Accept-Encoding': 'gzip, deflate' },
            timeout: 15000
        }),
        axios.get('https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/ZYZBAjaxNew', {
            params: { type: 0, code: emCode },
            headers: { Referer: 'https://emweb.securities.eastmoney.com/', 'Accept-Encoding': 'gzip, deflate' },
            timeout: 8000
        })
    ]);
    const q = quoteRes.data?.data || {};
    const pe = (q.f162 || 0) / 100;
    const pb = (q.f163 || 0) / 100;
    const marketCap = (q.f116 || 0) / 1e8; // 亿元
    // 取年报数据（用于计算 PS）
    const finData = finRes.data?.data || [];
    const annualData = finData.find((d) => d.REPORT_DATE?.includes('12-31')) || finData[0] || {};
    const latest = finData[0] || {};
    // PS = 总市值 / 年营收（亿元）
    const annualRevenue = (annualData.TOTALOPERATEREVE || 0) / 1e8;
    const ps = annualRevenue > 0 ? marketCap / annualRevenue : 0;
    // PEG = PE / 净利润增长率（%，负增长时PEG为负表示高估）
    const profitGrowth = Number(annualData.NETPROFITRPHBZC) || Number(latest.NETPROFITRPHBZC) || 0;
    const peg = (pe > 0 && profitGrowth !== 0) ? pe / profitGrowth : 0;
    return {
        pe: pe || 0,
        pb: pb || 0,
        ps: ps || 0,
        peg: peg || 0,
        marketCap: marketCap || 0,
        roe: Number(annualData.ROEJQ) || Number(latest.ROEJQ) || 0, // 年报 ROE 更准确
        revenueGrowth: Number(annualData.YYZSRGDHBZC) || Number(latest.YYZSRGDHBZC) || 0, // 年营收增长
        profitGrowth: profitGrowth // 年利润增长
    };
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
        if (res.data.code === 0 && res.data.data.items?.length) {
            const data = res.data.data.items.map(([date, open, high, low, close, vol]) => ({
                date, open, high, low, close, volume: vol
            })).reverse();
            return {
                data,
                ma: calculateMA(data)
            };
        }
        // TuShare 无数据 → 东方财富 K 线兜底
        return await fetchEMKLine(symbol);
    }
    catch (e) {
        console.error('TuShare kline error:', e.message);
        return await fetchEMKLine(symbol);
    }
}
// ── 东方财富 K 线兜底 ─────────────────────────────────────────────
async function fetchEMKLine(symbol) {
    const code = symbol.replace(/\D/g, '').slice(0, 6);
    const isShanghai = /^(600|601|603|688)/.test(code);
    const secid = isShanghai ? `1.${code}` : `0.${code}`;
    try {
        const res = await axios.get('https://push2delay.eastmoney.com/api/qt/stock/kline/get', {
            params: {
                secid,
                fields1: 'f1,f2,f3,f4,f5,f6',
                fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
                klt: 101, // 日线
                fqt: 1, // 前复权
                beg: getDateNDaysAgo(365),
                end: getTodayDate(),
                lmt: 250
            },
            headers: { Referer: 'https://quote.eastmoney.com/' },
            timeout: 10000
        });
        const klines = res.data?.data?.klines || [];
        if (!klines.length)
            return null;
        const data = klines.map(l => {
            const [date, open, close, high, low, vol] = l.split(',');
            return {
                date: date.replace(/-/g, ''),
                open: parseFloat(open),
                close: parseFloat(close),
                high: parseFloat(high),
                low: parseFloat(low),
                volume: parseFloat(vol)
            };
        });
        return { data, ma: calculateMA(data) };
    }
    catch (e) {
        console.error('EM kline fallback error:', e.message);
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
    // 补充同行对比数据
    let peerData = [];
    const isChinaStock = /^(sh|sz|688|002|003|600|601|603|000|001)/i.test(symbol);
    if (!isChinaStock) {
        // 非A股：走 Finnhub
        peerData = await fetchPeerStockList(symbol, FINNHUB_KEY);
    }
    if (peerData.length === 0) {
        // 无数据 → 从 CHINA_STOCKS_MAP 找同行业股票作兜底
        const basicInfo = CHINA_STOCKS_MAP[symbol.replace(/\D/g, '').slice(0, 6)];
        if (basicInfo) {
            peerData = Object.entries(CHINA_STOCKS_MAP)
                .filter(([code, info]) => info.industry === basicInfo.industry && code !== symbol.replace(/\D/g, '').slice(0, 6))
                .map(([code, info]) => ({
                symbol: code,
                name: info.name,
                marketCap: 0, pe: 0, roe: 0, revenueGrowth: 0, profitGrowth: 0
            }));
        }
        if (peerData.length > 0) {
            // 从东方财富补充同行 PE
            const peerCodes = peerData.map(p => {
                const num = p.symbol.replace(/\D/g, '').slice(0, 6);
                return /^(600|601|603|688)/.test(num) ? `1.${num}` : `0.${num}`;
            });
            const quoteRes = await axios.get('https://push2delay.eastmoney.com/api/qt/ulist.np/get', {
                params: { secids: peerCodes.join(','), fields: 'f57,f58,f162' },
                headers: { Referer: 'https://quote.eastmoney.com/' },
                timeout: 10000
            }).catch(() => ({ data: null }));
            if (quoteRes.data?.data?.diff) {
                for (let i = 0; i < peerData.length; i++) {
                    const item = quoteRes.data.data.diff[i];
                    if (item?.f57 > 0)
                        peerData[i].pe = Math.round(item.f57 * 10) / 10;
                }
            }
        }
    }
    else {
        // Finnhub 有数据 → 从东方财富补充同行 PE
        const peerCodes = peerData.map(p => {
            const num = p.symbol.replace(/\D/g, '').slice(0, 6);
            return /^(600|601|603|688)/.test(num) ? `1.${num}` : `0.${num}`;
        });
        const quoteRes = await axios.get('https://push2delay.eastmoney.com/api/qt/ulist.np/get', {
            params: { secids: peerCodes.join(','), fields: 'f57,f58,f162' },
            headers: { Referer: 'https://quote.eastmoney.com/' },
            timeout: 10000
        }).catch(() => ({ data: null }));
        if (quoteRes.data?.data?.diff) {
            for (let i = 0; i < peerData.length; i++) {
                const item = quoteRes.data.data.diff[i];
                if (item?.f57 > 0)
                    peerData[i].pe = Math.round(item.f57 * 10) / 10;
            }
        }
    }
    scoreResult.peerBenchmarks = peerData.slice(0, 6);
    // 生成 AI 摘要 (异步，不阻塞返回)
    generateStockSummary(scoreResult.symbol, scoreResult.name, scoreResult.cedarScore, scoreResult.cedarLevel, scoreResult.trackScore, scoreResult.growthScore, scoreResult.valuationScore, scoreResult.riskScore, scoreResult.marketTemp, scoreResult.price, scoreResult.industry, scoreResult.industryTrack, scoreResult.maEvaluation, scoreResult.chinaUsMapping).then(summaries => {
        scoreResult.summary = summaries;
        const cacheKey = `stock:score:${symbol.toUpperCase()}`;
        cache.set(cacheKey, scoreResult, 3600);
    }).catch(err => {
        console.error('AI summary generation failed:', err);
    });
    // 缓存结果 (1小时，不含AI摘要，首次有摘要后更新)
    const cacheKey = `stock:score:${symbol.toUpperCase()}`;
    cache.set(cacheKey, scoreResult, 3600);
    return scoreResult;
}
