import { FastifyInstance } from 'fastify'
import { getStockData, getStockBasic, getStockKLine } from '../services/stockData.js'
import { cache } from '../services/cache.js'

export async function stockRoutes(app: FastifyInstance) {

  // 基础信息：优先缓存，缓存失效再从第三方获取
  app.get<{ Params: { symbol: string }; Querystring: { market?: string } }>('/basic/:symbol', async (req, reply) => {
    const { symbol } = req.params
    const upperSymbol = symbol.toUpperCase()
    const market = (req.query.market as 'us' | 'china') || undefined

    const basic = await getStockBasic(upperSymbol, market)
    if (!basic) {
      return reply.status(404).send({ error: '股票代码不存在', symbol: upperSymbol })
    }

    reply.header('X-Cache', 'HIT')
    return { symbol: upperSymbol, basic }
  })

  // 获取单只股票完整评分
  app.get<{ Params: { symbol: string }; Querystring: { market?: string } }>('/:symbol', async (req, reply) => {
    const { symbol } = req.params
    const upperSymbol = symbol.toUpperCase()
    const market = (req.query.market as 'us' | 'china') || undefined

    try {
      // getStockData 内部处理缓存 + AI 摘要生成
      const result = await getStockData(upperSymbol, market)
      if (!result) {
        return reply.status(404).send({ error: '股票代码不存在或数据获取失败', symbol: upperSymbol })
      }

      reply.header('X-Cache', 'MISS')
      return { ...result, market }
    } catch (err: any) {
      console.error('Stock API error:', err)
      return reply.status(500).send({ error: '服务器内部错误', message: err.message })
    }
  })

  // 批量获取
  app.post('/batch', async (req, reply) => {
    const { symbols } = req.body as { symbols: string[] }
    if (!symbols?.length || symbols.length > 20) {
      return reply.status(400).send({ error: 'symbols 数量应在 1-20 之间' })
    }

    const results = await Promise.allSettled(
      symbols.map(s => getStockData(s.toUpperCase()))
    )

    return results.map((r, i) => ({
      symbol: symbols[i],
      ...(r.status === 'fulfilled' ? r.value : { error: '获取失败' })
    }))
  })

  // 清除缓存
  app.delete<{ Params: { symbol: string } }>('/:symbol/cache', async (req, reply) => {
    const { symbol } = req.params
    const cacheKey = `stock:score:${symbol.toUpperCase()}`
    const deleted = cache.del(cacheKey)
    return { success: deleted, cacheKey }
  })

  // 均线评估用的K线数据（独立缓存24h）
  app.get<{ Params: { symbol: string }; Querystring: { market?: string } }>('/kline/:symbol', async (req, reply) => {
    const { symbol } = req.params
    const upperSymbol = symbol.toUpperCase()
    const market = (req.query.market as 'us' | 'china') || undefined

    const kline = await getStockKLine(upperSymbol, 'daily', market)
    if (!kline) {
      return reply.status(404).send({ error: 'K线数据获取失败', symbol: upperSymbol })
    }

    return { symbol: upperSymbol, kline }
  })

  // 支持的股票市场列表
  app.get('/markets', async () => ({
    markets: [
      { code: 'us', name: '大漂亮（美股）', examples: ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'] },
      { code: 'china', name: '中国大爱（A股）', examples: ['600519', '000858', '601318', '688981', '002594'] },
    ]
  }))
}