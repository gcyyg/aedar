/**
 * MiniMax AI 摘要服务
 * API: api.minimaxi.com
 * Model: MiniMax-M2.7
 */

import axios from 'axios'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.MINIMAX_DOMESTIC_API_KEY
const MINIMAX_API_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2'

export interface AISummaryResult {
  summary: string
  keyPoints: string[]
  riskWarnings: string[]
  investmentAdvice: string
  generatedAt: string
}

/**
 * 生成股票 AI 分析摘要
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

  const prompt = buildSummaryPrompt({
    symbol,
    name,
    score,
    cedarLevel,
    trackScore,
    growthScore,
    valuationScore,
    riskScore,
    marketTemp,
    price,
    industry,
    maEvaluation
  })

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
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const assistantMessage = response.data.choices?.[0]?.message?.content
    if (assistantMessage) {
      return parseAndCleanSummary(assistantMessage)
    }

    return generateFallbackSummary(symbol, name, score, cedarLevel, price)
  } catch (error: any) {
    console.error('MiniMax API error:', error.message)
    return generateFallbackSummary(symbol, name, score, cedarLevel, price)
  }
}

interface SummaryParams {
  symbol: string
  name: string
  score: number
  cedarLevel: string
  trackScore: number
  growthScore: number
  valuationScore: number
  riskScore: number
  marketTemp: number
  price: { current: number; change: number; changePercent: number; pe: number; pb: number; marketCap: number }
  industry: string
  maEvaluation: { ma30: string; ma60: string; ma120: string; ma240: string; overall: string }
}

function buildSummaryPrompt(params: SummaryParams): string {
  const {
    symbol, name, score, cedarLevel,
    trackScore, growthScore, valuationScore, riskScore, marketTemp,
    price, industry, maEvaluation
  } = params

  const changeSign = price.change >= 0 ? '+' : ''
  const marketCapStr = formatMarketCap(price.marketCap)
  const maOverallCN = params.maEvaluation.overall === 'bull' ? '多头排列' : params.maEvaluation.overall === 'bear' ? '空头排列' : '震荡整理'

  return `请分析以下股票并生成简洁的投资摘要（中文，150字以内）：

股票：${name}（${symbol}）
行业：${industry}
综合评分：${score}分（${cedarLevel}级）
赛道评分：${trackScore}分
成长性评分：${growthScore}分
估值评分：${valuationScore}分
风险评分：${riskScore}分
市场温度：${marketTemp}（0-100）

当前价格：$${price.current.toFixed(2)}，今日涨跌${changeSign}${price.change.toFixed(2)}（${changeSign}${price.changePercent.toFixed(2)}%）
PE：${price.pe > 0 ? price.pe.toFixed(2) : 'N/A'}，PB：${price.pb > 0 ? price.pb.toFixed(2) : 'N/A'}
市值：${marketCapStr}

均线系统：${maOverallCN}（MA30:${params.maEvaluation.ma30}，MA60:${params.maEvaluation.ma60}，MA120:${params.maEvaluation.ma120}，MA240:${params.maEvaluation.ma240}）

请按以下格式回复（只输出摘要，不要其他内容）：
【摘要】
（在这里写出150字以内的投资摘要，分析当前估值水平、主要风险和机会点）`
}

function parseAndCleanSummary(raw: string): string {
  // 移除可能的 markdown 格式
  let cleaned = raw.trim()
  
  // 如果包含【摘要】标记，提取其后的内容
  const summaryMatch = cleaned.match(/【摘要】\s*([\s\S]+)/)
  if (summaryMatch) {
    cleaned = summaryMatch[1].trim()
  }
  
  // 移除可能的引号
  cleaned = cleaned.replace(/^["']|["']$/g, '')
  
  // 限制长度
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 497) + '...'
  }
  
  return cleaned
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}万亿`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}十亿`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}百万`
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
    S: '极佳',
    A: '优秀',
    B: '良好',
    C: '一般',
    D: '较差',
    AVOID: '建议回避'
  }
  
  const changeSign = price.change >= 0 ? '上涨' : '下跌'
  
  return `${name}（${symbol}）综合评分${score}分，等级${levelDesc[cedarLevel] || '未知'}。` +
    `当前价格$${price.current.toFixed(2)}，今日${changeSign}${Math.abs(price.changePercent).toFixed(2)}%。` +
    `数据由CEDAR AI系统基于基本面、技术面、估值等多维度分析生成，仅供参考。`
}
