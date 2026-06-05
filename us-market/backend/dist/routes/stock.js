import axios from 'axios';
import { getStockData, getStockBasic, getStockKLine } from '../services/stockData.js';
import { cache } from '../services/cache.js';
const CHINA_BACKEND = process.env.CHINA_BACKEND_URL || 'http://localhost:3002';
function normalizeMarket(m) {
    if (m === 'cn')
        return 'china';
    return m;
}
export async function stockRoutes(app) {
    // 搜索股票：A股 → 代理到 A股后端（3002），美股 → Finnhub
    app.get('/search', async (req, reply) => {
        // 直接从 raw URL 解析避免 Fastify query 解析中文问题
        const rawUrl = req.raw?.url || req.url;
        const queryPart = rawUrl.includes('?') ? rawUrl.split('?')[1] : '';
        const decoded = decodeURIComponent(queryPart);
        const p = new URLSearchParams(decoded);
        const q = (p.get('q') || '').trim();
        const market = p.get('market') || 'us';
        if (!q)
            return { results: [] };
        // A股搜索 → 代理到 A股后端
        if (market === 'china' || market === 'cn') {
            try {
                console.log('[china search] q:', q);
                const res = await axios.get(`${CHINA_BACKEND}/api/stock/search?q=${encodeURIComponent(q)}`, {
                    headers: { 'User-Agent': 'CEDAR/1.0' },
                    timeout: 10000
                });
                return { query: q, results: res.data.results || [] };
            }
            catch (e) {
                console.error('[search] china proxy failed:', e.message);
                return { query: q, results: [] };
            }
        }
        // 美股搜索 → Finnhub
        try {
            const apiKey = process.env.FINNHUB_API_KEY;
            if (!apiKey)
                return { results: [] };
            const res = await fetch(`https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${apiKey}`);
            if (!res.ok)
                return { results: [] };
            const data = await res.json();
            const results = (data.result || []).slice(0, 8).map((item) => ({
                symbol: item.symbol,
                name: item.description,
                market: item.type || item.exchange || ''
            }));
            return { results };
        }
        catch {
            return { results: [] };
        }
    });
    // 基础信息：优先缓存，缓存失效再从第三方获取
    app.get('/basic/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        const market = normalizeMarket(req.query.market);
        const basic = await getStockBasic(upperSymbol, market);
        if (!basic) {
            return reply.status(404).send({ error: '股票代码不存在', symbol: upperSymbol });
        }
        reply.header('X-Cache', 'HIT');
        return { symbol: upperSymbol, basic };
    });
    // 获取单只股票完整评分
    app.get('/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        const market = normalizeMarket(req.query.market);
        // A股股票 → 代理到 A股后端（3002）
        if (market === 'china') {
            try {
                const urlStr = req.raw?.url || req.url;
                const proxyPath = urlStr.replace(/^\/api\/stock/, '/api/stock');
                const res = await axios.get(`${CHINA_BACKEND}${proxyPath}`, {
                    headers: { 'User-Agent': 'CEDAR/1.0' },
                    timeout: 30000
                });
                return res.data;
            }
            catch (e) {
                console.error('[stock] china proxy failed:', e.message);
                return reply.status(404).send({ error: '股票代码不存在或数据获取失败', symbol: upperSymbol });
            }
        }
        try {
            // getStockData 内部处理缓存 + AI 摘要生成
            const result = await getStockData(upperSymbol, market);
            if (!result) {
                return reply.status(404).send({ error: '股票代码不存在或数据获取失败', symbol: upperSymbol });
            }
            reply.header('X-Cache', 'MISS');
            return { ...result, market };
        }
        catch (err) {
            console.error('Stock API error:', err);
            return reply.status(500).send({ error: '服务器内部错误', message: err.message });
        }
    });
    // 批量获取
    app.post('/batch', async (req, reply) => {
        const { symbols } = req.body;
        if (!symbols?.length || symbols.length > 20) {
            return reply.status(400).send({ error: 'symbols 数量应在 1-20 之间' });
        }
        const results = await Promise.allSettled(symbols.map(s => getStockData(s.toUpperCase())));
        return results.map((r, i) => ({
            symbol: symbols[i],
            ...(r.status === 'fulfilled' ? r.value : { error: '获取失败' })
        }));
    });
    // 清除缓存
    app.delete('/:symbol/cache', async (req, reply) => {
        const { symbol } = req.params;
        const cacheKey = `stock:score:${symbol.toUpperCase()}`;
        const deleted = cache.del(cacheKey);
        return { success: deleted, cacheKey };
    });
    // 均线评估用的K线数据（独立缓存24h）
    app.get('/kline/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        const market = normalizeMarket(req.query.market);
        const kline = await getStockKLine(upperSymbol, 'daily', market);
        if (!kline) {
            return reply.status(404).send({ error: 'K线数据获取失败', symbol: upperSymbol });
        }
        return { symbol: upperSymbol, kline };
    });
    // 支持的股票市场列表
    app.get('/markets', async () => ({
        markets: [
            { code: 'us', name: '大漂亮（美股）', examples: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'] },
            { code: 'china', name: '中国大爱（A股）', examples: ['600519', '000858', '601318', '688981', '002594'] },
        ]
    }));
}
