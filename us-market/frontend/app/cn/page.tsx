'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, AlertTriangle,
  Activity, Loader2, ArrowRight, X, Shield,
  Thermometer, ArrowUpRight, ArrowDownRight, Minus,
  Sparkles, BarChart3, Zap
} from 'lucide-react'
import { clsx } from 'clsx'
import ChinaChainMap from '@/components/ChinaChainMap'
import AnalysisButtons from '@/components/AnalysisPanel'

// ── Types ──────────────────────────────────────────
interface SearchResult {
  symbol: string
  name: string
  market: string
}
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
  valuationDetail: {
    pricePercentile: number
    percentileLabel: string
    ytdReturn?: number
    ytdReturnLabel: string
  }
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'very_high'
  marketTemp: number
  marketTempLevel: 'fever' | 'warm' | 'neutral' | 'cold'
  maEvaluation: MAEvaluation
  industry: string
  industryTrack: 'S' | 'A' | 'B' | 'C'   // 赛道归属
  industryTrackLabel: string              // 赛道标签
  chinaUsMapping: string | null
  peerBenchmarks: Array<{
    symbol: string
    name: string
    marketCap: number
    pe: number
    roe: number
    revenueGrowth: number
    profitGrowth: number
  }>
  summary: { dimension: string; label: string; icon: string; summary: string }[]
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
function SkeletonLines({ count = 3, seed = 0 }: { count?: number; seed?: number }) {
  const widths = useMemo(() => 
    Array.from({ length: count }, (_, i) => 60 + ((seed + i * 17) % 40)), 
  [count, seed])
  return (
    <div className="flex flex-col gap-2">
      {widths.map((w, i) => (
        <div key={i} className="h-4 skeleton-bar rounded" style={{ width: `${w}%` }} />
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

// ── Stock Chart (lightweight-charts) ──────────────────────────────────────────
function StockChart({ kline }: { kline: { data: { date: string; open: number; high: number; low: number; close: number; volume: number }[]; ma: Record<string, number[]> } }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || !kline?.data?.length) return

    let chart: any
    let mounted = true

    const init = async () => {
      const { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } = await import('lightweight-charts') as any
      if (!mounted || !containerRef.current) return

      chart = new createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 240,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: 'rgba(240,240,245,0.5)',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: 'rgba(0,149,255,0.4)', labelBackgroundColor: '#0095ff' },
          horzLine: { color: 'rgba(0,149,255,0.4)', labelBackgroundColor: '#0095ff' },
        },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true },
        handleScale: { mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true },
      })

      chartRef.current = chart

      // 主图：K线
      const cdata = kline.data.map(d => ({
        time: d.date as any,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00d68f',
        downColor: '#ff3d71',
        borderUpColor: '#00d68f',
        borderDownColor: '#ff3d71',
        wickUpColor: '#00d68f',
        wickDownColor: '#ff3d71',
      })
      candleSeries.setData(cdata)

      // MA30
      const ma30Data = kline.data.map((d, i) => ({
        time: d.date as any,
        value: kline.ma.ma30?.[i] ?? d.close,
      })).filter(d => d.value != null)
      chart.addSeries(LineSeries, { color: '#ff6b35', lineWidth: 1, title: 'MA30' }).setData(ma30Data)

      // MA60
      const ma60Data = kline.data.map((d, i) => ({
        time: d.date as any,
        value: kline.ma.ma60?.[i] ?? d.close,
      })).filter(d => d.value != null)
      chart.addSeries(LineSeries, { color: '#0095ff', lineWidth: 1, title: 'MA60' }).setData(ma60Data)

      // MA120
      const ma120Data = kline.data.map((d, i) => ({
        time: d.date as any,
        value: kline.ma.ma120?.[i] ?? d.close,
      })).filter(d => d.value != null)
      chart.addSeries(LineSeries, { color: '#ffaa00', lineWidth: 1, title: 'MA120' }).setData(ma120Data)

      // 成交量
      const volSeries = chart.addSeries(HistogramSeries, {
        color: 'rgba(0,149,255,0.3)',
        priceFormat: { type: 'volume' },
        priceScaleId: '',
      })
      volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } })
      volSeries.setData(kline.data.map(d => ({
        time: d.date as any,
        value: d.volume ?? 0,
        color: d.close >= d.open ? 'rgba(0,214,143,0.4)' : 'rgba(255,61,113,0.4)',
      })))

      chart.timeScale().fitContent()
    }

    init()

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      mounted = false
      ro.disconnect()
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [kline])

  return <div ref={containerRef} className="w-full" style={{ minHeight: 240 }} />
}

// ── Main Page ──────────────────────────────────────────
export default function Home() {
  
  const [query, setQuery] = useState('')
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  // Load from localStorage only on client
  useEffect(() => {
    try { setRecentSearches(JSON.parse(localStorage.getItem('cedar_recent_china') || '[]')) } catch {}
  }, [])
  const [basicData, setBasicData] = useState<{symbol:string; basic:{symbol:string; name:string; market:string; industry:string; area:string}}| null>(null)
  const [klineData, setKlineData] = useState<{symbol:string; kline:{data:{date:string;open:number;high:number;low:number;close:number;volume:number}[];ma:Record<string,number[]>}}| null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Dual timezone analog clocks
  const [etTime, setEtTime] = useState('00:00:00')
  const [ctTime, setCtTime] = useState('00:00:00')
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setEtTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York' }))
      setCtTime(now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }))
    }
    update()
    const id = setInterval(update, 1000)
      return () => clearInterval(id)
    }, [])

    const parseTime = (t: string) => {
      const [h, m, s] = t.split(':').map(Number)
      return { h: h || 0, m: m || 0, s: s || 0 }
    }
    const toHandAngle = (h: number, m: number, s: number) => {
      const hourAngle = ((h % 12) * 30 + m * 0.5 + s * (0.5 / 60))
      const minuteAngle = m * 6 + s * 0.1
      return { hourAngle, minuteAngle }
    }

    const ClockFace = ({ time, label, accent }: { time: string; label: string; accent: string }) => {
        const { h, m, s } = parseTime(time)
        const { hourAngle, minuteAngle } = toHandAngle(h, m, s)
        return (
          <div className="flex flex-col items-center gap-1" suppressHydrationWarning>
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ filter: `drop-shadow(0 0 6px ${accent}40)` }}>
              {/* Glass face background */}
              <circle cx="24" cy="24" r="22" fill="rgba(10,15,25,0.9)" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6"/>
              {/* Outer accent glow ring */}
              <circle cx="24" cy="24" r="21" fill="none" stroke={accent} strokeWidth="0.5" strokeOpacity="0.4"/>
              {/* Inner subtle ring */}
              <circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5"/>
              {/* Tick marks - enhanced visibility */}
              {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
                const a = i * 30 - 90
                const r1 = i % 3 === 0 ? 15 : 16.5
                const isMain = i % 3 === 0
                return <line key={i} 
                  x1={24 + r1*Math.cos(a*Math.PI/180)} 
                  y1={24 + r1*Math.sin(a*Math.PI/180)} 
                  x2={24 + 17.5*Math.cos(a*Math.PI/180)} 
                  y2={24 + 17.5*Math.sin(a*Math.PI/180)} 
                  stroke={isMain ? accent : "rgba(255,255,255,0.4)"} 
                  strokeWidth={isMain ? 2 : 1}
                  strokeLinecap="round"
                />
              })}
              {/* Center hub - large and prominent */}
              <circle cx="24" cy="24" r="3" fill={accent} opacity="0.9"/>
              <circle cx="24" cy="24" r="1.5" fill="rgba(255,255,255,0.8)"/>
              {/* Hour hand - thick and bold */}
              <line x1={24} y1={24} 
                x2={24 + 10*Math.sin(hourAngle*Math.PI/180)} 
                y2={24 - 10*Math.cos(hourAngle*Math.PI/180)} 
                stroke={accent} strokeWidth="3" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 3px ${accent})` }}
              />
              {/* Minute hand - clear visibility */}
              <line x1={24} y1={24} 
                x2={24 + 14*Math.sin(minuteAngle*Math.PI/180)} 
                y2={24 - 14*Math.cos(minuteAngle*Math.PI/180)} 
                stroke="rgba(255,255,255,0.85)" strokeWidth="2" strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.5))' }}
              />
              {/* Second hand - accent colored, thin but bright */}
              <line x1={24} y1={24} 
                x2={24 + 15*Math.sin((s*6)*Math.PI/180)} 
                y2={24 - 15*Math.cos((s*6)*Math.PI/180)} 
                stroke={accent} strokeWidth="1" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
              />
              {/* Second hand tail */}
              <line x1={24} y1={24} 
                x2={24 - 4*Math.sin((s*6)*Math.PI/180)} 
                y2={24 + 4*Math.cos((s*6)*Math.PI/180)} 
                stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.5"
              />
              {/* Second hand tip dot */}
              <circle 
                cx={24 + 15*Math.sin((s*6)*Math.PI/180)} 
                cy={24 - 15*Math.cos((s*6)*Math.PI/180)} 
                r="1.2" fill={accent}
                style={{ filter: `drop-shadow(0 0 3px ${accent})` }}
              />
            </svg>
            <span className="text-[10px] text-white/50 font-medium tracking-widest" suppressHydrationWarning>{label}</span>
            <span className="text-[12px] text-white/80 font-mono font-semibold" suppressHydrationWarning>{time.substring(0,5)}</span>
          </div>
        )
      }

    const addRecent = (code: string) => {
    const normalized = code.trim().toUpperCase()
    const storageKey = 'cedar_recent_china'
    setRecentSearches(prev => {
      const filtered = prev.filter(c => c !== normalized)
      const next = [normalized, ...filtered].slice(0, 6)
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(next))
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
      // 如果输入的是拼音首字母或全拼，先查询真实代码
      let symbol = q.trim()
      const searchRes = await fetch(`/cn/api/stock/search?q=${encodeURIComponent(symbol)}`, { signal: controller.signal })
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        if (searchData.results?.length > 0) {
          symbol = searchData.results[0].symbol.replace(/\.(SS|SZ|BK)$/, '')
        }
      }

      // 并行请求：完整评分 + K线（基础信息已包含在完整评分返回中）
      const [stockRes, klineRes] = await Promise.all([
        fetch(`/cn/api/stock/${encodeURIComponent(symbol)}`, { signal: controller.signal }),
        fetch(`/cn/api/stock/kline/${encodeURIComponent(symbol)}`, { signal: controller.signal }),
      ])
      clearTimeout(timeoutId)

      const klineJson = await klineRes.json().catch(() => null)
      if (klineRes.ok && klineJson && klineJson.kline?.data?.length) {
        setKlineData(klineJson)
      }

      if (!stockRes.ok) {
        const err = await stockRes.json().catch(() => ({ error: '请求失败' }))
        throw new Error(err.error || '请求失败')
      }
      const data = await stockRes.json()
      setStockData(data)
      // 基础信息从完整评分数据中提取
      setBasicData({ symbol: data.symbol, basic: { symbol: data.symbol, name: data.basic?.name || data.symbol, market: 'china', industry: '', area: '' } })
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

  const handleSearchInputChange = useCallback((value: string) => {
    setQuery(value)
    if (!value.trim()) {
      setShowDropdown(false)
      setSearchResults([])
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
    }, 200)
  }, [])

  const handleQuickSearch = (code: string) => {
    setQuery(code)
    handleSearch(code)
  }

  const handleClear = () => {
    setQuery('')
    setStockData(null)
    setBasicData(null)
    setKlineData(null)
    setError('')
  }

  const g = stockData ? gradeConfig[stockData.cedarLevel] : null
  const cedarEmoji = stockData?.cedarLevel === 'S' ? '💎' : stockData?.cedarLevel === 'A' ? '🥇' : stockData?.cedarLevel === 'B' ? '🥈' : stockData?.cedarLevel === 'C' ? '🪨' : '⚠️'

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[rgba(10,10,15,0.85)] backdrop-blur-xl border-b border-white/[0.08]">
        <div className="w-full px-4 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#ff3d71] flex items-center justify-center text-base font-bold">🏯</div>
            <div>
              <div className="text-[15px] font-semibold tracking-wide text-[#ff3d71]">CEDAR<span className="text-white/30 font-light">AI</span></div>
              <div className="text-[10px] text-[#ff3d71]/60 tracking-widest uppercase">杉树AI投资决策系统</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[11px] text-[#00d68f] bg-[rgba(0,214,143,0.1)] border border-[rgba(0,214,143,0.2)] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00d68f] animate-pulse" />
              LIVE
            </div>
            <div className="flex items-center gap-4">
                <ClockFace time={etTime} label="纽交所" accent="#0095ff"/>
                <div className="w-px h-8 bg-white/10"/>
                <ClockFace time={ctTime} label="北京时间" accent="#ff3d71"/>
              </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="w-full px-4 sm:px-8 py-8 sm:py-10">
        {/* Search */}
        <div className="mb-10">
          <div className="max-w-lg mx-auto text-center">
            {/* Market Selector */}
            <div className="flex justify-center gap-3 mb-5">
              <button onClick={() => window.open('/', '_self')} className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all bg-white/[0.03] border-white/[0.08] text-white/40 hover:border-white/[0.15] cursor-pointer">
                🏛 大漂亮
              </button>
              <button className="px-5 py-2.5 rounded-xl border text-sm font-medium transition-all bg-[#ff3d71]/15 border-[#ff3d71]/40 text-[#ff3d71] shadow-[0_0_12px_rgba(255,61,113,0.2)]">
                🏯 中国大爱
              </button>
            </div>

            <label className="text-[11px] text-white/30 tracking-widest uppercase block mb-3">
              输入A股代码 (如 600519, 000858, 688981)
            </label>
            <div className="flex bg-[rgba(15,15,25,0.8)] border border-[rgba(255,61,113,0.2)] rounded-xl overflow-hidden focus-within:border-[#ff3d71] focus-within:shadow-[0_0_0_3px_rgba(255,61,113,0.1)] transition-all">
              <div className="flex items-center px-4 text-[#ff3d71] font-medium border-r border-white/[0.08] bg-[rgba(255,61,113,0.05)]">
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
                placeholder='600519, 贵州茅台, 五粮液, mt...'
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
                    className="px-5 bg-[#ff3d71] text-white text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2">
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
                        <span className="text-[13px] font-mono font-semibold text-[#ff3d71] w-10">{item.symbol}</span>
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
                      className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#0095ff]/50 hover:text-[#ff3d71] hover:bg-[#0095ff]/10 transition-all">
                      {code}
                    </button>
                  ))
                : ['600519', '000858', '601318', '300750'].map(code => (
                    <button key={code} onClick={() => handleQuickSearch(code)}
                      className="text-[11px] font-mono px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/50 hover:border-[#0095ff]/50 hover:text-[#ff3d71] hover:bg-[#0095ff]/10 transition-all">
                      {code}
                    </button>
                  ))
              }
            </div>
          </div>
        </div>

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
          <div className="card-style col-span-12 lg:col-span-8">
            <CardHeader icon="📊" title="基础信息" />
            <div className="flex items-center gap-3 mb-5">
              <div className={`${isLoading ? 'skeleton-bar skeleton-name' : 'text-2xl font-bold'} transition-opacity`}>
                {isLoading ? <div className="h-8 w-48 skeleton-bar" /> : basicData?.basic?.name || stockData?.name || ''}
              </div>
              {stockData && (
                <>
                  <span className="text-sm font-mono text-white/50">{stockData.symbol}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/[0.08] text-white/50">
                    {basicData?.basic?.area || (stockData.symbol.match(/^(sh|sz|600|601|603|000|001|002|688|430|300)/i) ? '中国' : '美国')}
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
                {/* 赛道归属说明 */}
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
          </div>

          {/* ── Growth Score (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
            <CardHeader icon="📈" title="成长性分析" badge={
              isLoading ? <div className="h-5 w-10 skeleton-bar rounded" /> :
              stockData?.price?.analyst ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(0,214,143,0.15)', color: '#00d68f', border: '1px solid rgba(0,214,143,0.3)' }}>强势</span>
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
                  <span className="text-5xl font-bold">{stockData.growthScore}</span>
                  <span className="text-sm text-white/30">/ 100</span>
                </div>
                <ScoreBar value={stockData.growthScore} gradient="linear-gradient(90deg, #0095ff, #00d68f)" />

                {/* 真实指标数据 */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {/* 营收增长率 */}
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">营收增长</div>
                    <div className="text-xl font-bold font-mono text-[#00d68f]">
                      {stockData.price.revenueGrowth != null ? (
                      <>
                        {stockData.price.revenueGrowth > 0 ? '+' : ''}{stockData.price.revenueGrowth.toFixed(1)}%
                      </>
                    ) : 'N/A'}
                    </div>
                    {stockData.price.revenueGrowthCagr ? (
                      <div className="text-[9px] text-white/30 mt-0.5">近3年CAGR</div>
                    ) : null}
                  </div>
                  {/* 利润增长率 */}
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg p-3">
                    <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1">利润增长</div>
                    <div className="text-xl font-bold font-mono text-[#00d68f]">
                      {stockData.price.profitGrowth != null ? (
                      <>
                        {stockData.price.profitGrowth > 0 ? '+' : ''}{stockData.price.profitGrowth.toFixed(1)}%
                      </>
                    ) : 'N/A'}
                    </div>
                    {stockData.price.profitGrowthCagr ? (
                      <div className="text-[9px] text-white/30 mt-0.5">近3年CAGR</div>
                    ) : null}
                  </div>
                </div>

                {/* 分析师评级 & 目标价 */}
                {stockData.price.analyst && (
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] text-white/30 uppercase tracking-wider">分析师评级</span>
                      <span className="text-[10px] font-bold text-[#00d68f]">{stockData.price.analyst.rating}</span>
                    </div>
                    <div className="text-[10px] text-white/40 mb-1">共{stockData.price.analyst.totalAnalysts}位覆盖</div>
                  </div>
                )}
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
                <div className="mt-2 p-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/40">历史分位</span>
                    <span className={"font-mono font-bold " + (stockData.valuationDetail.pricePercentile <= 30 ? "text-green-400" : stockData.valuationDetail.pricePercentile >= 70 ? "text-red-400" : "text-yellow-400")}>
                      {stockData.valuationDetail.pricePercentile}%
                      <span className="ml-1 text-[10px] text-white/50">({stockData.valuationDetail.percentileLabel})</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-white/40">近1年涨跌</span>
                    <span className={"font-mono font-bold " + ((stockData.valuationDetail.ytdReturn ?? 0) > 0 ? "text-green-400" : "text-red-400")}>
                      {stockData.valuationDetail.ytdReturnLabel}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {stockData.price.pe ? (() => {
                    const b = stockData.price.benchmarks?.pe
                    return (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">PE</span>
                          {b && <span className={"text-[8px] font-bold px-1.5 py-0.5 rounded " + (b === 'low' ? 'bg-green-500/20 text-green-400' : b === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}>{b === 'low' ? '偏低' : b === 'high' ? '偏高' : '中等'}</span>}
                        </div>
                        <div className="text-lg font-bold font-mono">{stockData.price.pe.toFixed(1)}</div>
                      </div>
                    )
                  })() : null}
                  {stockData.price.ps ? (() => {
                    const b = stockData.price.benchmarks?.ps
                    return (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">PS</span>
                          {b && <span className={"text-[8px] font-bold px-1.5 py-0.5 rounded " + (b === 'low' ? 'bg-green-500/20 text-green-400' : b === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}>{b === 'low' ? '偏低' : b === 'high' ? '偏高' : '中等'}</span>}
                        </div>
                        <div className="text-lg font-bold font-mono">{stockData.price.ps.toFixed(1)}</div>
                      </div>
                    )
                  })() : null}
                  {stockData.price.peg ? (() => {
                    const b = stockData.price.benchmarks?.peg
                    return (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">PEG</span>
                          {b && <span className={"text-[8px] font-bold px-1.5 py-0.5 rounded " + (b === 'low' ? 'bg-green-500/20 text-green-400' : b === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}>{b === 'low' ? '偏低' : b === 'high' ? '偏高' : '中等'}</span>}
                        </div>
                        <div className="text-lg font-bold font-mono">{stockData.price.peg.toFixed(2)}</div>
                      </div>
                    )
                  })() : null}
                  {stockData.price.pb ? (() => {
                    const b = stockData.price.benchmarks?.pb
                    return (
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">PB</span>
                          {b && <span className={"text-[8px] font-bold px-1.5 py-0.5 rounded " + (b === 'low' ? 'bg-green-500/20 text-green-400' : b === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400')}>{b === 'low' ? '偏低' : b === 'high' ? '偏高' : '中等'}</span>}
                        </div>
                        <div className="text-lg font-bold font-mono">{stockData.price.pb.toFixed(1)}</div>
                      </div>
                    )
                  })() : null}
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

          {/* ── Peer Comparison (span-4) ── */}
          <div className="card-style col-span-6 lg:col-span-4">
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
            ) : !isLoading && (
              <div className="text-sm text-white/30 text-center py-6">暂无同行数据</div>
            )}
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

          {/* ── Financial Analysis Panel (span-12) ── */}
          <div className="card-style col-span-12">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-lg">📋</span>
              <h3 className="text-[15px] font-semibold">深度金融分析</h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(255,215,0,0.15)] text-[#ffd700] border border-[rgba(255,215,0,0.3)] font-medium">投行级</span>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                <div className="h-24 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : stockData ? (
              <AnalysisButtons symbol={stockData.symbol} market="china" />
            ) : (
              <div className="h-24 flex items-center justify-center text-white/30 text-sm">输入股票代码获取深度分析</div>
            )}
          </div>

          {/* ── MA Evaluation (span-6) ── */}
          <div className="card-style col-span-12 lg:col-span-6">
            <CardHeader icon="📉" title="均线评估" />
            {klineData?.kline?.data?.length ? (
              <div className="mb-4">
                <StockChart kline={klineData.kline} />
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
          </div>

          {/* ── Industry Map (span-6) ── */}
          <div className="col-span-12 lg:col-span-6">
            {stockData ? (
              <ChinaChainMap symbol={stockData.symbol} />
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
                <span className="text-[10px] px-2 py-0.5 rounded bg-[rgba(0,149,255,0.15)] text-[#ff3d71] border border-[rgba(0,149,255,0.3)] font-medium">MiniMax-M2</span>
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
          </div>
        </div>
      </main>
    </div>
  )
}
