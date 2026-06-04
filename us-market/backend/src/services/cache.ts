import NodeCache from 'node-cache'

// 缓存配置
export const cache = new NodeCache({
  stdTTL: 86400,        // 默认 24小时
  checkperiod: 3600,    // 每小时检查过期
  useClones: false      // 性能优化
})

// 缓存 key 工具
export const cacheKeys = {
  stockBasic: (symbol: string) => `stock:basic:${symbol}`,
  stockScore: (symbol: string) => `stock:score:${symbol}`,
  stockPrice: (symbol: string) => `stock:price:${symbol}`,
  stockKLine: (symbol: string, period: string) => `stock:kline:${symbol}:${period}`,
  stockRisk: (symbol: string) => `stock:risk:${symbol}`,
  chinaFund: (symbol: string) => `china:fund:${symbol}`,
  aiSummary: (symbol: string) => `ai:summary:${symbol}`,
  chinaUsMap: (symbol: string) => `china:us:map:${symbol}`,
  usStockBasic: (symbol: string) => `us:basic:${symbol}`,
  usStockPrice: (symbol: string) => `us:price:${symbol}`,
  usKLine: (symbol: string, period: string) => `us:kline:${symbol}:${period}`
};