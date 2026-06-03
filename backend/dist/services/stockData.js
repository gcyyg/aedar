import axios from 'axios';
import { cache, cacheKeys } from './cache.js';
import { calculateScores } from './scorer.js';
import { generateStockSummary } from './aiSummary.js';
import { getChinaStockBasic } from './chinaStocks.js';
// API 配置
const TUSHARE_TOKEN = '51fbaa947c34a4caa000e1323fa20153f93a34b1fea1f6b98196e59e';
const FINNHUB_KEY = 'd8fo3d9r01qn443auhngd8fo3d9r01qn443auho0';
const ALPHA_VANTAGE_KEY = 'G8IYR0VLFJNTZHDS';
// 判断股票类型 (A股/港股/美股)
export function getStockMarket(symbol) {
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
export async function getStockBasic(symbol) {
    const cacheKey = cacheKeys.stockBasic(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const market = getStockMarket(symbol);
    if (market === 'china') {
        return await fetchChinaStock(symbol);
    }
    else if (market === 'us') {
        return await fetchUsStock(symbol);
    }
    return null;
}
// 获取股票价格
export async function getStockPrice(symbol) {
    const cacheKey = cacheKeys.stockPrice(symbol);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const market = getStockMarket(symbol);
    if (market === 'china') {
        return await fetchChinaPrice(symbol);
    }
    else if (market === 'us') {
        return await fetchUsPrice(symbol);
    }
    return null;
}
// 获取 K 线数据
export async function getStockKLine(symbol, period = 'daily') {
    const cacheKey = cacheKeys.stockKLine(symbol, period);
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const market = getStockMarket(symbol);
    if (market === 'china') {
        return await fetchChinaKLine(symbol, period);
    }
    else if (market === 'us') {
        return await fetchUsKLine(symbol, period);
    }
    return null;
}
// ===== A股数据源 =====
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
        const res = await axios.post('http://api.tushare.pro', {
            api_name: 'daily',
            token: TUSHARE_TOKEN,
            params: { ts_code: tsCode, start_date: getDateNDaysAgo(7), end_date: getTodayDate() },
            fields: 'ts_code,trade_date,open,high,low,close,vol,amount'
        });
        if (res.data.code !== 0 || !res.data.data.items?.length)
            return null;
        const items = res.data.data.items.map(([ts_code, trade_date, open, high, low, close, vol, amount]) => ({
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
            pe: 0, // 需要单独的 API
            pb: 0,
            marketCap: 0,
            history: items
        };
    }
    catch (e) {
        console.error('TuShare daily error:', e.message);
        return null;
    }
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
    try {
        const res = await axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
            params: { symbol, token: FINNHUB_KEY }
        });
        if (!res.data?.name)
            return null;
        return {
            symbol: res.data.ticker,
            name: res.data.name,
            market: 'US',
            industry: res.data.finnhubIndustry || 'Unknown',
            area: res.data.country || 'US'
        };
    }
    catch (e) {
        console.error('Finnhub profile error:', e.message);
        return null;
    }
}
async function fetchUsPrice(symbol) {
    try {
        // Finnhub quote
        const [quoteRes, metricRes] = await Promise.all([
            axios.get(`https://finnhub.io/api/v1/quote`, {
                params: { symbol, token: FINNHUB_KEY }
            }),
            axios.get(`https://finnhub.io/api/v1/stock/metric`, {
                params: { symbol, token: FINNHUB_KEY, metric: 'all' }
            })
        ]);
        const q = quoteRes.data;
        if (!q.c)
            return null;
        const metrics = metricRes.data?.metric || {};
        return {
            current: q.c,
            change: q.d,
            changePercent: q.dp,
            volume: metrics['vol10dAvg'] || 0,
            high: q.h,
            low: q.l,
            pe: metrics.peBasicExclExtraTTM || 0,
            pb: metrics.pbWeekly || 0,
            marketCap: metrics.marketCapitalizationAin || 0,
            history: []
        };
    }
    catch (e) {
        console.error('Finnhub quote error:', e.message);
        return null;
    }
}
async function fetchUsKLine(symbol, period) {
    try {
        // 使用 Finnhub 的技术指标
        const resolution = period === 'daily' ? 'D' : period === 'weekly' ? 'W' : 'M';
        const res = await axios.get(`https://finnhub.io/api/v1/stock/candle`, {
            params: {
                symbol,
                resolution,
                from: Math.floor(Date.now() / 1000 - 365 * 24 * 3600),
                to: Math.floor(Date.now() / 1000),
                token: FINNHUB_KEY
            }
        });
        if (res.data.s !== 'ok' || !res.data.t?.length)
            return null;
        const data = res.data.t.map((t, i) => ({
            date: new Date(t * 1000).toISOString().split('T')[0],
            open: res.data.o[i],
            high: res.data.h[i],
            low: res.data.l[i],
            close: res.data.c[i],
            volume: res.data.v[i]
        }));
        return { data, ma: calculateMA(data) };
    }
    catch (e) {
        console.error('Finnhub candle error:', e.message);
        return null;
    }
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
export async function getStockData(symbol) {
    const [basic, price, kline] = await Promise.all([
        getStockBasic(symbol),
        getStockPrice(symbol),
        getStockKLine(symbol)
    ]);
    if (!basic || !price)
        return null;
    const stockData = { basic, price, kline, risk: null };
    const scoreResult = calculateScores(stockData);
    // 生成 AI 摘要 (同步等待，确保首次返回完整数据)
    try {
        const summary = await generateStockSummary(scoreResult.symbol, scoreResult.name, scoreResult.cedarScore, scoreResult.cedarLevel, scoreResult.trackScore, scoreResult.growthScore, scoreResult.valuationScore, scoreResult.riskScore, scoreResult.marketTemp, scoreResult.price, scoreResult.industry, scoreResult.maEvaluation);
        scoreResult.summary = summary;
    }
    catch (err) {
        console.error('AI summary generation failed:', err);
    }
    // 缓存结果 (1小时)
    const cacheKey = `stock:score:${symbol.toUpperCase()}`;
    cache.set(cacheKey, scoreResult, 3600);
    return scoreResult;
}
