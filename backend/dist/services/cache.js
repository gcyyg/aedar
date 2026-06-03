import NodeCache from 'node-cache';
// 缓存配置
export const cache = new NodeCache({
    stdTTL: 86400, // 默认 24小时
    checkperiod: 3600, // 每小时检查过期
    useClones: false // 性能优化
});
// 缓存 key 工具
export const cacheKeys = {
    stockBasic: (symbol) => `stock:basic:${symbol}`,
    stockScore: (symbol) => `stock:score:${symbol}`,
    stockPrice: (symbol) => `stock:price:${symbol}`,
    stockKLine: (symbol, period) => `stock:kline:${symbol}:${period}`,
    stockRisk: (symbol) => `stock:risk:${symbol}`,
    aiSummary: (symbol) => `ai:summary:${symbol}`,
    chinaUsMap: (symbol) => `china:us:map:${symbol}`,
};
