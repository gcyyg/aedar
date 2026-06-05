'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, AlertTriangle,
  Activity, Loader2, ArrowRight, X, Shield,
  Thermometer, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, BarChart3, Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import ChainMap from '@/components/ChainMap'
import AnalysisButtons from '@/components/AnalysisPanel'

// ── Types ──────────────────────────────────────────
interface SearchResult {
  symbol: string
  name: string
  market: string
}
interface KLineData {
  data: { date: string; open: number; high: number; low: number; close: number; volume: number }[]
  ma: Record<string, number[]>
}
interface StockData {
  symbol: string
  name: string
  sector: string
  industry: string
  marketCap: string
  cedarScore: number
  cedarLevel: string
  trackScore: number
  trackLevel: string
  growthScore: number
  growthLevel: string
  valuationScore: number
  valuationLevel: string
  valuationDetail: { label: string; value: string; level: string }[]
  riskScore: number
  riskLevel: string
  riskDetail: { label: string; value: string; level: string }[]
  marketTemp: number
  marketTempLevel: string
  maEvaluation: { ma30: string; ma60: string; ma120: string; ma240: string; overall: string }
  summary: { dimension: string; label: string; icon: string; summary: string }[]
  fundamentals: { label: string; value: string }[]
  price: {
    current: number; change: number; changePercent: number
    pe: number; pb: number; ps: number; peg: number; roe: number
    marketCap: number; revenueGrowth: number; profitGrowth: number
    revenueGrowthCagr?: number; profitGrowthCagr?: number
  }
  kline?: KLineData
  chinaUsMapping: string | null
  industryTrack: string
  industryTrackLabel: string
  peerBenchmarks?: { symbol: string; name: string; marketCap: number; pe: number; roe: number; revenueGrowth: number; profitGrowth: number }[]
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

const THEME = '#ff3d71'

// ── Utility ─────────────────────────────────────────
function formatMarketCap(cap: number) {
  if (!cap) return 'N/A'
  if (cap >= 10000) return `¥${(cap / 10000).toFixed(2)}万亿`
  if (cap >= 100) return `¥${cap.toFixed(2)}亿`
  return `¥${cap.toFixed(2)}亿`
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
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
function MABadge({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    bull: 'rgba(0,214,143,0.15) text-[#00d68f] border-[rgba(0,214,143,0.3)]',
    bear: 'rgba(255,61,113,0.15) text-[#ff3d71] border-[rgba(255,61,113,0.3)]',
    neutral: 'rgba(255,255,255,0.06) text-white/40 border-white/10',
  }
  const icons: Record<string, any> = { bull: ArrowUpRight, bear: ArrowDownRight, neutral: Minus }
  const Icon = icons[status] || Minus
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium ${colors[status] || colors.neutral}`}>
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

// ── Stock Chart (lightweight-charts v5) ────────────────────────────────────────
function StockChart({ kline }: { kline: KLineData }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || !kline?.data?.length) return
    const container = containerRef.current
    let mounted = true

    // Helper: convert YYYY-MM-DD → YYYYMMDD integer
    const toTime = (dateStr: string) => parseInt(dateStr.replace(/-/g, ''), 10)

    const init = async () => {
      try {
        const lwc = await import('lightweight-charts') as any
        const createChart = lwc.createChart || (lwc as any).createChart
        if (!createChart) { console.error('[Chart] createChart not found'); return }
        if (!mounted) return

        const w = container.clientWidth || 600
        const mainH = 260
        const volH = 70
        const totalH = mainH + volH + 24

        // Main candlestick chart
        const mainChart = createChart(container, {
          width: w,
          height: totalH,
          layout: {
            background: { type: 'solid', color: '#0d0d12' },
            textColor: 'rgba(240,240,245,0.45)',
            fontSize: 10,
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.03)' },
            horzLines: { color: 'rgba(255,255,255,0.03)' },
          },
          crosshair: {
            mode: 0,
            vertLine: { color: 'rgba(0,149,255,0.5)', labelBackgroundColor: '#0095ff' },
            horzLine: { color: 'rgba(0,149,255,0.5)', labelBackgroundColor: '#0095ff' },
          },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.06)',
            timeVisible: true,
            tickMarkFormatter: (time: number) => {
              const s = String(time)
              return `${s.slice(4,6)}/${s.slice(6,8)}`
            },
          },
          handleScale: { mouseWheel: true, pinch: true },
          handleScroll: { mouseWheel: true, pressedMouseMove: true },
        })
        if (!mounted) { mainChart.remove(); return }
        chartRef.current = mainChart

        // K线蜡烛图
        const candleData = kline.data.map(d => ({
          time: toTime(d.date),
          open: d.open, high: d.high, low: d.low, close: d.close,
        }))
        const candleSeries = mainChart.addCandlestickSeries({
          upColor: '#00d68f', downColor: '#ff3d71',
          borderUpColor: '#00d68f', borderDownColor: '#ff3d71',
          wickUpColor: '#00d68f', wickDownColor: '#ff3d71',
        })
        candleSeries.setData(candleData)

        // MA均线
        const maConfigs = [
          { key: 'ma30',  color: '#ff6b35', lineWidth: 1 },
          { key: 'ma60',  color: '#0095ff', lineWidth: 1 },
          { key: 'ma120', color: '#ffaa00', lineWidth: 1.5 },
          { key: 'ma240', color: '#a855f7', lineWidth: 1 },
        ]
        for (const { key, color, lineWidth } of maConfigs) {
          const maArr = (kline.ma as any)?.[key]
          if (!maArr) continue
          const lineData: any[] = []
          kline.data.forEach((d, i) => {
            if (maArr[i] != null) {
              lineData.push({ time: toTime(d.date), value: maArr[i] })
            }
          })
          if (lineData.length > 0) {
            mainChart.addLineSeries({ color, lineWidth, title: key.toUpperCase() }).setData(lineData)
          }
        }

        // 成交量副图
        const volContainer = document.createElement('div')
        volContainer.style.cssText = `position:absolute;bottom:0;left:0;width:${w}px;height:${volH}px;background:#0d0d12;`
        container.appendChild(volContainer)

        const volChart = createChart(volContainer, {
          width: w,
          height: volH,
          layout: {
            background: { type: 'solid', color: 'transparent' },
            textColor: 'rgba(240,240,245,0.35)',
            fontSize: 9,
          },
          grid: {
            vertLines: { visible: false },
            horzLines: { color: 'rgba(255,255,255,0.02)' },
          },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
          timeScale: { visible: false },
          crosshair: { mode: 0 },
        })

        const volSeries = volChart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: '',
        })
        volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.15, bottom: 0 } })
        volSeries.setData(kline.data.map(d => ({
          time: toTime(d.date),
          value: d.volume ?? 0,
          color: d.close >= d.open ? 'rgba(0,214,143,0.45)' : 'rgba(255,61,113,0.45)',
        })))

        mainChart.timeScale().fitContent()

        // ResizeObserver
        const ro = new ResizeObserver(() => {
          if (!chartRef.current || !container) return
          const nw = container.clientWidth
          mainChart.applyOptions({ width: nw })
          volChart.applyOptions({ width: nw })
        })
        ro.observe(container)

        return () => {
          mounted = false
          ro.disconnect()
          try { volChart.remove() } catch {}
          try { mainChart.remove() } catch {}
          chartRef.current = null
        }
      } catch (e) {
        console.error('[Chart] init error:', e)
      }
    }

    const cleanup = init()
    return () => {
      mounted = false
      if (cleanup && typeof cleanup.then !== 'undefined') {
        cleanup.then((fn: any) => fn && fn())
      }
    }
  }, [kline])

  return <div ref={containerRef} className="w-full" style={{ height: 358, background: '#0d0d12', borderRadius: 8 }} />
}

// ── Main Page ──────────────────────────────────────────
export default function CnPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('cedar_recent_cn') || '[]') } catch { return [] }
    }
    return []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [klineData, setKlineData] = useState<KLineData | null>(null)
  const [klineLoading, setKlineLoading] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const cnDefaults = ['600519', '600036', '000858', '601318', '600276', '300750', '688981', '600309']

  // ── 异步加载K线数据 ──────────────────────────────────────────
  useEffect(() => {
    if (!stockData?.symbol) return
    setKlineData(null)
    setKlineLoading(true)
    const controller = new AbortController()
    fetch(`/cn/api/stock/kline/${stockData.symbol}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.kline) setKlineData(d.kline)
      })
      .catch(() => {})
      .finally(() => setKlineLoading(false))
    return () => controller.abort()
  }, [stockData?.symbol])

  const handleSearchInputChange = useCallback((value: string) => {
    setQuery(value)
    if (!value.trim() || value.trim().length < 1) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/cn/api/stock/search?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results || [])
          setShowDropdown(true)
        }
      } catch {}
    }, 300)
  }, [])

  const addRecent = (code: string) => {
    const normalized = code.trim().toUpperCase()
    setRecentSearches(prev => {
      const filtered = prev.filter(c => c !== normalized)
      const next = [normalized, ...filtered].slice(0, 8)
      if (typeof window !== 'undefined') localStorage.setItem('cedar_recent_cn', JSON.stringify(next))
      return next
    })
  }

  const handleSearch = async (q: string) => {
    if (!q.trim()) return
    addRecent(q)
    setIsLoading(true)
    setError('')
    setShowDropdown(false)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    try {
      let symbol = q.trim()
      const searchRes = await fetch(`/cn/api/stock/search?q=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        if (searchData.results?.length > 0) symbol = searchData.results[0].symbol
      }

      const stockRes = await fetch(`/cn/api/stock/${encodeURIComponent(symbol)}`, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!stockRes.ok) {
        const err = await stockRes.json().catch(() => ({ error: '请求失败' }))
        throw new Error(err.error || '请求失败')
      }
      const data = await stockRes.json()
      setStockData(data)
      setLastUpdated(new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch (e: any) {
      if (e.name === 'AbortError') setError('请求超时（30秒），请稍后重试')
      else setError(e.message || '网络错误')
    } finally {
      clearTimeout(timeoutId)
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setQuery('')
    setStockData(null)
    setError('')
  }

  const handleQuickSearch = (code: string) => {
    setQuery(code)
    handleSearch(code)
  }

  const g = stockData ? gradeConfig[stockData.cedarLevel] || gradeConfig.D : null
  const cedarEmoji = stockData?.cedarLevel === 'S' ? '💎' : stockData?.cedarLevel === 'A' ? '🥇' : stockData?.cedarLevel === 'B' ? '🥈' : stockData?.cedarLevel === 'C' ? '🪨' : '⚠️'

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-white/[0.08]">
        <div className="w-full px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff3d71] to-[#ff6b35] flex items-center justify-center text-base font-bold">🌲</div>
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
          <div className="max-w-lg mx-auto text-center">
            {/* Market Selector */}
            <div className="flex justify-center gap-3 mb-5">
              <button
                onClick={() => router.push('/')}
                className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/[0.15] cursor-pointer"
              >
                🏛 大漂亮
              </button>
              <button className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all bg-[#ff3d71]/15 border-[#ff3d71]/40 text-[#ff3d71] shadow-[0_0_12px_rgba(255,61,113,0.2)]">
                🏯 中国大爱
              </button>
            </div>

            <label className="text-[11px] text-white/30 tracking-widest uppercase block mb-3">
              输入A股代码 (如 600519, 000858, 688981)
            </label>
            <div className="flex bg-[rgba(15,15,25,0.8)] border border-white/[0.08] rounded-xl overflow-hidden transition-all focus-within:border-[#ff3d71] focus-within:shadow-[0_0_0_3px_rgba(0,0,0,0.1)]">
              <div className="flex items-center px-4 font-medium border-r border-white/[0.08]" style={{ color: '#ff3d71', background: '#ff3d710d' }}>
                <span className="text-base">¥</span>
              </div>
              <input
                type="text"
                value={query}
                onChange={e => handleSearchInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setShowDropdown(false)
                    handleSearch(query)
                  } else if (e.key === 'Escape') setShowDropdown(false)
                }}
                onFocus={() => query.trim() && setShowDropdown(true)}
                placeholder="600519, 000858, 688981..."
                className="flex-1 bg-transparent px-5 py-4 text-[18px] font-mono font-medium text-white outline-none placeholder:text-white/30 placeholder:font-normal"
              />
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center px-5 text-white/50 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2 text-[#ff3d71]" />
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
                    className="px-5 text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #ff3d71, #ff3d71cc)' }}>
                    <Search className="w-4 h-4" />
                    分析
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
            {/* 搜索下拉 */}
            <AnimatePresence>
              {showDropdown && searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="relative z-50 mt-1 bg-[rgba(15,15,25,0.95)] border border-white/[0.12] rounded-xl overflow-hidden shadow-2xl"
                >
                  <div className="max-h-60 overflow-y-auto">
                    {searchResults.map(item => (
                      <button key={item.symbol} onClick={() => {
                        setQuery(item.symbol)
                        setShowDropdown(false)
                        handleSearch(item.symbol)
                      }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.06] transition-colors text-left border-b border-white/[0.06] last:border-0"
                      >
                        <span className="text-[13px] font-mono font-semibold w-10 text-[#ff3d71]">{item.symbol}</span>
                        <span className="text-[13px] text-white/80">{item.name}</span>
                        <span className="text-[10px] text-white/30 ml-auto">{item.market}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Recent searches */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {recentSearches.length > 0
                ? recentSearches.map(code => (
                    <button key={code} onClick={() => handleQuickSearch(code)}
                      className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#ff3d71]/50 hover:text-[#ff3d71] hover:bg-[#ff3d71]/10 transition-all">
                      {code}
                    </button>
                  ))
                : cnDefaults.map(code => (
                    <button key={code} onClick={() => handleQuickSearch(code)}
                      className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#ff3d71]/50 hover:text-[#ff3d71] hover:bg-[#ff3d71]/10 transition-all">
                      {code}
                    </button>
                  ))
              }
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
        <div className="grid grid-cols-12 gap-4 max-w-7xl mx-auto">

          {/* ── Basic Info (span-8) ── */}
          <Card className="col-span-12 lg:col-span-8">
            <CardHeader icon="📊" title="基础信息" />
            <div className="flex items-center gap-3 mb-5">
              <div className={`${isLoading ? 'skeleton-bar skeleton-name' : 'text-2xl font-bold'} transition-opacity text-white`}>
                {isLoading ? <div className="h-8 w-48 skeleton-bar" /> : stockData?.name || ''}
              </div>
              {stockData && (
                <>
                  <span className="text-sm font-mono text-white/50">{stockData.symbol}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50">中国</span>
                  {stockData.industryTrack && (
                    <span className="text-[11px] px-2 py-0.5 rounded" style={{
                      background: stockData.industryTrack === 'S' ? 'rgba(255,107,53,0.1)' :
                                 stockData.industryTrack === 'A' ? 'rgba(255,170,0,0.1)' :
                                 stockData.industryTrack === 'B' ? 'rgba(0,214,143,0.1)' : 'rgba(107,122,255,0.1)',
                      border: stockData.industryTrack === 'S' ? '1px solid rgba(255,107,53,0.3)' :
                              stockData.industryTrack === 'A' ? '1px solid rgba(255,170,0,0.3)' :
                              stockData.industryTrack === 'B' ? '1px solid rgba(0,214,143,0.3)' : '1px solid rgba(107,122,255,0.3)',
                      color: stockData.industryTrack === 'S' ? '#ff6b35' : stockData.industryTrack === 'A' ? '#ffaa00' :
                             stockData.industryTrack === 'B' ? '#00d68f' : '#6b7aff'
                    }}>
                      {stockData.industryTrack}级赛道
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(isLoading ? Array(9).fill(null) : [
                { label: '当前价格', value: `¥${stockData?.price.current?.toFixed(2) || 'N/A'}`, extra: stockData ? (stockData.price.changePercent > 0 ? `+${stockData.price.changePercent.toFixed(2)}%` : `${stockData.price.changePercent.toFixed(2)}%`) : null, isGain: stockData ? stockData.price.changePercent >= 0 : null },
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
          </Card>

          {/* ── Track Score (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.05}>
            <CardHeader icon="🏆" title="赛道评分" badge={
              isLoading ? <div className="h-5 w-10 skeleton-bar rounded" /> :
              stockData ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                    background: stockData.industryTrack === 'S' ? 'rgba(255,107,53,0.1)' :
                               stockData.industryTrack === 'A' ? 'rgba(255,170,0,0.1)' :
                               stockData.industryTrack === 'B' ? 'rgba(0,214,143,0.1)' : 'rgba(107,122,255,0.1)',
                    color: stockData.industryTrack === 'S' ? '#ff6b35' : stockData.industryTrack === 'A' ? '#ffaa00' :
                           stockData.industryTrack === 'B' ? '#00d68f' : '#6b7aff',
                    border: stockData.industryTrack === 'S' ? '1px solid rgba(255,107,53,0.3)' :
                            stockData.industryTrack === 'A' ? '1px solid rgba(255,170,0,0.3)' :
                            stockData.industryTrack === 'B' ? '1px solid rgba(0,214,143,0.3)' : '1px solid rgba(107,122,255,0.3)'
                  }}>{stockData.industryTrack}级</span>
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
                {stockData.industryTrack && stockData.industryTrackLabel && (
                  <div className="mt-4 text-[11px] text-white/40 px-2 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    {stockData.industryTrack === 'S' ? '🔥 热门赛道 · 高资金追捧 · 高波动高收益' :
                     stockData.industryTrack === 'A' ? '⭐ 成长赛道 · 行业景气向上 · 机构配置' :
                     stockData.industryTrack === 'B' ? '📊 稳定赛道 · 估值合理 · 防御性较强' :
                     '📉 冷门赛道 · 资金关注度低 · 需谨慎观望'}
                  </div>
                )}
              </>
            ) : <SkeletonLines count={3} />}
          </Card>

          {/* ── Growth Score (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.1}>
            <CardHeader icon="📈" title="成长性分析" />
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
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">营收增长</div>
                    <div className="text-xl font-bold font-mono text-[#00d68f]">
                      {stockData.price.revenueGrowth != null ? (
                        <>{stockData.price.revenueGrowth > 0 ? '+' : ''}{stockData.price.revenueGrowth.toFixed(1)}%</>
                      ) : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">利润增长</div>
                    <div className="text-xl font-bold font-mono text-[#00d68f]">
                      {stockData.price.profitGrowth != null ? (
                        <>{stockData.price.profitGrowth > 0 ? '+' : ''}{stockData.price.profitGrowth.toFixed(1)}%</>
                      ) : 'N/A'}
                    </div>
                  </div>
                </div>
              </>
            ) : <SkeletonLines count={3} />}
          </Card>

          {/* ── Valuation (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.15}>
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
                  {stockData.price.pe ? (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">PE</div>
                      <div className="text-lg font-bold font-mono">{stockData.price.pe.toFixed(1)}</div>
                    </div>
                  ) : null}
                  {stockData.price.pb ? (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">PB</div>
                      <div className="text-lg font-bold font-mono">{stockData.price.pb.toFixed(1)}</div>
                    </div>
                  ) : null}
                  {stockData.price.ps ? (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">PS</div>
                      <div className="text-lg font-bold font-mono">{stockData.price.ps.toFixed(1)}</div>
                    </div>
                  ) : null}
                  {stockData.price.peg ? (
                    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                      <div className="text-[10px] text-white/30 uppercase tracking-wider mb-1">PEG</div>
                      <div className="text-lg font-bold font-mono">{stockData.price.peg.toFixed(2)}</div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : <SkeletonLines count={4} />}
          </Card>

          {/* ── Risk Score (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.2}>
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
                  {stockData.riskDetail?.length > 0 ? stockData.riskDetail.map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-white/50 flex items-center gap-1.5"><Shield className="w-3 h-3" />{f.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        f.level === 'high' ? 'bg-[rgba(255,61,113,0.15)] text-[#ff3d71]' :
                        f.level === 'medium' ? 'bg-[rgba(255,170,0,0.15)] text-[#ffaa00]' :
                        'bg-[rgba(0,214,143,0.15)] text-[#00d68f]'
                      }`}>{f.value}</span>
                    </div>
                  )) : (
                    <>
                      {[{ label: '负债水平', status: stockData.riskScore > 70 ? 'bad' : stockData.riskScore > 40 ? 'warn' : 'ok', text: stockData.riskScore > 70 ? '高' : stockData.riskScore > 40 ? '中' : '低' }, { label: '现金流', status: 'ok', text: '充裕' }, { label: '行业竞争', status: stockData.riskScore > 60 ? 'warn' : 'ok', text: stockData.riskScore > 60 ? '激烈' : '稳定' }, { label: '政策风险', status: stockData.riskScore > 50 ? 'warn' : 'ok', text: stockData.riskScore > 50 ? '中等' : '低' }].map(f => {
                          const colors: Record<string, string> = { ok: 'bg-[rgba(0,214,143,0.15)] text-[#00d68f]', warn: 'bg-[rgba(255,170,0,0.15)] text-[#ffaa00]', bad: 'bg-[rgba(255,61,113,0.15)] text-[#ff3d71]' }
                          return (
                            <div key={f.label} className="flex items-center justify-between text-[12px]">
                              <span className="text-white/50 flex items-center gap-1.5"><Shield className="w-3 h-3" />{f.label}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${colors[f.status]}`}>{f.text}</span>
                            </div>
                          )
                        })}
                    </>
                  )}
                </div>
              </>
            ) : <SkeletonLines count={4} />}
          </Card>

          {/* ── Market Temperature (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.25}>
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
          </Card>

          {/* ── China-US Mapping (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.3}>
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
          </Card>

          {/* ── Peer Comparison (span-4) ── */}
          <Card className="col-span-6 lg:col-span-4" delay={0.35}>
            <CardHeader icon="🏅" title="同行对比" />
            {isLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-8 skeleton-bar rounded" />)}</div>
            ) : stockData?.peerBenchmarks && stockData.peerBenchmarks.length > 0 ? (
              <div className="space-y-2">
                {stockData.peerBenchmarks.slice(0, 6).map((peer, i) => (
                  <div key={peer.symbol} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        i === 0 ? 'bg-[#ffd700]/20 text-[#ffd700]' :
                        i === 1 ? 'bg-[#c0c0c0]/20 text-[#c0c0c0]' :
                        i === 2 ? 'bg-[#cd7f32]/20 text-[#cd7f32]' :
                        'bg-white/5 text-white/40'
                      }`}>{i + 1}</span>
                      <span className="font-mono text-white/70">{peer.symbol}</span>
                      <span className="text-white/40 truncate max-w-[80px]">{peer.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white/50 text-[11px]">PE </span>
                      <span className="font-mono text-white/70">{peer.pe > 0 ? peer.pe.toFixed(1) : 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : !isLoading && <div className="text-sm text-white/30 text-center py-6">暂无同行数据</div>}
          </Card>

          {/* ── Comprehensive Score (span-12) ── */}
          <Card className="col-span-12 comprehensive-card" delay={0.4}>
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
          </Card>

          {/* ── MA Evaluation (span-6) ── */}
          <Card className="col-span-12 lg:col-span-6" delay={0.45}>
            <CardHeader icon="📉" title="均线评估" />
            {klineLoading ? (
              <div className="h-60 flex items-center justify-center text-white/40 text-sm mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#ff3d71]/30 border-t-[#ff3d71] rounded-full animate-spin" />
                  正在加载K线数据...
                </div>
              </div>
            ) : klineData?.data?.length ? (
              <div className="mb-4">
                <StockChart kline={klineData} />
                <div className="flex items-center gap-4 mt-2 text-[10px] text-white/40">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{background:'#ff6b35'}}/>MA30</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{background:'#0095ff'}}/>MA60</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{background:'#ffaa00'}}/>MA120</span>
                  <span className="flex items-center gap-1 ml-auto text-[9px] opacity-60">拖动缩放 · 滚轮放大</span>
                </div>
              </div>
            ) : (
              <div className="h-60 skeleton-bar rounded mb-4" />
            )}
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
          </Card>

          {/* ── Industry Map (span-6) ── */}
          <Card className="col-span-12 lg:col-span-6" delay={0.5}>
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
          </Card>

          {/* ── AI Summary (span-12) ── */}
          <Card className="col-span-12" delay={0.55}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <h3 className="text-[15px] font-semibold">AI 投资总结</h3>
                <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#ff3d7126', color: '#ff3d71', border: '1px solid #ff3d714d' }}>MiniMax-M2</span>
              </div>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3,4].map(i => <div key={i} className="h-4 skeleton-bar rounded" style={{ width: `${70 + Math.random() * 30}%` }} />)}
              </div>
            ) : stockData?.summary ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {stockData.summary.map((item: any, i: number) => (
                  <div key={i} className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{item.icon}</span>
                      <span className="text-sm font-semibold text-white">{item.label}</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed">{item.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-white/50 text-center py-4">输入股票代码开始分析...</div>
            )}
            {stockData && (
              <div className="mt-4 p-3 rounded-lg bg-[rgba(255,170,0,0.08)] border border-[rgba(255,170,0,0.2)]">
                <div className="text-[11px] text-[#ffaa00] flex items-start gap-2">
                  <span>⚠️</span>
                  <span><strong>风险提示：</strong>本分析仅供信息参考，不构成任何投资建议。请根据个人风险承受能力独立判断。</span>
                </div>
              </div>
            )}
          </Card>

          {/* ── Fundamentals Detail (span-12) ── */}
          {stockData?.fundamentals && stockData.fundamentals.length > 0 && (
            <Card className="col-span-12" delay={0.6}>
              <CardHeader icon="📋" title="核心指标" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {stockData.fundamentals.map((item, i) => (
                  <div key={i}>
                    <span className="text-xs text-white/30 block mb-1">{item.label}</span>
                    <span className="text-sm font-medium text-white font-mono">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Valuation Detail (span-12) ── */}
          {stockData?.valuationDetail && stockData.valuationDetail.length > 0 && (
            <Card className="col-span-12" delay={0.65}>
              <CardHeader icon="💹" title="估值详览" />
              <div className="space-y-2">
                {stockData.valuationDetail.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <span className="text-xs text-white/50">{item.label}</span>
                    <span className={`text-xs font-medium ${
                      item.level === 'high' ? 'text-red-400' :
                      item.level === 'medium' ? 'text-amber-400' : 'text-green-400'
                    }`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── Financial Analysis Panel (span-12) ── */}
          {stockData && (
            <Card className="col-span-12" delay={0.7}>
              <div className="flex items-center gap-2 mb-5">
                <span className="text-lg">📊</span>
                <h3 className="text-[15px] font-semibold">深度金融分析</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,215,0,0.15)] text-[#ffd700] border border-[rgba(255,215,0,0.3)] font-medium">投行级</span>
              </div>
              <AnalysisButtons symbol={stockData.symbol} market="china" />
            </Card>
          )}

        </div>
      </main>
    </div>
  )
}