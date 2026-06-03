// 评分引擎

export interface StockData {
  basic: {
    symbol: string
    name: string
    market: string
    industry: string
    area: string
  }
  price: {
    current: number
    change: number
    changePercent: number
    volume: number
    high: number
    low: number
    pe: number
    pb: number
    marketCap: number
    history: Array<{ date: string; close: number; open: number; high: number; low: number; volume: number }>
  }
  kline: {
    data: Array<{ date: string; close: number }>
    ma: Record<string, number[]>
  } | null
  risk: {
    beta: number
    volatility: number
    sharpe: number
    maxDrawdown: number
  } | null
}

export interface ScoreResult {
  symbol: string
  name: string
  cedarScore: number          // 综合评分 0-100
  cedarLevel: 'S' | 'A' | 'B' | 'C' | 'D' | 'AVOID'
  
  trackScore: number          // 追踪评级 0-100
  trackLevel: 'S' | 'A' | 'B' | 'C'
  
  growthScore: number         // 成长性评分
  growthLevel: 'A' | 'B' | 'C' | 'D'
  
  valuationScore: number      // 估值评分
  valuationLevel: 'low' | 'medium' | 'high' | 'very_high'
  
  riskScore: number           // 风险评分 0-100 (越高风险越低)
  riskLevel: 'low' | 'medium' | 'high' | 'very_high'
  
  marketTemp: number          // 市场温度 0-100
  marketTempLevel: 'fever' | 'warm' | 'neutral' | 'cold'
  
  maEvaluation: {             // 均线系统评估
    ma30: 'bull' | 'bear' | 'neutral'
    ma60: 'bull' | 'bear' | 'neutral'
    ma120: 'bull' | 'bear' | 'neutral'
    ma240: 'bull' | 'bear' | 'neutral'
    overall: 'bull' | 'bear' | 'neutral'
  }
  
  industry: string
  chinaUsMapping: string | null
  
  summary: string             // AI 摘要 (预留)
  
  price: {
    current: number
    change: number
    changePercent: number
    pe: number
    pb: number
    marketCap: number
  }
  
  updatedAt: string
}

// ===== 评分计算 =====

export function calculateScores(data: StockData): ScoreResult {
  const { basic, price, kline } = data
  
  // 1. 追踪评级 (技术面)
  const trackScore = calculateTrackScore(price, kline)
  
  // 2. 成长性评分
  const growthScore = calculateGrowthScore(price)
  
  // 3. 估值评分
  const valuationScore = calculateValuationScore(price)
  
  // 4. 风险评分
  const riskScore = calculateRiskScore(price)
  
  // 5. 市场温度
  const marketTemp = calculateMarketTemp(price)
  
  // 6. 均线评估
  const maEvaluation = calculateMAEval(kline, price)
  
  // 7. 综合评分
  const cedarScore = Math.round(
    trackScore * 0.25 +
    growthScore * 0.25 +
    valuationScore * 0.25 +
    riskScore * 0.25
  )
  
  // 8. Cedar 等级
  const cedarLevel = getCedarLevel(cedarScore)
  
  // 9. 中美映射
  const chinaUsMapping = getChinaUsMapping(basic.symbol, basic.industry)
  
  return {
    symbol: basic.symbol,
    name: basic.name,
    cedarScore,
    cedarLevel,
    trackScore,
    trackLevel: getTrackLevel(trackScore),
    growthScore,
    growthLevel: getGrowthLevel(growthScore),
    valuationScore,
    valuationLevel: getValuationLevel(valuationScore),
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    marketTemp,
    marketTempLevel: getMarketTempLevel(marketTemp),
    maEvaluation,
    industry: basic.industry,
    chinaUsMapping,
    summary: '',
    price: {
      current: price.current,
      change: price.change,
      changePercent: price.changePercent,
      pe: price.pe,
      pb: price.pb,
      marketCap: price.marketCap
    },
    updatedAt: new Date().toISOString()
  }
}

function calculateTrackScore(price: StockData['price'], kline: StockData['kline']): number {
  let score = 50 // 基础分
  
  // 趋势评分 (均线系统)
  if (kline) {
    const closes = kline.data.map(d => d.close)
    const ma30 = kline.ma.ma30
    const ma60 = kline.ma.ma60
    const current = closes[closes.length - 1]
    
    if (current > ma30[ma30.length - 1]) score += 10
    if (current > ma60[ma60.length - 1]) score += 10
    if (ma30[ma30.length - 1] > ma60[ma60.length - 1]) score += 10
  }
  
  // 动量评分 (涨跌幅)
  if (price.changePercent > 5) score += 15
  else if (price.changePercent > 2) score += 10
  else if (price.changePercent > 0) score += 5
  else if (price.changePercent < -5) score -= 15
  else if (price.changePercent < -2) score -= 10
  else if (price.changePercent < 0) score -= 5
  
  // 成交量评分
  if (price.volume > 100000000) score += 5
  
  return Math.min(100, Math.max(0, score))
}

function calculateGrowthScore(price: StockData['price']): number {
  let score = 50
  
  // 使用历史数据计算涨跌幅
  if (price.history.length >= 250) {
    const yearAgo = price.history[price.history.length - 250]
    const growth = ((price.current - yearAgo.close) / yearAgo.close) * 100
    
    if (growth > 50) score += 30
    else if (growth > 30) score += 25
    else if (growth > 20) score += 20
    else if (growth > 10) score += 15
    else if (growth > 0) score += 10
    else if (growth > -10) score -= 10
    else if (growth > -20) score -= 20
    else score -= 30
  }
  
  // PE 估值对成长的暗示
  if (price.pe > 0) {
    if (price.pe < 20) score += 10
    else if (price.pe > 60) score -= 15
    else if (price.pe > 100) score -= 25
  }
  
  return Math.min(100, Math.max(0, score))
}

function calculateValuationScore(price: StockData['price']): number {
  let score = 50
  
  // PE 评分
  if (price.pe > 0) {
    if (price.pe < 10) score += 25
    else if (price.pe < 15) score += 20
    else if (price.pe < 20) score += 15
    else if (price.pe < 30) score += 5
    else if (price.pe < 50) score -= 10
    else if (price.pe < 100) score -= 20
    else score -= 30
  }
  
  // PB 评分
  if (price.pb > 0) {
    if (price.pb < 1) score += 15
    else if (price.pb < 2) score += 10
    else if (price.pb < 3) score += 5
    else if (price.pb > 5) score -= 10
  }
  
  return Math.min(100, Math.max(0, score))
}

function calculateRiskScore(price: StockData['price']): number {
  let score = 50
  
  // 市值风险 (大市值 = 低风险)
  if (price.marketCap > 1000000000000) score += 30
  else if (price.marketCap > 100000000000) score += 20
  else if (price.marketCap > 10000000000) score += 10
  else if (price.marketCap < 1000000000) score -= 20
  
  // 波动性风险
  if (price.history.length >= 30) {
    const returns = price.history.slice(-30).map((d, i) => 
      i === 0 ? 0 : (d.close - price.history[i-1].close) / price.history[i-1].close
    )
    const vol = standardDeviation(returns) * Math.sqrt(252) // 年化波动率
    
    if (vol < 0.15) score += 15
    else if (vol < 0.25) score += 5
    else if (vol < 0.4) score -= 10
    else score -= 20
  }
  
  return Math.min(100, Math.max(0, score))
}

function calculateMarketTemp(price: StockData['price']): number {
  // 简化的市场温度计
  // 基于价格相对52周高点的位置
  if (price.high > 0) {
    const position = (price.current - price.low) / (price.high - price.low)
    return Math.round(position * 100)
  }
  return 50
}

function calculateMAEval(kline: StockData['kline'], price: StockData['price']): ScoreResult['maEvaluation'] {
  const result: ScoreResult['maEvaluation'] = {
    ma30: 'neutral',
    ma60: 'neutral',
    ma120: 'neutral',
    ma240: 'neutral',
    overall: 'neutral'
  }
  
  if (!kline || kline.data.length < 10) return result
  
  const current = price.current
  const ma30 = kline.ma.ma30[kline.ma.ma30.length - 1]
  const ma60 = kline.ma.ma60[kline.ma.ma60.length - 1]
  const ma120 = kline.ma.ma120[kline.ma.ma120.length - 1]
  const ma240 = kline.ma.ma240[kline.ma.ma240.length - 1]
  
  if (current > ma30) result.ma30 = 'bull'
  else if (current < ma30) result.ma30 = 'bear'
  
  if (current > ma60) result.ma60 = 'bull'
  else if (current < ma60) result.ma60 = 'bear'
  
  if (current > ma120) result.ma120 = 'bull'
  else if (current < ma120) result.ma120 = 'bear'
  
  if (current > ma240) result.ma240 = 'bull'
  else if (current < ma240) result.ma240 = 'bear'
  
  const bullish = [result.ma30, result.ma60, result.ma120, result.ma240].filter(m => m === 'bull').length
  if (bullish >= 3) result.overall = 'bull'
  else if (bullish <= 1) result.overall = 'bear'
  
  return result
}

function getCedarLevel(score: number): ScoreResult['cedarLevel'] {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 30) return 'D'
  return 'AVOID'
}

function getTrackLevel(score: number): 'S' | 'A' | 'B' | 'C' {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 50) return 'B'
  return 'C'
}

function getGrowthLevel(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 80) return 'A'
  if (score >= 60) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function getValuationLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (score >= 75) return 'low'
  if (score >= 55) return 'medium'
  if (score >= 35) return 'high'
  return 'very_high'
}

function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
  if (score >= 80) return 'low'
  if (score >= 60) return 'medium'
  if (score >= 40) return 'high'
  return 'very_high'
}

function getMarketTempLevel(temp: number): 'fever' | 'warm' | 'neutral' | 'cold' {
  if (temp >= 80) return 'fever'
  if (temp >= 55) return 'warm'
  if (temp >= 35) return 'neutral'
  return 'cold'
}

function getChinaUsMapping(symbol: string, industry: string): string | null {
  // 简化的中美行业映射
  const map: Record<string, string> = {
    '新能源汽车': 'Tesla, Rivian',
    '锂电池': 'QuantumScape, Solid Power',
    '光伏': 'First Solar, Enphase',
    '半导体': 'Nvidia, AMD, Intel',
    '互联网': 'Google, Meta, Amazon',
    '消费电子': 'Apple, Samsung',
    '医药': 'Pfizer, Johnson & Johnson',
    '银行': 'JPMorgan, Bank of America',
    '保险': 'Berkshire Hathaway, AIG',
    '券商': 'Goldman Sachs, Morgan Stanley',
    '白酒': 'Diageo, Constellation Brands',
    '房地产': 'D.R. Horton, Lennar',
    '食品': 'Nestle, Kraft Heinz',
    '饮料': 'Coca-Cola, PepsiCo',
    '教育': 'Chegg, Duolingo',
    '电商': 'Amazon, Shopify',
    '云计算': 'AWS, Azure, Google Cloud',
    'AI': 'OpenAI, Anthropic, Google AI',
  }
  
  return map[industry] || null
}

function standardDeviation(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const squareDiffs = arr.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length)
}