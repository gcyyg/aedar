'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, AlertTriangle,
  Activity, Loader2, ArrowRight, X, Shield,
  Thermometer, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, BarChart3, Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import ChainMap from '@/components/ChainMap'

// ── Types ──────────────────────────────────────────
interface StockPrice {
  current: number
  change: number
  changePercent: number
  pe: number
  pb: number
  marketCap: number
  ps?: number
  peg?: number
  roe?: number
  revenueGrowth?: number
  profitGrowth?: number
  history: Array<{ date: string; close: number; open?: number; high?: number; low?: number; volume?: number }>
}

interface MAEvaluation {
  ma30: 'bull' | 'bear' | 'neutral'
  ma60: 'bull' | 'bear' | 'neutral'
  ma120: 'bull' | 'bear' | 'neutral'
  ma240: 'bull' | 'bear' | 'neutral'
  overall: 'bull' | 'bear' | 'neutral'
}

interface StockData {
  symbol: string
  name: string
  cedarScore: number
  cedarLevel: 'S' | 'A' | 'B' | 'C' | 'D' | 'AVOID'
  trackScore: number
  trackLevel: 'S' | 'A' | 'B' | 'C'
  growthScore: number
  growthLevel: 'A' | 'B' | 'C' | 'D'
  valuationScore: number
  valuationLevel: 'low' | 'medium' | 'high' | 'very_high'
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'very_high'
  marketTemp: number
  marketTempLevel: 'fever' | 'warm' | 'neutral' | 'cold'
  maEvaluation: MAEvaluation
  industry: string
  industryTrack: 'S' | 'A' | 'B' | 'C'   // 赛道归属
  industryTrackLabel: string              // 赛道标签
  chinaUsMapping: string | null
  summary: string
  price: StockPrice
  updatedAt: string
  basic?: {
    area: string
    sector: string
    CEO?: string
    employees?: number
  }
}

// ── Grade Config ──────────────────────────────────────────
const gradeConfig: Record<string, { bg: string; border: string; text: string; label: string }> = {
  S: { bg: 'rgba(255,107,53,0.15)', border: 'rgba(255,107,53,0.3)', text: '#ff6b35', label: 'S级' },
  A: { bg: 'rgba(255,170,0,0.15)', border: 'rgba(255,170,0,0.3)', text: '#ffaa00', label: 'A级' },
  B: { bg: 'rgba(0,214,143,0.15)', border: 'rgba(0,214,143,0.3)', text: '#00d68f', label: 'B级' },
  C: { bg: 'rgba(107,122,255,0.15)', border: 'rgba(107,122,255,0.3)', text: '#6b7aff', label: 'C级' },
  D: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', text: 'rgba(240,240,245,0.6)', label: 'D级' },
  AVOID: { bg: 'rgba(255,61,113,0.15)', border: 'rgba(255,61,113,0.3)', text: '#ff3d71', label: '回避' },
}

const cedarLevelConfig: Record<string, { bg: string; border: string; text: string; emoji: string }> = {
  diamond: { bg: 'rgba(0,214,143,0.1)', border: 'rgba(0,214,143,0.3)', text: '#b9f2ff', emoji: '💎' },
  gold: { bg: 'rgba(255,215,0,0.1)', border: 'rgba(255,215,0,0.3)', text: '#ffd700', emoji: '🥇' },
  silver: { bg: 'rgba(192,192,192,0.1)', border: 'rgba(192,192,192,0.3)', text: '#c0c0c0', emoji: '🥈' },
  obsidian: { bg: 'rgba(139,157,195,0.1)', border: 'rgba(139,157,195,0.3)', text: '#8b9dc3', emoji: '🪨' },
  avoid: { bg: 'rgba(255,71,87,0.1)', border: 'rgba(255,71,87,0.3)', text: '#ff4757', emoji: '⚠️' },
}

// ── Utility ──────────────────────────────────────────
function formatMarketCap(cap: number) {
  if (!cap) return 'N/A'
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}万亿`
  if (cap >= 1e11) return `$${(cap / 1e11).toFixed(2)}千亿`
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}亿`
  return `$${cap.toLocaleString()}`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ── Animated Number ──────────────────────────────────────────
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    startTime.current = null
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }
    frameRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, duration])

  return <>{display.toLocaleString()}</>
}

// ── Skeleton Lines ──────────────────────────────────────────
function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-4 skeleton-bar rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
    </div>
  )
}

// ── Card Component ──────────────────────────────────────────
function Card({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`card-style ${className}`}
    >
      {children}
    </motion.div>
  )
}

// ── Card Header ──────────────────────────────────────────
function CardHeader({ icon, title, badge }: { icon: string; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm">{icon}</div>
        <span className="text-[13px] font-semibold text-white/60 tracking-wide">{title}</span>
      </div>
      {badge}
    </div>
  )
}

// ── Score Bar ──────────────────────────────────────────
function ScoreBar({ value, gradient = 'linear-gradient(90deg, #0095ff, #00d68f)' }: { value: number; gradient?: string }) {
  return (
    <div className="h-1.5 bg-white/5 rounded overflow-hidden mb-4">
      <motion.div
        className="h-full rounded"
        style={{ background: gradient }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  )
}

// ── Market Temp Badge ──────────────────────────────────────────
function MarketTempBadge({ level }: { level: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    fever: { bg: 'rgba(255,61,113,0.15)', text: '#ff3d71', label: '过热' },
    warm: { bg: 'rgba(255,107,53,0.15)', text: '#ff6b35', label: '偏热' },
    neutral: { bg: 'rgba(255,170,0,0.15)', text: '#ffaa00', label: '中性' },
    cold: { bg: 'rgba(0,149,255,0.15)', text: '#0095ff', label: '偏冷' },
  }
  const c = map[level] || map.neutral
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: c.bg, color: c.text }}>
      {c.label}
    </span>
  )
}

// ── MA Badge ──────────────────────────────────────────
function MABadge({ label, status }: { label: string; status: 'bull' | 'bear' | 'neutral' }) {
  const colors = {
    bull: 'rgba(0,214,143,0.15) text-[#00d68f] border-[rgba(0,214,143,0.3)]',
    bear: 'rgba(255,61,113,0.15) text-[#ff3d71] border-[rgba(255,61,113,0.3)]',
    neutral: 'rgba(255,255,255,0.06) text-white/40 border-white/10',
  }
  const icons = { bull: ArrowUpRight, bear: ArrowDownRight, neutral: Minus }
  const Icon = icons[status]
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium ${colors[status]}`}>
      <Icon className="w-3 h-3" />
      {label}
    </div>
  )
}

// ── Valuation Level ──────────────────────────────────────────
function ValuationLevelBadge({ level }: { level: string }) {
  const map: Record<string, { text: string; color: string; label: string }> = {
    low: { text: '#00d68f', label: '低估', color: 'rgba(0,214,143,0.15)' },
    medium: { text: '#ffaa00', label: '合理', color: 'rgba(255,170,0,0.15)' },
    high: { text: '#ff6b35', label: '偏高', color: 'rgba(255,107,53,0.15)' },
    very_high: { text: '#ff3d71', label: '高估', color: 'rgba(255,61,113,0.15)' },
  }
  const c = map[level] || map.medium
  return (
    <div className="inline-flex items-center gap-1.5 text-xl font-bold mb-4" style={{ color: c.text }}>
      {level === 'low' ? <TrendingUp className="w-5 h-5" /> : level === 'very_high' ? <TrendingDown className="w-5 h-5" /> : null}
      {c.label}
    </div>
  )
}

// ── Risk Level ──────────────────────────────────────────
function RiskLevelBadge({ level }: { level: string }) {
  const map: Record<string, { text: string; label: string }> = {
    low: { text: '#00d68f', label: '低风险' },
    medium: { text: '#ffaa00', label: '中风险' },
    high: { text: '#ff3d71', label: '高风险' },
    very_high: { text: '#ff3d71', label: '极高风险' },
  }
  const c = map[level] || map.medium
  return (
    <div className="inline-flex items-center gap-1.5 text-lg font-bold mb-4" style={{ color: c.text }}>
      <Shield className="w-4 h-4" />
      {c.label}
    </div>
  )
}

// ── Temp Gauge ──────────────────────────────────────────
function TempGauge({ value }: { value: number }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value > 70 ? '#ff3d71' : value > 40 ? '#ffaa00' : '#0095ff'

  return (
    <div className="relative w-20 h-20">
      <svg width="80" height="80" viewBox="0 0 80 80" className="transform -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold font-mono" style={{ color }}>{value}</span>
        <span className="text-[9px] text-white/30 uppercase tracking-widest">°C</span>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────
export default function Home() {
  const [query, setQuery] = useState('')
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const handleSearch = async (q: string) => {
    if (!q.trim()) return
    setIsLoading(true)
    setError('')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)
    try {
      const res = await fetch(`/api/stock/${encodeURIComponent(q.trim())}`, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '请求失败' }))
        throw new Error(err.error || '请求失败')
      }
      const data = await res.json()
      setStockData(data)
      setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setError('请求超时（30秒），后端可能卡住')
      } else {
        setError(e.message || '网络错误')
      }
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleQuickSearch = (code: string) => {
    setQuery(code)
    handleSearch(code)
  }

  const handleClear = () => {
    setQuery('')
    setStockData(null)
    setError('')
  }

  const g = stockData ? gradeConfig[stockData.cedarLevel] : null
  const cedarEmoji = stockData?.cedarLevel === 'S' ? '💎' : stockData?.cedarLevel === 'A' ? '🥇' : stockData?.cedarLevel === 'B' ? '🥈' : stockData?.cedarLevel === 'C' ? '🪨' : '⚠️'

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0095ff] to-[#00d68f] flex items-center justify-center text-base font-bold">🌲</div>
            <div>
              <div className="text-[15px] font-semibold tracking-wide">CEDAR<span className="text-white/30 font-light">AI</span></div>
              <div className="text-[10px] text-white/30 tracking-widest uppercase">投资决策系统</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[11px] text-[#00d68f] bg-[rgba(0,214,143,0.1)] border border-[rgba(0,214,143,0.2)] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d68f] animate-pulse" />
              LIVE
            </div>
            {lastUpdated && (
              <span className="text-[11px] text-white/30 font-mono">
                更新 {lastUpdated}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <div className="max-w-xl mx-auto text-center">
            <label className="text-[11px] text-white/30 tracking-widest uppercase block mb-3">
              输入股票代码或名称
            </label>
            <div className="flex bg-[rgba(15,15,25,0.8)] border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-[#0095ff] focus-within:shadow-[0_0_0_3px_rgba(0,149,255,0.1)] transition-all">
              <div className="flex items-center px-4 text-[#0095ff] font-medium border-r border-white/[0.08] bg-[rgba(0,149,255,0.05)]">
                <span className="text-base">$</span>
              </div>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
                placeholder="NVDA, AAPL, 600519..."
                className="flex-1 bg-transparent px-5 py-4 text-[18px] font-mono font-medium text-white outline-none placeholder:text-white/30 placeholder:font-normal"
              />
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center px-5 text-white/50 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#0095ff]" />
                    查询中...
                  </motion.div>
                ) : stockData || error ? (
                  <motion.button key="clear" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={handleClear}
                    className="px-4 hover:bg-white/5 transition-colors text-white/40 hover:text-white/70">
                    <X className="w-5 h-5" />
                  </motion.button>
                ) : (
                  <motion.button key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={() => handleSearch(query)}
                    className="px-5 bg-gradient-to-r from-[#0095ff] to-[#0077cc] text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    分析
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {['NVDA', 'AAPL', 'TSLA', 'MSFT', '600519', '300750'].map(code => (
                <button key={code} onClick={() => handleQuickSearch(code)}
                  className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#0095ff]/50 hover:text-[#0095ff] hover:bg-[#0095ff]/10 transition-all">
                  {code}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mb-6 p-4 rounded-xl bg-[rgba(255,61,113,0.1)] border border-[rgba(255,61,113,0.3)] flex items-center gap-3 text-[#ff3d71]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results Grid (always visible with skeletons) ── */}
        <div className="grid grid-cols-12 gap-4">

          {/* ── Basic Info (span-8) ── */}
          <div className="card-style col-span-12 lg:col-span-8">
            <CardHeader icon="📊" title="基础信息" />
            <div className="flex items-center gap-3 mb-5">
              <div className={`${isLoading ? 'skeleton-bar skeleton-name' : 'text-2xl font-bold'} transition-opacity`}>
                {isLoading ? <div className="h-8 w-48 skeleton-bar" /> : stockData ? stockData.name : ''}
              </div>
              {stockData && (
                <>
                  <span className="text-sm font-mono text-white/50">{stockData.symbol}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50">
                    {stockData.basic?.area || (stockData.symbol.match(/^(sh|sz|600|601|603|000|001|002|688|430|300)/i) ? '中国' : '美国')}
                  </span>
                  {stockData.industryTrack && (
                    <span className="text-[11px] px-2 py-0.5 rounded" style={{ background: stockData.industryTrack === 'S' ? 'rgba(255,107,53,0.1)' : stockData.industryTrack === 'A' ? 'rgba(255,170,0,0.1)' : stockData.industryTrack === 'B' ? 'rgba(0,214,143,0.1)' : 'rgba(107,122,255,0.1)', border: stockData.industryTrack === 'S' ? '1px solid rgba(255,107,53,0.3)' : stockData.industryTrack === 'A' ? '1px solid rgba(255,170,0,0.3)' : stockData.industryTrack === 'B' ? '1px solid rgba(0,214,143,0.3)' : '1px solid rgba(107,122,255,0.3)', color: stockData.industryTrack === 'S' ? '#ff6b35' : stockData.industryTrack === 'A' ? '#ffaa00' : stockData.industryTrack === 'B' ? '#00d68f' : '#6b7aff' }}>
                      {stockData.industryTrack}级赛道
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(isLoading ? Array(9).fill(null) : [
                { label: '当前价格', value: `$${stockData?.price.current?.toFixed(2) || 'N/A'}`, extra: stockData && (stockData.price.changePercent > 0 ? `+${stockData.price.changePercent.toFixed(2)}%` : `${stockData.price.changePercent.toFixed(2)}%`), isGain: stockData ? stockData.price.changePercent >= 0 : null },
                { label: '市值', value: formatMarketCap(stockData?.price.marketCap ?? 0), extra: null, isGain: null },
                { label: 'PE', value: stockData?.price.pe ? stockData.price.pe.toFixed(1) : 'N/A', extra: null, isGain: null },
                { label: 'ROE', value: stockData?.price.roe ? `${stockData.price.roe.toFixed(1)}%` : 'N/A', extra: null, isGain: stockData?.price.roe ? stockData.price.roe > 0 : null },
                { label: 'PS', value: stockData?.price.ps ? stockData.price.ps.toFixed(1) : 'N/A', extra: null, isGain: null },
                { label: 'PEG', value: stockData?.price.peg ? stockData.price.peg.toFixed(2) : 'N/A', extra: null, isGain: null },
                { label: '营收增长', value: stockData?.price.revenueGrowth ? `${stockData.price.revenueGrowth > 0 ? '+' : ''}${stockData.price.revenueGrowth.toFixed(1)}%` : 'N/A', extra: null, isGain: stockData?.price.revenueGrowth ? stockData.price.revenueGrowth > 0 : null },
                { label: '利润增长', value: stockData?.price.profitGrowth ? `${stockData.price.profitGrowth > 0 ? '+' : ''}${stockData.price.profitGrowth.toFixed(1)}%` : 'N/A', extra: null, isGain: stockData?.price.profitGrowth ? stockData.price.profitGrowth > 0 : null },
                { label: '市净率', value: stockData?.price.pb ? stockData.price.pb.toFixed(1) : 'N/A', extra: null, isGain: null },
              ]).map((item, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                  <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{item?.label || ''}</div>
                  {isLoading ? (
                    <div className="h-6 w-20 skeleton-bar rounded" />
                  ) : (
                    <div className={`text-lg font-bold font-mono ${item?.isGain === true ? 'text-[#00d68f]' : item?.isGain === false ? 'text-[#ff3d71]' : 'text-white'}`}>
                      {item?.value}
                    </div>
                  )}
                  {item?.extra && !isLoading && (
                    <div className={`text-[10px] font-mono mt-0.5 ${item.isGain ? 'text-[#00d68f]/60' : 'text-[#ff3d71]/60'}`}>{item.extra}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Track Score (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="🏆" title="赛道评分" badge={
              isLoading ? <div className="h-5 w-10 skeleton-bar rounded" /> :
              stockData ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: stockData.industryTrack === 'S' ? 'rgba(255,107,53,0.1)' : stockData.industryTrack === 'A' ? 'rgba(255,170,0,0.1)' : stockData.industryTrack === 'B' ? 'rgba(0,214,143,0.1)' : 'rgba(107,122,255,0.1)', color: stockData.industryTrack === 'S' ? '#ff6b35' : stockData.industryTrack === 'A' ? '#ffaa00' : stockData.industryTrack === 'B' ? '#00d68f' : '#6b7aff', border: stockData.industryTrack === 'S' ? '1px solid rgba(255,107,53,0.3)' : stockData.industryTrack === 'A' ? '1px solid rgba(255,170,0,0.3)' : stockData.industryTrack === 'B' ? '1px solid rgba(0,214,143,0.3)' : '1px solid rgba(107,122,255,0.3)' }}>{stockData.industryTrack}级</span>
                  {stockData.industry && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50">{stockData.industry}</span>
                  )}
                </div>
              ) : null
            } />
            {isLoading ? (
              <>
                <div className="h-14 w-24 skeleton-bar rounded mb-4" />
                <div className="h-1.5 w-full skeleton-bar rounded mb-4" />
                <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-4 w-full skeleton-bar rounded" />)}</div>
              </>
            ) : stockData ? (
              <>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-bold">{stockData.trackScore}</span>
                  <span className="text-sm text-white/30">/ 100</span>
                </div>
                <ScoreBar value={stockData.trackScore} gradient="linear-gradient(90deg, #ff6b35, #ffaa00)" />
                <div className="flex flex-col gap-2">
                  {[
                    { label: '行业热度', value: Math.round(stockData.trackScore * 0.95), color: '#ff6b35' },
                    { label: '技术动能', value: Math.round(stockData.trackScore * 0.85), color: '#0095ff' },
                    { label: '资金流入', value: Math.round(stockData.trackScore * 0.8), color: '#00d68f' },
                  ].map(d => (
                    <div key={d.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-white/50">{d.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1 bg-white/[0.06] rounded overflow-hidden">
                          <div className="h-full rounded" style={{ width: `${d.value}%`, background: d.color }} />
                        </div>
                        <span className="font-mono font-semibold" style={{ color: d.color }}>{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <SkeletonLines count={3} />}
          </div>

          {/* ── Track Attribution (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="🎯" title="赛道归属" />
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 skeleton-bar rounded" />)}</div>
            ) : stockData ? (
              <div className="space-y-3">
                {/* 赛道级别标签 */}
                <div className="flex items-center gap-3 p-3 rounded-xl border" style={{
                  background: stockData.industryTrack === 'S' ? 'rgba(255,107,53,0.1)' :
                             stockData.industryTrack === 'A' ? 'rgba(255,170,0,0.1)' :
                             stockData.industryTrack === 'B' ? 'rgba(0,214,143,0.1)' :
                             'rgba(107,122,255,0.1)',
                  borderColor: stockData.industryTrack === 'S' ? 'rgba(255,107,53,0.3)' :
                               stockData.industryTrack === 'A' ? 'rgba(255,170,0,0.3)' :
                               stockData.industryTrack === 'B' ? 'rgba(0,214,143,0.3)' :
                               'rgba(107,122,255,0.3)'
                }}>
                  <span className="text-3xl font-bold" style={{
                    color: stockData.industryTrack === 'S' ? '#ff6b35' :
                           stockData.industryTrack === 'A' ? '#ffaa00' :
                           stockData.industryTrack === 'B' ? '#00d68f' : '#6b7aff'
                  }}>{stockData.industryTrack}</span>
                  <div>
                    <div className="text-sm font-semibold" style={{
                      color: stockData.industryTrack === 'S' ? '#ff6b35' :
                             stockData.industryTrack === 'A' ? '#ffaa00' :
                             stockData.industryTrack === 'B' ? '#00d68f' : '#6b7aff'
                    }}>{stockData.industryTrackLabel}</div>
                    <div className="text-[11px] text-white/50">{stockData.industry}</div>
                  </div>
                </div>
                {/* 赛道说明 */}
                <div className="text-[11px] text-white/40 px-1">
                  {stockData.industryTrack === 'S' ? '🔥 热门赛道 · 高资金追捧 · 高波动高收益' :
                   stockData.industryTrack === 'A' ? '⭐ 成长赛道 · 行业景气向上 · 机构配置' :
                   stockData.industryTrack === 'B' ? '📊 稳定赛道 · 估值合理 · 防御性较强' :
                   '📉 冷门赛道 · 资金关注度低 · 需谨慎观望'}
                </div>
              </div>
            ) : <SkeletonLines count={2} />}
          </div>

          {/* ── Growth Score (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="📈" title="成长性分析" badge={
              isLoading ? <div className="h-5 w-10 skeleton-bar rounded" /> :
              stockData ? <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(0,214,143,0.15)', color: '#00d68f', border: '1px solid rgba(0,214,143,0.3)' }}>强势</span> : null
            } />
            {isLoading ? (
              <>
                <div className="h-14 w-24 skeleton-bar rounded mb-4" />
                <div className="h-1.5 w-full skeleton-bar rounded mb-4" />
                <div className="flex flex-col gap-2">{[1,2,3].map(i => <div key={i} className="h-4 w-full skeleton-bar rounded" />)}</div>
              </>
            ) : stockData ? (
              <>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-5xl font-bold">{stockData.growthScore}</span>
                  <span className="text-sm text-white/30">/ 100</span>
                </div>
                <ScoreBar value={stockData.growthScore} gradient="linear-gradient(90deg, #0095ff, #00d68f)" />
                <div className="flex flex-col gap-2">
                  {[{ label: '收入增速', value: Math.round(stockData.growthScore * 0.95) }, { label: '利润增速', value: Math.round(stockData.growthScore * 0.9) }, { label: '行业增速', value: Math.round(stockData.growthScore * 0.85) }].map(d => (
                    <div key={d.label} className="flex items-center justify-between text-[12px]">
                      <span className="text-white/50">{d.label}</span>
                      <span className="font-mono font-semibold text-[#00d68f]">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <SkeletonLines count={3} />}
          </div>

          {/* ── Valuation (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="💰" title="估值分析" />
            {isLoading ? (
              <>
                <div className="h-7 w-16 skeleton-bar rounded mb-4" />
                <div className="h-1.5 w-full skeleton-bar rounded mb-4" />
                <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="h-14 skeleton-bar rounded" />)}</div>
              </>
            ) : stockData ? (
              <>
                <ValuationLevelBadge level={stockData.valuationLevel} />
                <ScoreBar value={stockData.valuationScore} gradient="linear-gradient(90deg, #00d68f, #ffaa00)" />
                <div className="grid grid-cols-2 gap-2">
                  {[{ label: 'PE', value: stockData.price.pe ? stockData.price.pe.toFixed(1) : 'N/A' }, { label: 'PS', value: stockData.price.ps ? stockData.price.ps.toFixed(1) : 'N/A' }, { label: 'PEG', value: stockData.price.peg ? stockData.price.peg.toFixed(2) : 'N/A' }, { label: 'PB', value: stockData.price.pb ? stockData.price.pb.toFixed(1) : 'N/A' }].map(m => (
                    <div key={m.label} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">{m.label}</div>
                      <div className="text-lg font-bold font-mono">{m.value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : <SkeletonLines count={4} />}
          </div>

          {/* ── Risk Score (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="⚠️" title="风险分析" />
            {isLoading ? (
              <>
                <div className="h-7 w-20 skeleton-bar rounded mb-4" />
                <div className="h-1.5 w-full skeleton-bar rounded mb-4" />
                <div className="flex flex-col gap-2">{[1,2,3,4].map(i => <div key={i} className="h-5 w-full skeleton-bar rounded" />)}</div>
              </>
            ) : stockData ? (
              <>
                <RiskLevelBadge level={stockData.riskLevel} />
                <ScoreBar value={stockData.riskScore} gradient="linear-gradient(90deg, #00d68f, #ffaa00, #ff3d71)" />
                <div className="flex flex-col gap-2">
                  {[{ label: '负债水平', status: stockData.riskScore > 70 ? 'bad' : stockData.riskScore > 40 ? 'warn' : 'ok', text: stockData.riskScore > 70 ? '高' : stockData.riskScore > 40 ? '中' : '低' }, { label: '现金流', status: 'ok', text: '充裕' }, { label: '行业竞争', status: stockData.riskScore > 60 ? 'warn' : 'ok', text: stockData.riskScore > 60 ? '激烈' : '稳定' }, { label: '政策风险', status: stockData.riskScore > 50 ? 'warn' : 'ok', text: stockData.riskScore > 50 ? '中等' : '低' }].map(f => {
                    const colors: Record<string, string> = { ok: 'bg-[rgba(0,214,143,0.15)] text-[#00d68f]', warn: 'bg-[rgba(255,170,0,0.15)] text-[#ffaa00]', bad: 'bg-[rgba(255,61,113,0.15)] text-[#ff3d71]' }
                    return (
                      <div key={f.label} className="flex items-center justify-between text-[12px]">
                        <span className="text-white/50 flex items-center gap-1.5"><Shield className="w-3 h-3" />{f.label}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors[f.status]}`}>{f.text}</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : <SkeletonLines count={4} />}
          </div>

          {/* ── Market Temperature (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="🌡️" title="市场温度" />
            {isLoading ? (
              <div className="flex items-center gap-5 mb-5">
                <div className="w-20 h-20 rounded-full skeleton-bar" />
                <div className="flex flex-col gap-2 flex-1">{[1,2,3].map(i => <div key={i} className="h-5 skeleton-bar rounded" />)}</div>
              </div>
            ) : stockData ? (
              <>
                <div className="flex items-center gap-5 mb-5">
                  <TempGauge value={stockData.marketTemp} />
                  <div>
                    <div className="text-2xl font-bold mb-1" style={{ color: stockData.marketTemp > 70 ? '#ff3d71' : stockData.marketTemp > 40 ? '#ffaa00' : '#0095ff' }}>
                      {stockData.marketTempLevel === 'fever' ? '🔥 高温' : stockData.marketTempLevel === 'warm' ? '🌡️ 偏热' : stockData.marketTempLevel === 'cold' ? '❄️ 偏冷' : '🌤️ 中性'}
                    </div>
                    <div className="text-[11px] text-white/30">技术面 · 基本面 · 资金面</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[{ label: '技术面', value: stockData.trackScore, color: '#ff3d71' }, { label: '基本面', value: stockData.growthScore, color: '#0095ff' }, { label: '资金面', value: 100 - stockData.riskScore, color: '#00d68f' }].map(d => (
                    <div key={d.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-white/30">{d.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1 bg-white/[0.06] rounded overflow-hidden"><div className="h-full rounded" style={{ width: `${d.value}%`, background: d.color }} /></div>
                        <span className="font-mono font-semibold w-6 text-right">{d.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <SkeletonLines count={3} />}
          </div>

          {/* ── China-US Mapping (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="🔗" title="中美映射" />
            {isLoading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-8 skeleton-bar rounded" />)}</div>
            ) : stockData?.chinaUsMapping ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08]">{stockData.symbol}</span>
                <span className="text-white/30">→</span>
                <span className="text-sm text-white/70">{stockData.chinaUsMapping}</span>
              </div>
            ) : !isLoading && <div className="text-sm text-white/30 text-center py-6">暂无中美映射信息</div>}
          </div>

          {/* ── Comprehensive Score (span-12) ── */}
          <div className="card-style col-span-12 comprehensive-card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">💎 杉树综合评分</h3>
                <span className="text-[12px] text-white/30 mt-1 block">赛道20% · 成长20% · 估值20% · 风险20% · 趋势20%</span>
              </div>
              <div className="flex items-center gap-4">
                {isLoading ? (
                  <div className="h-20 w-24 skeleton-bar rounded" />
                ) : stockData ? (
                  <div className="text-7xl font-bold font-mono bg-gradient-to-r from-[#b9f2ff] to-[#ffd700] bg-clip-text text-transparent">{stockData.cedarScore}</div>
                ) : (
                  <div className="h-20 w-24 skeleton-bar rounded" />
                )}
                {stockData && (
                  <div className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border" style={{ background: g?.bg, borderColor: g?.border }}>
                    <span className="text-2xl">{cedarEmoji}</span>
                    <span className="text-[11px] font-bold" style={{ color: g?.text }}>{stockData.cedarLevel}级</span>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
              {(isLoading || !stockData ? [1,2,3,4,5] : [
                { label: '赛道 20%', value: stockData.trackScore, max: 20, gradient: 'linear-gradient(90deg, #ff6b35, #ffaa00)' },
                { label: '成长 20%', value: stockData.growthScore, max: 20, gradient: 'linear-gradient(90deg, #0095ff, #00d68f)' },
                { label: '估值 20%', value: stockData.valuationScore, max: 20, gradient: 'linear-gradient(90deg, #00d68f, #ffaa00)' },
                { label: '风险 20%', value: 100 - stockData.riskScore, max: 20, gradient: 'linear-gradient(90deg, #ffaa00, #ff3d71)' },
                { label: '趋势 20%', value: stockData.trackScore, max: 20, gradient: 'linear-gradient(90deg, #00d68f, #0095ff)' },
              ]).map((item: any, i: number) => {
                const pct = typeof item === 'number' ? 0 : (item.value / 100) * 100
                const earned = typeof item === 'number' ? null : Math.round((item.value / 100) * item.max * 10) / 10
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-white/40">{typeof item === 'number' ? '' : item.label}</span>
                      <span className="font-mono font-semibold text-white/60">{earned !== null ? `${earned}/${item.max}` : '--'}</span>
                    </div>
                    {isLoading ? (
                      <div className="h-1.5 w-full skeleton-bar rounded" />
                    ) : (
                      <div className="h-1.5 bg-white/[0.06] rounded overflow-hidden mb-1">
                        <div className="h-full rounded transition-all duration-1000" style={{ width: `${pct}%`, background: item.gradient }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── MA Evaluation (span-6) ── */}
          <div className="card-style col-span-12 lg:col-span-6">
            <CardHeader icon="📉" title="均线评估" />
            <div className="grid grid-cols-4 gap-2">
              {(isLoading ? Array(4).fill(null) : [
                { label: 'MA30', status: stockData?.maEvaluation.ma30 },
                { label: 'MA60', status: stockData?.maEvaluation.ma60 },
                { label: 'MA120', status: stockData?.maEvaluation.ma120 },
                { label: 'MA240', status: stockData?.maEvaluation.ma240 },
              ]).map((m: any, i: number) => {
                const textColor = m?.status === 'bull' ? '#00d68f' : m?.status === 'bear' ? '#ff3d71' : 'rgba(240,240,245,0.4)'
                return (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                    <div className="text-[10px] text-white/30 mb-1">{m?.label || ''}</div>
                    {isLoading ? (
                      <div className="h-5 w-16 mx-auto skeleton-bar rounded" />
                    ) : (
                      <div className="text-base font-bold font-mono" style={{ color: textColor }}>
                        {m?.status === 'bull' ? '↗ 多头' : m?.status === 'bear' ? '↘ 空头' : '— 中性'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {!isLoading && stockData && (
              <div className="mt-4 flex items-center justify-between text-[12px]">
                <span className="text-white/40">综合判断</span>
                <span className="font-bold flex items-center gap-1" style={{ color: stockData.maEvaluation.overall === 'bull' ? '#00d68f' : stockData.maEvaluation.overall === 'bear' ? '#ff3d71' : 'rgba(240,240,245,0.4)' }}>
                  {stockData.maEvaluation.overall === 'bull' ? '↗ 上涨趋势' : stockData.maEvaluation.overall === 'bear' ? '↘ 下跌趋势' : '— 横盘震荡'}
                </span>
              </div>
            )}
          </div>

          {/* ── Industry Map (span-6) ── */}
          <div className="col-span-12 lg:col-span-6">
            {stockData ? (
              <ChainMap symbol={stockData.symbol} />
            ) : isLoading ? (
              <div className="card-style">
                <CardHeader icon="🗺️" title="产业链地图" />
                <div className="h-96 skeleton-bar rounded" />
              </div>
            ) : (
              <div className="card-style">
                <CardHeader icon="🗺️" title="产业链地图" />
                <div className="h-48 flex items-center justify-center text-white/30 text-sm">
                  输入股票代码查看产业链地图
                </div>
              </div>
            )}
          </div>

          {/* ── AI Summary (span-12) ── */}
          <div className="card-style col-span-12">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h3 className="text-[15px] font-semibold">AI 投资总结</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(0,149,255,0.15)] text-[#0095ff] border border-[rgba(0,149,255,0.3)] font-medium">MiniMax-M2</span>
              </div>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-4 skeleton-bar rounded" style={{ width: `${70 + Math.random() * 30}%` }} />)}
              </div>
            ) : (
              <div className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                {stockData?.summary || '输入股票代码开始分析...'}
              </div>
            )}
            {stockData && (
              <div className="mt-4 p-3 rounded-lg bg-[rgba(255,170,0,0.08)] border border-[rgba(255,170,0,0.2)]">
                <div className="text-[11px] text-[#ffaa00] flex items-start gap-2">
                  <span>⚠️</span>
                  <span><strong>风险提示：</strong>本分析仅供信息参考，不构成任何投资建议。请根据个人风险承受能力独立判断。</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
