/**
 * MiniMax AI 摘要服务
 * API: api.minimaxi.com
 * Model: MiniMax-M2.7
 * 返回6个维度分析，每维度≤150字
 */

import axios from 'axios'

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.MINIMAX_DOMESTIC_API_KEY
const MINIMAX_API_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2'

// 6个维度定义
export const DIMENSIONS = [
  { key: 'enterprise',  label: '企业分析', icon: '🏢' },
  { key: 'industry',     label: '行业分析', icon: '🏭' },
  { key: 'growth',       label: '成长分析', icon: '📈' },
  { key: 'valuation',    label: '估值分析', icon: '💰' },
  { key: 'risk',         label: '风险分析', icon: '⚠️' },
  { key: 'opportunity',  label: '机会分析', icon: '🎯' },
] as const

export type SummaryDimension = typeof DIMENSIONS[number]['key']

export interface DimensionSummary {
  dimension: string
  label: string
  icon: string
  summary: string
}

/**
 * 生成股票6维度AI分析摘要，每维度≤150字
 */
export async function generateStockSummary(
  symbol: string,
  name: string,
  cedarScore: number,
  cedarLevel: string,
  trackScore: number,
  growthScore: number,
  valuationScore: number,
  riskScore: number,
  marketTemp: number,
  price: {
    current: number; change: number; changePercent: number
    pe: number; pb: number; ps: number; peg: number; marketCap: number
    roe: number; revenueGrowth: number; profitGrowth: number
  },
  industry: string,
  industryTrack: string,
  maEvaluation: { ma30: string; ma60: string; ma120: string; ma240: string; overall: string },
  chinaUsMapping: string | null
): Promise<DimensionSummary[]> {
  // 生成6个维度的fallback
  const fallback = generateFallbackSummaries(symbol, name, cedarScore, cedarLevel, trackScore, growthScore, valuationScore, riskScore, marketTemp, price, industry, industryTrack, maEvaluation, chinaUsMapping)

  if (!MINIMAX_API_KEY) {
    console.warn('MiniMax API key not configured, returning fallback summaries')
    return fallback
  }

  // 构建提示词
  const changeSign = price.change >= 0 ? '+' : ''
  const peStr = price.pe > 0 ? `PE=${price.pe.toFixed(0)}` : 'PE=N/A'
  const psStr = price.ps > 0 ? `PS=${price.ps.toFixed(1)}` : 'PS=N/A'
  const roeStr = price.roe > 0 ? `ROE=${price.roe.toFixed(1)}%` : 'ROE=N/A'
  const revGrowStr = price.revenueGrowth !== 0 ? `营收增长${price.revenueGrowth.toFixed(1)}%` : ''
  const profitGrowStr = price.profitGrowth !== 0 ? `利润增长${price.profitGrowth.toFixed(1)}%` : ''
  const marketCapStr = formatMarketCap(price.marketCap)
  const trendCN = maEvaluation.overall === 'bull' ? '均线多头' : maEvaluation.overall === 'bear' ? '均线空头' : '均线震荡'
  const trackLabel = industryTrack ? `赛道${industryTrack}级` : ''
  const chinaUsStr = chinaUsMapping ? `对标${chinaUsMapping}` : ''
  const levelMap: Record<string, string> = { S: '极佳', A: '优秀', B: '良好', C: '一般', D: '较差', AVOID: '建议回避' }
  const cedarLevelCN = levelMap[cedarLevel] || cedarLevel

  const dataContext = [
    `${name}（${symbol}）`,
    `综合评分${cedarScore}分（${cedarLevelCN}）`,
    `当前$ ${price.current.toFixed(2)}，今日${changeSign}${price.changePercent.toFixed(2)}%`,
    `${peStr} ${psStr} ${roeStr}`,
    `${revGrowStr} ${profitGrowStr}`.trim(),
    `市值${marketCapStr}`,
    `行业：${industry} ${trackLabel}`,
    chinaUsStr,
    `均线：${trendCN}`,
    `成长评分${growthScore} 估值评分${valuationScore} 风险评分${riskScore}`,
  ].filter(Boolean).join(' | ')

  const prompt = `你是专业金融分析师，为股票${symbol}生成6个维度的投资分析，每维度≤150字。格式：严格按以下JSON数组返回，不要任何其他内容：\n[{"dimension":"enterprise","label":"企业分析","icon":"🏢","summary":"..."},{"dimension":"industry","label":"行业分析","icon":"🏭","summary":"..."},{"dimension":"growth","label":"成长分析","icon":"📈","summary":"..."},{"dimension":"valuation","label":"估值分析","icon":"💰","summary":"..."},{"dimension":"risk","label":"风险分析","icon":"⚠️","summary":"..."},{"dimension":"opportunity","label":"机会分析","icon":"🎯","summary":"..."}]\n\n股票数据：${dataContext}\n\n要求：summary必须是连贯完整的中文句子，每条≤150字，不要换行符，专业客观。`

  try {
    const response = await axios.post(
      MINIMAX_API_URL,
      {
        model: 'MiniMax-M2.7',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1200
      },
      {
        headers: {
          'Authorization': `Bearer ${MINIMAX_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    )

    const raw = response.data.choices?.[0]?.message?.content?.trim() || ''
    const finishReason = response.data.choices?.[0]?.finish_reason

    if (!raw || finishReason !== 'stop') {
      console.warn(`MiniMax empty/truncated (finish=${finishReason}), using fallback`)
      return fallback
    }

    // 尝试解析JSON
    const summaries = parseAIResponse(raw)
    if (summaries && summaries.length === 6) {
      return summaries
    }

    console.warn('MiniMax response parse failed, using fallback')
    return fallback
  } catch (error: any) {
    console.error('MiniMax API error:', error.message)
    return fallback
  }
}

function parseAIResponse(raw: string): DimensionSummary[] | null {
  try {
    // 尝试直接解析
    let json = raw
    // 去掉可能的markdown代码块
    if (json.startsWith('```')) {
      json = json.replace(/```json\n?/, '').replace(/```\n?/, '').trim()
    }
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed) && parsed.length === 6) {
      // 验证字段
      return parsed.map((item, i) => ({
        dimension: item.dimension || DIMENSIONS[i].key,
        label: item.label || DIMENSIONS[i].label,
        icon: item.icon || DIMENSIONS[i].icon,
        summary: (item.summary || '').substring(0, 150)
      }))
    }
    return null
  } catch {
    return null
  }
}

function formatMarketCap(cap: number): string {
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(1)}万亿`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(0)}十亿`
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(0)}百万`
  return cap > 0 ? `$${cap.toLocaleString()}` : '市值N/A'
}

export function generateFallbackSummaries(
  symbol: string,
  name: string,
  cedarScore: number,
  cedarLevel: string,
  trackScore: number,
  growthScore: number,
  valuationScore: number,
  riskScore: number,
  marketTemp: number,
  price: {
    current: number; change: number; changePercent: number
    pe: number; pb: number; ps: number; peg: number; marketCap: number
    roe: number; revenueGrowth: number; profitGrowth: number
  },
  industry: string,
  industryTrack: string,
  maEvaluation: { ma30: string; ma60: string; ma120: string; ma240: string; overall: string },
  chinaUsMapping: string | null
): DimensionSummary[] {
  const changeSign = price.change >= 0 ? '上涨' : '下跌'
  const peStr = price.pe > 0 ? `PE=${price.pe.toFixed(0)}` : 'PE=N/A'
  const levelMap: Record<string, string> = { S: '极佳', A: '优秀', B: '良好', C: '一般', D: '较差', AVOID: '建议回避' }
  const cedarLevelCN = levelMap[cedarLevel] || cedarLevel
  const trackLabel = industryTrack || ''
  const trendCN = maEvaluation.overall === 'bull' ? '均线多头' : maEvaluation.overall === 'bear' ? '均线空头' : '均线震荡'

  return [
    {
      dimension: 'enterprise',
      label: '企业分析',
      icon: '🏢',
      summary: `${name}（${symbol}）综合评分${cedarScore}分（${cedarLevelCN}），当前价格$ ${price.current.toFixed(2)}，今日${changeSign}${Math.abs(price.changePercent).toFixed(2)}%。公司${industry}行业${trackLabel ? `，${trackLabel}级赛道` : ''}，市值${formatMarketCap(price.marketCap)}。数据由CEDAR AI系统生成，仅供参考。`
    },
    {
      dimension: 'industry',
      label: '行业分析',
      icon: '🏭',
      summary: `${industry}行业，${trackLabel ? `${trackLabel}级热门赛道，` : ''}追踪评级${trackScore}分。市场温度${marketTemp}分（${marketTemp >= 60 ? '偏热' : marketTemp >= 40 ? '中性' : '偏冷'}）。${chinaUsMapping ? `可对标${chinaUsMapping}。` : ''}均线走势${trendCN}。数据由CEDAR AI系统生成，仅供参考。`
    },
    {
      dimension: 'growth',
      label: '成长分析',
      icon: '📈',
      summary: `成长评分${growthScore}分。${price.revenueGrowth !== 0 ? `营收${price.revenueGrowth > 0 ? '增长' : '下降'}${Math.abs(price.revenueGrowth).toFixed(1)}%，` : ''}${price.profitGrowth !== 0 ? `净利润${price.profitGrowth > 0 ? '增长' : '下降'}${Math.abs(price.profitGrowth).toFixed(1)}%，` : ''}PE=${price.pe > 0 ? price.pe.toFixed(0) : 'N/A'}。数据由CEDAR AI系统生成，仅供参考。`
    },
    {
      dimension: 'valuation',
      label: '估值分析',
      icon: '💰',
      summary: `估值评分${valuationScore}分。${peStr}，PS=${price.ps > 0 ? price.ps.toFixed(1) : 'N/A'}，PB=${price.pb > 0 ? price.pb.toFixed(1) : 'N/A'}，PEG=${price.peg > 0 ? price.peg.toFixed(1) : 'N/A'}。${price.roe > 0 ? `ROE=${price.roe.toFixed(1)}%。` : ''}数据由CEDAR AI系统生成，仅供参考。`
    },
    {
      dimension: 'risk',
      label: '风险分析',
      icon: '⚠️',
      summary: `风险评分${riskScore}分（越高风险越低）。${riskScore >= 70 ? '财务风险较低，' : riskScore >= 50 ? '财务风险中等，' : '财务风险较高，'}均线系统${maEvaluation.overall === 'bull' ? '呈多头排列' : maEvaluation.overall === 'bear' ? '呈空头排列' : '处于震荡'}。数据由CEDAR AI系统生成，仅供参考。`
    },
    {
      dimension: 'opportunity',
      label: '机会分析',
      icon: '🎯',
      summary: `综合评分${cedarScore}分${cedarLevelCN}，追踪评级${trackScore}分${industryTrack ? `（${industryTrack}级赛道）` : ''}。${maEvaluation.overall === 'bull' ? '均线多头排列，短期趋势向好。' : maEvaluation.overall === 'bear' ? '均线空头排列，短期注意风险。' : '均线震荡，建议观望。'}数据由CEDAR AI系统生成，仅供参考。`
    }
  ]
}
