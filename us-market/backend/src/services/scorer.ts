import type { DimensionSummary } from './aiSummary.js'
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
    ps: number
    peg: number
    marketCap: number
    roe: number
    revenueGrowth: number
    profitGrowth: number
    history: Array<{ date: string; close: number; open: number; high: number; low: number; volume: number }>
    high52?: number
    low52?: number
    analyst?: {
      rating: string
      totalAnalysts: number
      targetPrice: number
    }
    revenueGrowthCagr?: number
    profitGrowthCagr?: number
    benchmarks?: {
      pe?: 'low' | 'medium' | 'high' | null
      pb?: 'low' | 'medium' | 'high' | null
      ps?: 'low' | 'medium' | 'high' | null
      peg?: 'low' | 'medium' | 'high' | null
    }
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
  valuationDetail: {             // 估值分析详情
    pricePercentile: number       // 股价历史分位 0-100
    percentileLabel: string       // 偏低/中等/偏高
    ytdReturn?: number            // 近1年涨跌幅 %
    ytdReturnLabel: string       // 涨跌幅标签
  }
  
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

  maExplanation: {           // 均线趋势解释
    trend: string            // 趋势总述
    signal: string          // 信号描述
    advice: string          // 操作建议
  }
  
  industry: string
  industryTrack: 'S' | 'A' | 'B' | 'C'   // 赛道归属等级
  industryTrackLabel: string               // 赛道标签
  chinaUsMapping: string | null
  
  summary: DimensionSummary[]             // AI 摘要 (预留)

  kline: {                   // K线数据 (用于图表展示)
    data: Array<{ date: string; close: number; open: number; high: number; low: number; volume: number }>
    ma: Record<string, number[]>
  } | null
  
  price: {
    current: number
    change: number
    changePercent: number
    pe: number
    pb: number
    ps: number
    peg: number
    marketCap: number
    roe: number
    revenueGrowth: number
    profitGrowth: number
    analyst?: {
      rating: string
      totalAnalysts: number
      targetPrice: number
    }
    revenueGrowthCagr?: number   // 近2年营收CAGR
    profitGrowthCagr?: number    // 近2年利润CAGR
    benchmarks?: {                // 同业对比（偏低/中等/偏高）
      pe?: 'low' | 'medium' | 'high' | null
      pb?: 'low' | 'medium' | 'high' | null
      ps?: 'low' | 'medium' | 'high' | null
      peg?: 'low' | 'medium' | 'high' | null
    }
  }
  
  updatedAt: string
}

// ===== 评分计算 =====

export function calculateScores(data: StockData): ScoreResult {
  const { basic, price, kline } = data
  
  // 1. 追踪评级 (技术面 + 行业热度 + 资金面)
  const trackScore = calculateTrackScore(price, kline, basic.industry)
  
  // 2. 成长性评分
  const growthScore = calculateGrowthScore(price)
  
  // 3. 估值评分
  const valuationResult = calculateValuationScore(price, (kline?.data ?? []) as any)
  const valuationScore = valuationResult.score
  
  // 4. 风险评分
  const riskScore = calculateRiskScore(price)
  
  // 5. 市场温度
  const marketTemp = calculateMarketTemp(price, kline)
  
  // 6. 均线评估（kline 无数据时降级使用 52 周高低价）
  const metric52w = price.high52 && price.low52 ? {
    high52: price.high52,
    low52: price.low52
  } : undefined
  const maEvaluation = calculateMAEval(kline, price, metric52w)
  
  // 7. 综合评分
  const cedarScore = Math.round(
    trackScore * 0.25 +
    growthScore * 0.25 +
    valuationScore * 0.25 +
    riskScore * 0.25
  )
  
  // 8. Cedar 等级
  const maEval = calculateMAEval(kline, price, metric52w)

    // 9. 中美映射
    const chinaUsMapping = getChinaUsMapping(basic.symbol, basic.industry)

    // 10. 赛道归属
    const trackInfo = getIndustryTrackInfo(basic.industry)

    return {
      symbol: basic.symbol,
      name: basic.name,
      cedarScore,
      cedarLevel: getCedarLevel(cedarScore),
      trackScore,
      trackLevel: getTrackLevel(trackScore),
      growthScore,
      growthLevel: getGrowthLevel(growthScore),
      valuationScore,
      valuationLevel: getValuationLevel(valuationScore),
      valuationDetail: valuationResult.detail,
      riskScore,
      riskLevel: getRiskLevel(riskScore),
      marketTemp,
      marketTempLevel: getMarketTempLevel(marketTemp),
      maEvaluation: {
        ma30: maEval.ma30,
        ma60: maEval.ma60,
        ma120: maEval.ma120,
        ma240: maEval.ma240,
        overall: maEval.overall,
      },
      maExplanation: maEval.explanation,
      industry: basic.industry,
      industryTrack: trackInfo.track,
      industryTrackLabel: trackInfo.trackLabel,
      chinaUsMapping,
      summary: [] as DimensionSummary[],
      price: {
        current: price.current,
        change: price.change,
        changePercent: price.changePercent,
        pe: price.pe,
        pb: price.pb,
        ps: (price as any).ps ?? 0,
        peg: (price as any).peg ?? 0,
        marketCap: price.marketCap,
        roe: (price as any).roe ?? 0,
        revenueGrowth: (price as any).revenueGrowth ?? 0,
        profitGrowth: (price as any).profitGrowth ?? 0,
        analyst: (price as any).analyst ?? undefined,
        revenueGrowthCagr: (price as any).revenueGrowthCagr ?? 0,
        profitGrowthCagr: (price as any).profitGrowthCagr ?? 0,
        benchmarks: (price as any).benchmarks ?? undefined,
      },
      kline: kline as any,
      updatedAt: new Date().toISOString()
    }
}

// ===== 赛道等级：行业热度 + 资金面 映射 =====

// 行业热度基准分 (综合各平台数据:东方财富/同花顺/雪球/Wind)
const INDUSTRY_HEAT: Record<string, { heat: number; track: 'S' | 'A' | 'B' | 'C' }> = {
  // 🔥 S级热门赛道
  'AI': { heat: 95, track: 'S' }, '人工智能': { heat: 95, track: 'S' },
  'Semiconductors': { heat: 92, track: 'S' },  // 英伟达/AMD等
  'Technology': { heat: 88, track: 'S' },
  '半导体': { heat: 88, track: 'S' }, '集成电路': { heat: 90, track: 'S' },
  '芯片': { heat: 88, track: 'S' }, '算力': { heat: 88, track: 'S' },
  '低空经济': { heat: 85, track: 'S' }, '新能源汽车': { heat: 85, track: 'S' },
  'Auto Manufacturers': { heat: 85, track: 'S' },
  'Electric Vehicles': { heat: 85, track: 'S' },
  '智能汽车': { heat: 85, track: 'S' }, '机器人': { heat: 83, track: 'S' },
  'Robotics': { heat: 83, track: 'S' },
  '商业航天': { heat: 82, track: 'S' }, '光通信': { heat: 80, track: 'S' },

  // ⭐ A级成长赛道
  '电动车': { heat: 83, track: 'A' }, '云计算': { heat: 82, track: 'A' },
  'Software - Application': { heat: 82, track: 'A' }, 'Software - Infrastructure': { heat: 82, track: 'A' },
  'Innovation Technology': { heat: 80, track: 'A' },
  '创新药': { heat: 80, track: 'A' }, '医疗器械': { heat: 76, track: 'A' },
  'Biotechnology': { heat: 80, track: 'A' }, 'Pharmaceuticals': { heat: 76, track: 'A' },
  '储能': { heat: 74, track: 'A' }, '消费电子': { heat: 72, track: 'A' },
  'Consumer Electronics': { heat: 72, track: 'A' },
  '新能源': { heat: 75, track: 'A' }, '氢能源': { heat: 70, track: 'A' },
  'Clean Energy': { heat: 75, track: 'A' }, 'Solar': { heat: 68, track: 'B' },
  '生物医药': { heat: 78, track: 'A' }, '量子科技': { heat: 78, track: 'A' },
  '军工': { heat: 68, track: 'A' }, '国防军工': { heat: 68, track: 'A' },
  'Aerospace & Defense': { heat: 68, track: 'A' },
  '航空装备': { heat: 67, track: 'A' }, '软件服务': { heat: 68, track: 'A' },
  '大数据': { heat: 80, track: 'A' }, '数据中心': { heat: 75, track: 'A' },
  'Internet Software & Services': { heat: 80, track: 'A' }, 'Cloud': { heat: 80, track: 'A' },

  // 📊 B级稳定赛道
  '光伏': { heat: 68, track: 'B' }, '苹果产业链': { heat: 70, track: 'B' },
  'Electronic Components': { heat: 66, track: 'B' }, '通信设备': { heat: 65, track: 'B' },
  'Telecom Equipment': { heat: 65, track: 'B' },
  '游戏': { heat: 64, track: 'B' }, '5G': { heat: 63, track: 'B' },
  'Interactive Media & Services': { heat: 64, track: 'B' },
  '风电': { heat: 65, track: 'B' }, '互联网服务': { heat: 67, track: 'B' },
  'Healthcare': { heat: 58, track: 'B' },
  '医疗服务': { heat: 58, track: 'B' }, '中药': { heat: 52, track: 'B' },
  '化学制药': { heat: 50, track: 'B' }, '白酒': { heat: 55, track: 'B' },
  'Liquor': { heat: 55, track: 'B' },
  '化妆品': { heat: 55, track: 'B' }, '食品饮料': { heat: 55, track: 'B' },
  '家电': { heat: 52, track: 'B' }, '乳品': { heat: 50, track: 'B' },
  '证券': { heat: 50, track: 'B' }, '保险': { heat: 48, track: 'B' },

  // 📉 C级冷门赛道
  'Banks': { heat: 45, track: 'C' }, '银行': { heat: 45, track: 'C' },
  'Financials': { heat: 48, track: 'C' },
  '家居': { heat: 48, track: 'C' }, '建筑工程': { heat: 45, track: 'C' },
  '建材': { heat: 40, track: 'C' }, '电力': { heat: 40, track: 'C' },
  'Utilities': { heat: 40, track: 'C' },
  '化工': { heat: 40, track: 'C' }, 'Chemicals': { heat: 40, track: 'C' },
  '航空': { heat: 35, track: 'C' }, '机场': { heat: 38, track: 'C' },
  'Airlines': { heat: 35, track: 'C' }, 'Air Transport': { heat: 35, track: 'C' },
  '房地产': { heat: 30, track: 'C' }, '钢铁': { heat: 30, track: 'C' },
  'Real Estate': { heat: 30, track: 'C' }, 'Steel': { heat: 30, track: 'C' },
  '煤炭': { heat: 28, track: 'C' }, '石油': { heat: 35, track: 'C' },
  'Oil & Gas': { heat: 35, track: 'C' }, 'Coal': { heat: 28, track: 'C' },
  '造纸': { heat: 30, track: 'C' }, '纺织服装': { heat: 28, track: 'B' },
  '公路铁路': { heat: 32, track: 'C' }, '火电': { heat: 35, track: 'C' },
  'Retail': { heat: 50, track: 'B' }, 'REITs': { heat: 45, track: 'C' },
}

export function getIndustryTrackInfo(industry: string): {
  track: 'S' | 'A' | 'B' | 'C'
  heat: number
  heatLabel: string
  trackLabel: string
  emoji: string
  color: string
} {
  const info = INDUSTRY_HEAT[industry]
  const track = info?.track ?? 'C'
  const heat = info?.heat ?? 40
  const trackLabel = track === 'S' ? 'S级热门' : track === 'A' ? 'A级成长' : track === 'B' ? 'B级稳定' : 'C级冷门'
  const heatLabel = heat >= 80 ? '🔥 超热' : heat >= 65 ? '⭐ 热门' : heat >= 45 ? '📊 平稳' : '📉 冷门'
  const emoji = heat >= 80 ? '🔥' : heat >= 65 ? '⭐' : heat >= 45 ? '📊' : '📉'
  const color = track === 'S' ? '#ff6b35' : track === 'A' ? '#ffaa00' : track === 'B' ? '#00d68f' : '#6b7aff'
  return { track, heat, heatLabel, trackLabel, emoji, color }
}

// 资金面加成: 成交额异常放大 = 主力关注
function getCapitalBonus(volume: number, avgVolume: number): number {
  if (avgVolume <= 0) return 0
  const ratio = volume / avgVolume
  if (ratio > 5) return 20   // 5倍以上成交 → 主力爆买
  if (ratio > 3) return 15   // 3倍以上 → 大幅加仓
  if (ratio > 2) return 10   // 2倍以上 → 明显流入
  if (ratio > 1.5) return 5  // 1.5倍以上 → 温和流入
  if (ratio < 0.5) return -10 // 缩量一半 → 资金撤离
  return 0
}

// 市值规模加成 (大市值龙头 = 赛道确定性高)
function getScaleBonus(marketCap: number): number {
  if (marketCap > 1000000000000) return 10  // 万亿以上
  if (marketCap > 100000000000) return 5    // 千亿以上
  if (marketCap < 10000000000) return -5   // 百亿以下
  return 0
}

// 计算赛道综合评分: 技术面50% + 行业热度40% + 资金面10%
export function calculateTrackScore(
  price: StockData['price'],
  kline: StockData['kline'],
  industry: string
): number {
  let techScore = 50 // 技术面基准分

  // ── 技术评分 (均线系统) ──
  if (kline) {
    const closes = kline.data.map(d => d.close)
    const ma30 = kline.ma.ma30
    const ma60 = kline.ma.ma60
    const current = closes[closes.length - 1]

    if (current > ma30[ma30.length - 1]) techScore += 10
    if (current > ma60[ma60.length - 1]) techScore += 10
    if (ma30[ma30.length - 1] > ma60[ma60.length - 1]) techScore += 10
  }

  // ── 动量评分 (近期涨幅) ──
  if (price.changePercent > 8) techScore += 15
  else if (price.changePercent > 5) techScore += 10
  else if (price.changePercent > 2) techScore += 5
  else if (price.changePercent > 0) techScore += 2
  else if (price.changePercent < -8) techScore -= 15
  else if (price.changePercent < -5) techScore -= 10
  else if (price.changePercent < -2) techScore -= 5

  techScore = Math.min(100, Math.max(0, techScore))

  // ── 行业热度 ──
  const industryHeat = INDUSTRY_HEAT[industry]?.heat ?? 50

  // ── 资金面加成 ──
  const avgVolume = price.history.length >= 20
    ? price.history.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20
    : price.volume
  const capitalBonus = getCapitalBonus(price.volume, avgVolume)

  // ── 规模加成 ──
  const scaleBonus = getScaleBonus(price.marketCap)

  // ── 综合赛道分: 技术50% + 行业40% + 资金面/规模 10% ──
  const trackScore = Math.round(
    techScore * 0.50 +
    industryHeat * 0.40 +
    (50 + capitalBonus + scaleBonus) * 0.10
  )

  return Math.min(100, Math.max(0, trackScore))
}

export function getTrackLevel(score: number): 'S' | 'A' | 'B' | 'C' {
  // 综合赛道评分等级
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 50) return 'B'
  return 'C'
}

export function getTrackLevelDetail(score: number, industry: string): {
  level: 'S' | 'A' | 'B' | 'C'
  industryHeat: number
  heatLabel: string
} {
  const info = getIndustryTrackInfo(industry)
  return {
    level: getTrackLevel(score),
    industryHeat: info.heat,
    heatLabel: info.heatLabel
  }
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

function calculateValuationScore(price: StockData['price'], history: StockData['price']['history']): { score: number; detail: ScoreResult['valuationDetail'] } {
  let score = 0
  let pricePercentile = 50
  let ytdReturn: number | undefined

  // ── 维度一：股价历史分位（权重最大）──────────────────
  if (history.length >= 60) {
    const closes = history.map(d => d.close).sort((a, b) => a - b)
    const current = price.current
    const below = closes.filter(c => c <= current).length
    pricePercentile = Math.round((below / closes.length) * 100)
    if (pricePercentile <= 15) score += 40
    else if (pricePercentile <= 30) score += 30
    else if (pricePercentile <= 45) score += 20
    else if (pricePercentile <= 60) score += 5
    else if (pricePercentile <= 75) score -= 10
    else score -= 25
  } else {
    score += 15
  }

  // ── 维度二：PE（成长预期折现）────────────────────────
  if (price.pe > 0 && price.pe < 500) {
    if (price.pe <= 10) score += 20
    else if (price.pe <= 20) score += 12
    else if (price.pe <= 30) score += 5
    else if (price.pe <= 50) score -= 5
    else if (price.pe <= 100) score -= 15
    else score -= 25
  } else if (price.pe <= 0) {
    score += 5
  }

  // ── 维度三：PB（资产价值底线）────────────────────────
  if (price.pb > 0) {
    if (price.pb < 1) score += 12
    else if (price.pb < 2) score += 8
    else if (price.pb < 3) score += 3
    else if (price.pb < 5) score -= 3
    else score -= 10
  }

  // ── 维度四：PS（营收倍数）────────────────────────────
  const ps = (price as any).ps ?? 0
  if (ps > 0) {
    if (ps < 2) score += 8
    else if (ps < 5) score += 4
    else if (ps < 10) score -= 2
    else score -= 8
  }

  // ── 维度五：PEG（成长匹配度）──────────────────────────
  const peg = (price as any).peg ?? 0
  if (peg > 0) {
    if (peg <= 0.5) score += 8
    else if (peg <= 1) score += 4
    else if (peg <= 1.5) score += 0
    else if (peg <= 2.5) score -= 5
    else score -= 10
  } else if (peg < 0) {
    score += 2
  }

  // ── 计算近1年涨跌幅（K线起点 vs 当前）─────────────────
  // 优先找1年前的数据点，不足时用最旧数据点
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const cutoff = oneYearAgo.toISOString().split('T')[0]

  const ytdData = history.filter((d: any) => d.date <= cutoff)
  const startPoint = ytdData.length >= 20 ? ytdData[0] : history[0]
  if (startPoint) {
    ytdReturn = parseFloat((((price.current - startPoint.close) / startPoint.close) * 100).toFixed(1))
  }

  // ── 组装 detail ────────────────────────────────────
  const percentileLabel =
    pricePercentile <= 30 ? '偏低' :
    pricePercentile <= 70 ? '中等' : '偏高'

  const ytdReturnLabel = ytdReturn == null ? '数据不足' :
    ytdReturn > 0 ? `近1年 +${ytdReturn}%` : `近1年 ${ytdReturn}%`

  return {
    score: Math.max(0, score),
    detail: {
      pricePercentile,
      percentileLabel,
      ytdReturn,
      ytdReturnLabel,
    }
  }
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

function calculateMarketTemp(price: StockData['price'], kline: StockData['kline']): number {
  // 基于K线历史数据计算价格位置
  if (kline && kline.data.length >= 20) {
    const closes = kline.data.map(d => d.close)
    const current = closes[closes.length - 1]
    const high = Math.max(...closes)
    const low = Math.min(...closes)
    if (high > low) {
      const position = (current - low) / (high - low)
      return Math.round(position * 100)
    }
  }
  // 回退：用当日高低
  if (price.high > price.low) {
    const position = (price.current - price.low) / (price.high - price.low)
    return Math.round(position * 100)
  }
  return 50
}

function calculateMAEval(kline: StockData['kline'], price: StockData['price'], metric52w?: { high52: number; low52: number }): ScoreResult['maEvaluation'] & { explanation: ScoreResult['maExplanation'] } {
  const result: ScoreResult['maEvaluation'] = {
    ma30: 'neutral',
    ma60: 'neutral',
    ma120: 'neutral',
    ma240: 'neutral',
    overall: 'neutral'
  }

  if (!kline || kline.data.length < 10) {
    // ── 降级方案：用 52 周高低价判断当前价格位置 ──
    if (metric52w && metric52w.high52 > metric52w.low52) {
      const pos = (price.current - metric52w.low52) / (metric52w.high52 - metric52w.low52)
      if (pos >= 0.7) {
        result.ma30 = result.ma60 = result.ma120 = result.ma240 = 'bull'
        result.overall = 'bull'
      } else if (pos <= 0.3) {
        result.ma30 = result.ma60 = result.ma120 = result.ma240 = 'bear'
        result.overall = 'bear'
      }
    }
    return {
      ...result,
      explanation: { trend: '数据不足', signal: '暂无信号', advice: '等待更多数据' }
    }
  }

  const closes = kline.data.map(d => d.close)
  const current = price.current
  const ma30 = kline.ma.ma30[kline.ma.ma30.length - 1]
  const ma60 = kline.ma.ma60[kline.ma.ma60.length - 1]
  const ma120 = kline.ma.ma120[kline.ma.ma120.length - 1]
  const ma240 = kline.ma.ma240[kline.ma.ma240.length - 1]

  // 各均线方向（最近5个值的变化趋势）
  const maSlope = (arr: number[], n = 5) => {
    if (arr.length < n) return 0
    const slice = arr.slice(-n)
    return (slice[slice.length - 1] - slice[0]) / slice[0]
  }

  const ma30Slope = maSlope(kline.ma.ma30)
  const ma60Slope = maSlope(kline.ma.ma60)
  const ma120Slope = maSlope(kline.ma.ma120)
  const ma240Slope = maSlope(kline.ma.ma240)

  // 价格vs均线
  if (current > ma30) result.ma30 = 'bull'
  else if (current < ma30) result.ma30 = 'bear'

  if (current > ma60) result.ma60 = 'bull'
  else if (current < ma60) result.ma60 = 'bear'

  if (current > ma120) result.ma120 = 'bull'
  else if (current < ma120) result.ma120 = 'bear'

  if (current > ma240) result.ma240 = 'bull'
  else if (current < ma240) result.ma240 = 'bear'

  const bullish = [result.ma30, result.ma60, result.ma120, result.ma240].filter(m => m === 'bull').length
  const risingMAs = [ma30Slope, ma60Slope, ma120Slope, ma240Slope].filter(s => s > 0.005).length
  const fallingMAs = [ma30Slope, ma60Slope, ma120Slope, ma240Slope].filter(s => s < -0.005).length

  if (bullish >= 3 && risingMAs >= 3) result.overall = 'bull'
  else if (bullish <= 1 && fallingMAs >= 3) result.overall = 'bear'
  else if (bullish >= 3) result.overall = 'bull'
  else if (bullish <= 1) result.overall = 'bear'

  // ── 生成指导性解释 ──
  const aboveAll = result.ma30 === 'bull' && result.ma60 === 'bull' && result.ma120 === 'bull' && result.ma240 === 'bull'
  const belowAll = result.ma30 === 'bear' && result.ma60 === 'bear' && result.ma120 === 'bear' && result.ma240 === 'bear'

  let trend: string
  let signal: string
  let advice: string

  if (aboveAll && result.overall === 'bull') {
    trend = '多头排列，均线系统全面看涨'
    signal = '所有均线呈上升趋势，价在所有均线之上'
    advice = '持有为主，回调至MA30附近可加仓，跌破MA60需警惕'
  } else if (belowAll && result.overall === 'bear') {
    trend = '空头排列，均线系统全面看跌'
    signal = '所有均线呈下降趋势，价在所有均线之下'
    advice = '观望为主，突破MA30前不轻易入场'
  } else if (result.ma30 === 'bull' && result.ma60 === 'bull' && result.ma120 === 'bear') {
    trend = '短期反弹，中期压力'
    signal = '短线均线多头，但MA120仍构成压制'
    advice = '轻仓参与反弹，MA120处注意获利了结'
  } else if (result.ma30 === 'bear' && result.ma60 === 'bear' && result.ma120 === 'bull') {
    trend = '中期震荡，底部抬升'
    signal = '短期回调，但中长期均线仍向上'
    advice = '逢低布局，MA30收复后可加仓'
  } else if (result.overall === 'bull') {
    trend = '震荡偏多'
    signal = '多数均线多头，部分均线方向分歧'
    advice = '区间震荡操作，高抛低吸，突破后跟进'
  } else if (result.overall === 'bear') {
    trend = '震荡偏空'
    signal = '多数均线空头，短期或有反弹'
    advice = '谨慎观望，等待底部信号明确'
  } else {
    trend = '方向不明'
    signal = '多空均线交错，无明确趋势'
    advice = '观望为主，避免追涨杀跌'
  }

  return {
    ...result,
    explanation: { trend, signal, advice }
  }
}

function getCedarLevel(score: number): ScoreResult['cedarLevel'] {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 30) return 'D'
  return 'AVOID'
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