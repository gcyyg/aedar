import { FastifyInstance } from 'fastify'
import axios from 'axios'
import { getStockData, getStockKLine, getStockBasic, getStockPrice } from '../services/stockData.js'

const EM_SEARCH_API = 'https://searchapi.eastmoney.com/api/suggest/get'
const EM_TOKEN='***'

async function emSearch(symbol: string): Promise<{symbol: string; name: string; market: string} | null> {
  try {
    const res = await axios.get(EM_SEARCH_API, {
      params: { input: symbol, type: 14, token: EM_TOKEN, count: 1 },
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.eastmoney.com' }
    })
    const hits: any[] = res.data?.QuotationCodeTable?.Data || []
    const h = hits.find((h: any) => h.Classify === 'AStock' && ['1','2'].includes(h.SecurityType))
    if (h) return { symbol: h.UnifiedCode || h.Code, name: h.Name || h.SecurityName, market: h.SecurityType === '1' ? '沪A' : '深A' }
  } catch {}
  return null
}

export async function stockRoutes(app: FastifyInstance) {
  // 搜索
  app.get('/search', async (req, reply) => {
    const rawUrl: string = (req as any).raw.url
    let decodedQ = ''
    try {
      const m = rawUrl.match(/[?&]q=([^&]+)/)
      decodedQ = m ? decodeURIComponent(m[1]) : ''
    } catch {
      decodedQ = ''
    }

    console.log('[search] rawUrl:', rawUrl)
    console.log('[search] decodedQ:', decodedQ)

    if (!decodedQ.trim()) {
      return reply.status(400).send({ error: '搜索词不能为空' })
    }

    try {
      const apiUrl = `${EM_SEARCH_API}?input=${encodeURIComponent(decodedQ)}&type=14&token=${EM_TOKEN}&count=10`
      console.log('[search] apiUrl:', apiUrl)
      const apiRes = await axios.get(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.eastmoney.com',
        },
      })
      const apiData = apiRes.data
      const hits: any[] = apiData?.QuotationCodeTable?.Data || []
      console.log('[search] eastmoney hits:', hits.length)

      const results = hits
        .filter((h: any) => h.Classify === 'AStock' && ['1', '2'].includes(h.SecurityType))
        .map((h: any) => ({
          symbol: h.UnifiedCode || h.Code || '',
          name: h.Name || h.SecurityName || '',
          market: h.SecurityType === '1' ? '沪A' : '深A',
        }))

      return { query: decodedQ, results }
    } catch (err) {
      console.error('[search] eastmoney failed:', err)
      return { query: decodedQ, results: [] }
    }
  })

  // 股票完整评分
  app.get<{ Params: { symbol: string } }>('/:symbol', async (req, reply) => {
    const { symbol } = req.params
    const upperSymbol = symbol.toUpperCase()
    try {
      // 先尝试 getStockData（完整评分）
      let result = await getStockData(upperSymbol, 'china')

      // 兜底：如果 basic 查不到但 price 存在，用东方财富名称构造基础数据
      if (!result) {
        const [basic, price, kline] = await Promise.all([
          getStockBasic(upperSymbol, 'china'),
          getStockPrice(upperSymbol, 'china'),
          getStockKLine(upperSymbol, 'daily', 'china'),
        ])
        if (!basic && price) {
          // price 存在说明是有效股票，从东方财富搜索获取名称
          const emInfo = await emSearch(upperSymbol)
          const fallbackBasic = {
            symbol: upperSymbol,
            name: emInfo?.name || upperSymbol,
            market: emInfo?.market || 'A股',
            industry: '未知行业',
            area: '未知地区',
          }
          const { calculateScores } = await import('../services/scorer.js')
          const { generateStockSummary } = await import('../services/aiSummary.js')
          const stockData = { basic: fallbackBasic, price, kline, risk: null }
          result = calculateScores(stockData)
        }
      }

      if (!result) {
        return reply.status(404).send({ error: '股票代码不存在或数据获取失败', symbol: upperSymbol })
      }
      return { ...result, market: 'china' }
    } catch (err: any) {
      console.error('Stock API error:', err)
      return reply.status(500).send({ error: '服务器内部错误', message: err.message })
    }
  })

  // K线
  app.get<{ Params: { symbol: string } }>('/kline/:symbol', async (req, reply) => {
    const { symbol } = req.params
    const upperSymbol = symbol.toUpperCase()
    try {
      const kline = await getStockKLine(upperSymbol, 'daily', 'china')
      if (!kline) {
        return reply.status(404).send({ error: 'K线数据获取失败', symbol: upperSymbol })
      }
      return { symbol: upperSymbol, kline }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}