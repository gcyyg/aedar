import { getStockData } from '../services/stockData.js';
import { cache } from '../services/cache.js';
export async function stockRoutes(app) {
    // 获取单只股票完整评分
    app.get('/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        try {
            // getStockData 内部处理缓存 + AI 摘要生成
            const result = await getStockData(upperSymbol);
            if (!result) {
                return reply.status(404).send({ error: '股票代码不存在或数据获取失败', symbol: upperSymbol });
            }
            reply.header('X-Cache', 'MISS');
            return result;
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
    // 支持的股票市场列表
    app.get('/markets', async () => ({
        markets: [
            { code: 'us', name: '美股', examples: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'] },
            { code: 'china', name: 'A股', examples: ['600519', '000858', '601318', '688981', '002594'] },
            { code: 'hk', name: '港股', examples: ['00700', '09988', '03690'] }
        ]
    }));
}
