/**
 * MiniMax AI 摘要服务
 * API: api.minimaxi.com
 * Model: MiniMax-M2.7
 */

import axios from 'axios'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.MINIMAX_DOMESTIC_API_KEY
const MINIMAX_API_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2'

/**
 * 生成股票 AI 分析摘要
 * 使用 MiniMax-M2.7，prompt 需简洁，max_tokens 控制在 150 左右
 */
export async function generateStockSummary(
  symbol: string,
  name: string,
  score: number,
  cedarLevel: string,
  trackScore: number,
  growthScore: number,
  valuationScore: number,
  riskScore: number,
  marketTemp: number,
  price: { current: number; change: number; changePercent: number; pe: number; pb: number; marketCap: number },
  industry: string,
  maEvaluation: { ma30: string; ma60: string; ma120: string; ma240: string; overall: string }
): Promise<string> {
  if (!MINIMAX_API_KEY) {
    console.warn('MiniMax API key not configured, returning placeholder summary')
    return generateFallbackSummary(symbol, name, score, cedarLevel, price)
  }

  // 格式化关键数据
  const changeSign = price.change >= 0 ? '+' : ''
  const marketCapStr = formatMarketCap(price.marketCap)
  const levelMap: Record<string, string> = { S: '极佳', A: '优秀', B: '良好', C: '一般', D: '较差', AVOID: '建议回避' }
  const levelCN = levelMap[cedarLevel] || cedarLevel
  const trendCN = maEvaluation.overall === 'bull' ? '多头排列' : maEvaluation.overall === 'bear' ? '空头排列' : '震荡整理'
  const priceStatus = price.change >= 0 ? '上涨' : '下跌'
  const peStr = price.pe > 0 ? `PE${price.pe.toFixed(0)}` : 'PE无数据'
  const trend = `综合评分${score}分（${levelCN}），当前${priceStatus}${Math.abs(price.changePercent).toFixed(2)}%，${trendCN}，${peStr}，市值${marketCapStr}`

  // 简化为一句提问，max_tokens=150 效果最佳（实测临界值）
  const prompt = `用80字以内评价${name}（${symbol}）股票投资价值，简明扼要。核心数据：${trend}。直接回复评价内容，不要格式标记。`

  try {
    const response = await axios.post(
      MINIMAX_API_URL,
      {
        model: 'MiniMax-M2.7',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 150  // 150 最佳，过高会触发截断
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const content = response.data.choices?.[0]?.message?.content
    const finishReason = response.data.choices?.[0]?.finish_reason

    // content 有内容且非截断则使用
    if (content && content.trim().length > 0 && finishReason === 'stop') {
      return content.trim()
    }

    // 截断或为空时用 fallback
    console.warn(`MiniMax returned empty/truncated (finish=${finishReason}), using fallback`)
    return generateFallbackSummary(symbol, name, score, cedarLevel, price)
  } catch (error: any) {
    console.error('MiniMax API error:', error.message)
    return generateFallbackSummary(symbol, name, score, cedarLevel, price)
  }
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}万亿`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}十亿`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}百万`
  return `$${cap.toLocaleString()}`
}

function generateFallbackSummary(
  symbol: string,
  name: string,
  score: number,
  cedarLevel: string,
  price: { current: number; change: number; changePercent: number }
): string {
  const levelDesc: Record<string, string> = {
    S: '极佳', A: '优秀', B: '良好', C: '一般', D: '较差', AVOID: '建议回避'
  }
  const changeSign = price.change >= 0 ? '上涨' : '下跌'
  return `${name}（${symbol}）综合评分${score}分，等级${levelDesc[cedarLevel] || '未知'}。` +
    `当前价格$${price.current.toFixed(2)}，今日${changeSign}${Math.abs(price.changePercent).toFixed(2)}%。` +
    `数据由CEDAR AI系统基于基本面、技术面、估值等多维度分析生成，仅供参考。`
}
