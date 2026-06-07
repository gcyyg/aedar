import { FastifyInstance } from 'fastify'
import { runAnalysis, type AnalysisType } from '../services/analysisService.js'
import { getStockData } from '../services/stockData.js'

const VALID_TYPES: AnalysisType[] = ['comps', 'dcf', 'lbo', 'competitive', 'audit']

export async function analysisRoutes(app: FastifyInstance) {

  app.get<{
    Params: { type: string; symbol: string }
  }>('/:type/:symbol', async (req, reply) => {
    const { type, symbol } = req.params
    const upperSymbol = symbol.toUpperCase()

    if (!VALID_TYPES.includes(type as AnalysisType)) {
      return reply.status(400).send({
        error: '无效的分析类型',
        validTypes: VALID_TYPES,
      })
    }

    try {
      const stockData = await getStockData(upperSymbol)
      if (!stockData) {
        return reply.status(404).send({ error: '股票不存在', symbol: upperSymbol })
      }

      const price = stockData.price

      const peers: { symbol: string; name: string; pe: number; pb: number; marketCap: number }[] | null =
        (stockData as any).peerBenchmarks?.map((p: any) => ({
          symbol: p.symbol,
          name: p.name || p.symbol,
          pe: p.pe || 0,
          pb: p.pb || 0,
          marketCap: p.marketCap || 0,
        })) ?? null

      const financials: { revenue: number; revenueGrowth: number; profitGrowth: number; grossMargin: number; ebitdaMargin: number; netMargin: number } | null =
        price.revenueGrowth != null ? {
          revenue: (price as any).revenue || 0,
          revenueGrowth: price.revenueGrowth || 0,
          profitGrowth: price.profitGrowth || 0,
          grossMargin: (price as any).grossMargin || 35,
          ebitdaMargin: (price as any).ebitdaMargin || 20,
          netMargin: (price as any).netMargin || 15,
        } : null

      const result = await runAnalysis(
        type as AnalysisType,
        upperSymbol,
        stockData.name,
        {
          current: price.current || 0,
          pe: price.pe || 0,
          pb: price.pb || 0,
          marketCap: price.marketCap || 0,
          ps: price.ps,
          peg: price.peg,
          roe: price.roe,
        },
        financials,
        peers,
        stockData.industry,
        'china',
      )

      return result
    } catch (err: any) {
      console.error('Analysis route error:', err)
      return reply.status(500).send({ error: '分析生成失败', message: err.message })
    }
  })
}
