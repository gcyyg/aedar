import { getStockData, getStockKLine, getStockBasic, getStockPrice } from '../services/stockData.js';
// 新浪搜索 API - 替换东方财富（服务器无法访问 eastmoney searchapi）
const SINA_SEARCH_API = 'https://suggest3.sinajs.cn/suggest/type=&key=';
async function sinaSearch(keyword) {
    const { exec } = await import('child_process');
    const apiUrl = `${SINA_SEARCH_API}${encodeURIComponent(keyword)}`;
    // 新浪返回GBK编码，需要转换
    const curlCmd = `curl -s --max-time 10 "${apiUrl}" -H "Referer: https://finance.sina.com.cn" | iconv -f GBK -t UTF-8`;
    try {
        const raw = await new Promise((resolve, reject) => {
            exec(curlCmd, { timeout: 15000 }, (err, stdout) => {
                if (err)
                    reject(err);
                else
                    resolve(stdout);
            });
        });
        // 新浪返回格式: var suggestvalue="name,11,code,market_code,name,...;..."
        // type=11 是 A股股票
        const match = raw.match(/^var suggestvalue="(.+)";?$/);
        if (!match)
            return [];
        const results = [];
        const items = match[1].split(';');
        for (const item of items) {
            const parts = item.split(',');
            if (parts.length < 4)
                continue;
            const name = parts[0];
            const typeCode = parts[1];
            const code = parts[2];
            const marketCode = parts[3];
            // 只取 A股 (type=11)
            if (typeCode !== '11')
                continue;
            if (!code || !marketCode)
                continue;
            // 过滤纯数字代码（债券、基金等）- 市场代码必须是 sh/sz 开头
            if (!/^(sh|sz)\d{6}$/.test(marketCode))
                continue;
            // 修复：用代码查询时 name 在 parts[4]，用名称查询时在 parts[0]
            let stockName = name;
            if (/^\d{6}$/.test(code) && parts.length >= 5 && !/^\d+$/.test(parts[4])) {
                stockName = parts[4];
            }
            const isShanghai = marketCode.startsWith('sh');
            results.push({
                symbol: code,
                name: stockName,
                market: isShanghai ? '沪A' : '深A',
                marketCode: marketCode
            });
        }
        return results;
    }
    catch (err) {
        console.error('[search] sina failed:', err);
        return [];
    }
}
export async function stockRoutes(app) {
    // 搜索
    app.get('/search', async (req, reply) => {
        const q = req.query.query || req.query.q || '';
        if (!q.trim()) {
            return reply.status(400).send({ error: '搜索词不能为空' });
        }
        try {
            const results = await sinaSearch(q);
            console.log('[search] sina results:', results.length);
            return {
                query: q,
                results: results.map(r => ({
                    symbol: r.symbol,
                    name: r.name,
                    market: r.market
                }))
            };
        }
        catch (err) {
            console.error('[search] failed:', err);
            return { query: q, results: [] };
        }
    });
    // 股票完整评分
    app.get('/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        try {
            // 先尝试 getStockData（完整评分）
            let result = await getStockData(upperSymbol, 'china');
            // 兜底：如果 basic 查不到但 price 存在，用新浪搜索获取名称
            if (!result) {
                const [basic, price, kline] = await Promise.all([
                    getStockBasic(upperSymbol, 'china'),
                    getStockPrice(upperSymbol, 'china'),
                    getStockKLine(upperSymbol, 'daily', 'china'),
                ]);
                if (!basic && price) {
                    // price 存在说明是有效股票，从新浪搜索获取名称
                    const sinaResults = await sinaSearch(upperSymbol);
                    const match = sinaResults.find(r => r.symbol === upperSymbol);
                    const fallbackBasic = {
                        symbol: upperSymbol,
                        name: match?.name || upperSymbol,
                        market: match?.market || 'A股',
                        industry: '未知行业',
                        area: '未知地区',
                    };
                    const { calculateScores } = await import('../services/scorer.js');
                    const { generateStockSummary } = await import('../services/aiSummary.js');
                    const stockData = { basic: fallbackBasic, price, kline, risk: null };
                    result = calculateScores(stockData);
                }
            }
            if (!result) {
                return reply.status(404).send({ error: '股票代码不存在或数据获取失败', symbol: upperSymbol });
            }
            return { ...result, market: 'china' };
        }
        catch (err) {
            console.error('Stock API error:', err);
            return reply.status(500).send({ error: '服务器内部错误', message: err.message });
        }
    });
    // K线
    app.get('/kline/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        try {
            const kline = await getStockKLine(upperSymbol, 'daily', 'china');
            if (!kline) {
                return reply.status(404).send({ error: 'K线数据获取失败', symbol: upperSymbol });
            }
            return { symbol: upperSymbol, kline };
        }
        catch (err) {
            return reply.status(500).send({ error: err.message });
        }
    });
}
