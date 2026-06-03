'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, AlertTriangle, Shield,
  Activity, BarChart3, ArrowUpRight, ArrowDownRight,
  Zap, Target, Award, ChevronRight, Loader2, Sparkles,
  ArrowRight, Droplet, Thermometer, LineChart, Map, Brain,
  X, RefreshCw, Info
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { clsx } from 'clsx'

// ── Types ──────────────────────────────────────────
interface StockPrice {
  current: number
  change: number
  changePercent: number
  pe: number
  pb: number
  marketCap: number
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
  chinaUsMapping: string | null
  summary: string
  price: StockPrice
  updatedAt: string
}

// ── Animated Number ──────────────────────────────────────────
function AnimatedNumber({ value, duration = 1500 }: { value: number; duration?: number }) {
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

  return <span>{display.toLocaleString()}</span>
}

// ── Progress Bar ──────────────────────────────────────────
function ProgressBar({ value, delay = 0 }: { value: number; delay?: number }) {
  return (
    <div className="progress-bar w-full">
      <motion.div
        className="progress-fill"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1.2, delay, ease: [0.4, 0, 0.2, 1] }}
      />
    </div>
  )
}

// ── Grade Badge ──────────────────────────────────────────
function GradeBadge({ grade }: { grade: string }) {
  const gradeConfig: Record<string, { bg: string; border: string; text: string }> = {
    S: { bg: 'from-orange-500/20 to-red-500/20', border: 'border-orange-500/50', text: 'text-orange-400' },
    A: { bg: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/50', text: 'text-yellow-400' },
    B: { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/50', text: 'text-green-400' },
    C: { bg: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/50', text: 'text-blue-400' },
    D: { bg: 'from-gray-500/20 to-slate-500/20', border: 'border-gray-500/50', text: 'text-gray-400' },
    AVOID: { bg: 'from-red-500/20 to-rose-500/20', border: 'border-red-500/50', text: 'text-red-400' },
  }
  const config = gradeConfig[grade] || gradeConfig.C
  
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, delay: 0.5 }}
      className={clsx(
        'inline-flex items-center justify-center w-12 h-12 rounded-xl',
        'font-mono text-lg font-bold border backdrop-blur-sm',
        config.bg, config.border, config.text
      )}
    >
      {grade}
    </motion.span>
  )
}

// ── Score Ring ──────────────────────────────────────────
function ScoreRing({ value, size = 120, strokeWidth = 8 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (value / 100) * circumference
  
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="url(#gradient)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - progress }}
        transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
      />
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0095ff" />
          <stop offset="100%" stopColor="#00d68f" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Temp Gauge ──────────────────────────────────────────
function TempGauge({ value }: { value: number }) {
  const rotation = (value / 100) * 180 - 90
  
  return (
    <div className="relative w-40 h-24">
      {/* Arc */}
      <svg width="160" height="80" viewBox="0 0 160 80" className="absolute left-0">
        <path
          d="M 10 70 A 70 70 0 0 1 150 70"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <motion.path
          d="M 10 70 A 70 70 0 0 1 150 70"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="220"
          initial={{ strokeDashoffset: 220 }}
          animate={{ strokeDashoffset: 220 - (value / 100) * 180 }}
          transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1] }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0095ff" />
            <stop offset="50%" stopColor="#ffaa00" />
            <stop offset="100%" stopColor="#ff3d71" />
          </linearGradient>
        </defs>
      </svg>
      {/* Needle */}
      <motion.div
        className="absolute bottom-0 left-1/2 w-1 h-16 origin-bottom"
        style={{ height: '56px' }}
        animate={{ rotate: rotation }}
        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
      >
        <div className="w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent rounded-full" />
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg" />
      </motion.div>
      {/* Labels */}
      <div className="absolute bottom-0 left-0 text-xs text-white/30">冰点</div>
      <div className="absolute bottom-0 right-0 text-xs text-white/30">过热</div>
    </div>
  )
}

// ── MA Badge ──────────────────────────────────────────
function MABadge({ label, status }: { label: string; status: 'bull' | 'bear' | 'neutral' }) {
  const colors = {
    bull: 'bg-green-500/20 text-green-400 border-green-500/30',
    bear: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
  const icons = { bull: ArrowUpRight, bear: ArrowDownRight, neutral: Minus }
  const Icon = icons[status]
  
  return (
    <div className={clsx('flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs', colors[status])}>
      <Icon className="w-3 h-3" />
      <span className="font-mono">{label}</span>
    </div>
  )
}

function Minus({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
}

// ── MA Chart ──────────────────────────────────────────
function MAChart({ history }: { history: Array<{ date: string; close: number }> }) {
  const chartData = history.slice(-60)
  
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: {
      type: 'category',
      data: chartData.map(d => d.date.slice(5)), // MM-DD format
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisLabel: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
    },
    series: [
      {
        name: 'Price',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: chartData.map(d => d.close.toFixed(2)),
        lineStyle: { color: '#0095ff', width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(0, 149, 255, 0.3)' },
              { offset: 1, color: 'rgba(0, 149, 255, 0)' },
            ],
          },
        },
        animationDuration: 2000,
        animationEasing: 'cubicOut',
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 15, 25, 0.95)',
      borderColor: 'rgba(255,255,255,0.1)',
      textStyle: { color: '#fff', fontSize: 12 },
    },
  }
  return <ReactECharts option={option} style={{ height: 200 }} />
}

// ── Card Components ──────────────────────────────────────────
function Card({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.4, 0, 0.2, 1] }}
      className={clsx('glass-card p-6 glow-border', className)}
    >
      {children}
    </motion.div>
  )
}

// ── Score Card ──────────────────────────────────────────
function ScoreCard({ title, value, grade, icon: Icon, delay = 0, children }: {
  title: string; value: number; grade?: string; icon: any; delay?: number; children?: React.ReactNode
}) {
  return (
    <Card delay={delay}>
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-accent/10">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        {grade && <GradeBadge grade={grade} />}
      </div>
      <div className="text-3xl font-bold font-mono mb-2">{value}</div>
      <div className="text-sm text-white/50 mb-4">{title}</div>
      <ProgressBar value={value} delay={delay + 0.3} />
      {children && <div className="mt-3">{children}</div>}
    </Card>
  )
}

// ── Valuation Badge ──────────────────────────────────────────
function ValuationBadge({ level }: { level: StockData['valuationLevel'] }) {
  const config = {
    low: { label: '低估', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    medium: { label: '适中', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { label: '偏高', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    very_high: { label: '高估', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  }
  const c = config[level]
  return (
    <span className={clsx('px-2 py-1 rounded text-xs border', c.bg, c.text, c.border)}>
      {c.label}
    </span>
  )
}

// ── Risk Badge ──────────────────────────────────────────
function RiskBadge({ level }: { level: StockData['riskLevel'] }) {
  const config = {
    low: { label: '低风险', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
    medium: { label: '中风险', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    high: { label: '高风险', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    very_high: { label: '极高风险', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  }
  const c = config[level]
  return (
    <span className={clsx('px-2 py-1 rounded text-xs border', c.bg, c.text, c.border)}>
      {c.label}
    </span>
  )
}

// ── Market Temp Badge ──────────────────────────────────────────
function MarketTempBadge({ level }: { level: StockData['marketTempLevel'] }) {
  const config = {
    fever: { label: '过热', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    warm: { label: '温暖', bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    neutral: { label: '中性', bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' },
    cold: { label: '冰冷', bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  }
  const c = config[level]
  return (
    <span className={clsx('px-2 py-1 rounded text-xs border', c.bg, c.text, c.border)}>
      {c.label}
    </span>
  )
}

// ── Cedar Level Display ──────────────────────────────────────────
function CedarLevelDisplay({ level }: { level: StockData['cedarLevel'] }) {
  const config: Record<string, { label: string; bg: string; text: string; border: string; icon: string }> = {
    S: { label: '钻石级', bg: 'from-orange-500/20 to-red-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: '💎' },
    A: { label: '黄金级', bg: 'from-yellow-500/20 to-orange-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: '🥇' },
    B: { label: '白银级', bg: 'from-gray-300/20 to-gray-400/20', text: 'text-gray-300', border: 'border-gray-400/30', icon: '🥈' },
    C: { label: '青铜级', bg: 'from-amber-600/20 to-amber-700/20', text: 'text-amber-600', border: 'border-amber-600/30', icon: '🥉' },
    D: { label: '观察级', bg: 'from-gray-500/20 to-slate-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: '📊' },
    AVOID: { label: '回避级', bg: 'from-red-500/20 to-rose-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: '⚠️' },
  }
  const c = config[level] || config.AVOID
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className={clsx(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full',
        'bg-gradient-to-r border',
        c.bg, c.text, c.border
      )}
    >
      <span className="text-lg">{c.icon}</span>
      <span className="font-semibold">{c.label}</span>
    </motion.div>
  )
}

// ── Price Change ──────────────────────────────────────────
function PriceChange({ change, changePercent }: { change: number; changePercent: number }) {
  const isPositive = change >= 0
  const Icon = isPositive ? TrendingUp : TrendingDown
  const color = isPositive ? 'text-green-400' : 'text-red-400'
  
  return (
    <div className={clsx('flex items-center gap-2', color)}>
      <Icon className="w-4 h-4" />
      <span className="font-mono">
        {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
      </span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────
export default function HomePage() {
  const [searchValue, setSearchValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([])

  useEffect(() => {
    setParticles(
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 10,
      }))
    )
  }, [])

  const handleSearch = async () => {
    if (!searchValue.trim()) return
    setIsLoading(true)
    setError(null)
    setStockData(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const response = await fetch(`${apiUrl}/api/stock/${encodeURIComponent(searchValue.trim())}`)
      
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || `请求失败 (${response.status})`)
      }
      
      const data: StockData = await response.json()
      setStockData(data)
    } catch (err: any) {
      console.error('API Error:', err)
      setError(err.message || '获取数据失败，请检查股票代码是否正确')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setSearchValue('')
    setStockData(null)
    setError(null)
  }

  const handleQuickSearch = (code: string) => {
    setSearchValue(code)
    setTimeout(() => {
      const input = document.querySelector('input') as HTMLInputElement
      if (input) {
        input.value = code
        setSearchValue(code)
      }
    }, 0)
  }

  // 格式化市值
  const formatMarketCap = (cap: number): string => {
    if (cap >= 1e12) return `${(cap / 1e12).toFixed(2)}万亿`
    if (cap >= 1e8) return `${(cap / 1e8).toFixed(2)}亿`
    if (cap >= 1e4) return `${(cap / 1e4).toFixed(2)}万`
    return cap.toLocaleString()
  }

  // 格式化时间
  const formatDate = (isoString: string): string => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Ambient Particles */}
      <div className="fixed inset-0 pointer-events-none">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="particle"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size }}
            animate={{
              y: [0, -200, -400, -200, 0],
              x: [0, 50, -30, 20, 0],
              opacity: [0.2, 0.5, 0.3, 0.6, 0.2],
            }}
            transition={{ duration: 15 + p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Gradient Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-12"
        >
          {/* Logo */}
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 10, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="text-5xl"
            >
              🌲
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-green-400">
                  CEDAR
                </span>
                <span className="text-white/90 ml-2">AI</span>
              </h1>
              <p className="text-sm text-white/40 tracking-widest uppercase">智能投资决策系统</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="输入股票代码或名称，如 NVDA / 600519"
              className="search-input pl-12 pr-24 h-14 w-full text-base"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center"
                  >
                    <Loader2 className="w-5 h-5 text-accent animate-spin mr-2" />
                    <span className="text-sm text-white/50">查询中...</span>
                  </motion.div>
                ) : stockData || error ? (
                  <motion.button
                    key="clear"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleClear}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5 text-white/50" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="search"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={handleSearch}
                    className="p-2 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4 text-accent" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.header>

        {/* Quick Chips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="flex flex-wrap gap-3 mb-12"
        >
          {['NVDA', 'AAPL', 'TSLA', 'MSFT', '600519', '300750'].map((code, i) => (
            <motion.button
              key={code}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleQuickSearch(code)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-mono transition-all',
                'border border-white/10 bg-white/5',
                'hover:border-accent/50 hover:bg-accent/10',
                'hover:shadow-lg hover:shadow-accent/20'
              )}
            >
              {code}
            </motion.button>
          ))}
        </motion.div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <div>
                <div className="text-red-400 font-medium">查询失败</div>
                <div className="text-sm text-white/60">{error}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-accent/20" />
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-accent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ borderTopColor: 'transparent' }}
                />
              </div>
              <p className="mt-6 text-white/60">正在获取股票数据...</p>
              <p className="text-sm text-white/40 mt-1">首次查询可能需要几秒钟</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stock Data Display */}
        <AnimatePresence mode="wait">
          {stockData && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Stock Header Info */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-6 flex items-center gap-4 flex-wrap"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold">{stockData.name}</h2>
                  <span className="px-3 py-1 rounded-lg bg-white/10 text-white/70 font-mono">
                    {stockData.symbol}
                  </span>
                </div>
                {stockData.industry && (
                  <span className="px-3 py-1 rounded-lg bg-accent/10 text-accent text-sm">
                    {stockData.industry}
                  </span>
                )}
                <div className="ml-auto text-sm text-white/40 flex items-center gap-2">
                  <RefreshCw className="w-3 h-3" />
                  {formatDate(stockData.updatedAt)}
                </div>
              </motion.div>

              {/* Hero Section - Cedar Score */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="glass-card p-8 mb-8 relative overflow-hidden"
              >
                {/* Shimmer overlay */}
                <div className="absolute inset-0 shimmer" />
                
                <div className="relative flex flex-col lg:flex-row items-center gap-8">
                  {/* Left: Score Display */}
                  <div className="flex-1 text-center lg:text-left">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                      <span className="text-sm text-white/50 uppercase tracking-widest">综合评分</span>
                    </div>
                    <motion.div
                      initial={{ textShadow: '0 0 0px rgba(0,0,0,0)' }}
                      animate={{ textShadow: ['0 0 20px rgba(0,214,143,0.5)', '0 0 40px rgba(0,214,143,0.8)', '0 0 20px rgba(0,214,143,0.5)'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-7xl font-bold font-mono text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400 mb-2"
                    >
                      <AnimatedNumber value={stockData.cedarScore} />
                    </motion.div>
                    <CedarLevelDisplay level={stockData.cedarLevel} />
                    
                    {/* Price Info */}
                    <div className="mt-6 flex flex-col lg:flex-row items-center lg:items-start gap-4 lg:gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold font-mono">
                          ${stockData.price.current.toFixed(2)}
                        </div>
                        <PriceChange change={stockData.price.change} changePercent={stockData.price.changePercent} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-xs text-white/40">PE</div>
                          <div className="font-mono">{stockData.price.pe > 0 ? stockData.price.pe.toFixed(2) : 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40">PB</div>
                          <div className="font-mono">{stockData.price.pb > 0 ? stockData.price.pb.toFixed(2) : 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-xs text-white/40">市值</div>
                          <div className="font-mono text-sm">{formatMarketCap(stockData.price.marketCap)}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Breakdown */}
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    {[
                      { label: '赛道', value: stockData.trackScore, icon: Target },
                      { label: '成长', value: stockData.growthScore, icon: TrendingUp },
                      { label: '估值', value: stockData.valuationScore, icon: BarChart3 },
                      { label: '风险', value: stockData.riskScore, icon: Shield },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.1 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                      >
                        <div className="p-2 rounded-lg bg-accent/10">
                          <item.icon className="w-4 h-4 text-accent" />
                        </div>
                        <div>
                          <div className="text-lg font-bold font-mono">{item.value}</div>
                          <div className="text-xs text-white/40">{item.label}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              {/* Score Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <ScoreCard title="赛道评分" value={stockData.trackScore} grade={stockData.trackLevel} icon={Target} delay={0.1} />
                <ScoreCard title="成长性" value={stockData.growthScore} grade={stockData.growthLevel} icon={TrendingUp} delay={0.2} />
                <ScoreCard title="估值分析" value={stockData.valuationScore} icon={BarChart3} delay={0.3}>
                  <div className="mt-2">
                    <ValuationBadge level={stockData.valuationLevel} />
                  </div>
                </ScoreCard>
                <ScoreCard title="风险评估" value={stockData.riskScore} icon={Shield} delay={0.4}>
                  <div className="mt-2">
                    <RiskBadge level={stockData.riskLevel} />
                  </div>
                </ScoreCard>
                <ScoreCard title="市场情绪" value={stockData.marketTemp} icon={Activity} delay={0.5}>
                  <div className="mt-2">
                    <MarketTempBadge level={stockData.marketTempLevel} />
                  </div>
                </ScoreCard>
                <ScoreCard title="综合评分" value={stockData.cedarScore} grade={stockData.cedarLevel} icon={Award} delay={0.6} />
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Market Temperature */}
                <Card delay={0.7}>
                  <div className="flex items-center gap-2 mb-6">
                    <Thermometer className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-semibold">市场温度</h3>
                    <MarketTempBadge level={stockData.marketTempLevel} />
                  </div>
                  <div className="flex items-center justify-center mb-6">
                    <TempGauge value={stockData.marketTemp} />
                    <div className="ml-8 text-center">
                      <div className="text-4xl font-bold font-mono text-white mb-1">
                        <AnimatedNumber value={stockData.marketTemp} />
                      </div>
                      <div className="text-sm text-white/40">温度指数</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: '技术面', value: stockData.trackScore, color: 'from-blue-500 to-cyan-500' },
                      { label: '基本面', value: stockData.growthScore, color: 'from-green-500 to-emerald-500' },
                      { label: '资金面', value: stockData.riskScore, color: 'from-purple-500 to-pink-500' },
                    ].map(item => (
                      <div key={item.label} className="text-center">
                        <div className={`text-lg font-bold font-mono bg-gradient-to-r ${item.color} bg-clip-text text-transparent`}>
                          {item.value}
                        </div>
                        <div className="text-xs text-white/40">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* MA Evaluation */}
                <Card delay={0.8}>
                  <div className="flex items-center gap-2 mb-6">
                    <LineChart className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-semibold">均线系统</h3>
                    <span className={clsx(
                      'ml-auto px-2 py-1 rounded text-xs border',
                      stockData.maEvaluation.overall === 'bull' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      stockData.maEvaluation.overall === 'bear' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    )}>
                      {stockData.maEvaluation.overall === 'bull' ? '多头' : stockData.maEvaluation.overall === 'bear' ? '空头' : '中性'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    <MABadge label="MA30" status={stockData.maEvaluation.ma30} />
                    <MABadge label="MA60" status={stockData.maEvaluation.ma60} />
                    <MABadge label="MA120" status={stockData.maEvaluation.ma120} />
                    <MABadge label="MA240" status={stockData.maEvaluation.ma240} />
                  </div>
                  <div className="text-sm text-white/60 mb-4">
                    {stockData.maEvaluation.overall === 'bull' ? '价格处于均线上方，多头趋势' :
                     stockData.maEvaluation.overall === 'bear' ? '价格处于均线下方，空头趋势' :
                     '价格与均线纠缠，趋势不明'}
                  </div>
                  <div className="text-xs text-white/40">
                    绿色向上箭头表示价格高于均线，红色向下表示价格低于均线
                  </div>
                </Card>

                {/* Price Chart */}
                <Card delay={0.9} className="lg:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-semibold">价格走势</h3>
                  </div>
                  {stockData.price.history && stockData.price.history.length > 0 ? (
                    <MAChart history={stockData.price.history} />
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-white/40">
                      暂无历史数据
                    </div>
                  )}
                </Card>

                {/* China-US Mapping */}
                {stockData.chinaUsMapping && (
                  <Card delay={1.0} className="lg:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Map className="w-5 h-5 text-accent" />
                      <h3 className="text-lg font-semibold">中美对标</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-sm text-white/60 mb-2">对标美股</div>
                      <div className="text-lg font-semibold">{stockData.chinaUsMapping}</div>
                      <div className="text-xs text-white/40 mt-2">
                        基于 {stockData.industry} 行业的中美龙头对比
                      </div>
                    </div>
                  </Card>
                )}

                {/* AI Summary Placeholder */}
                {stockData.summary && (
                  <Card delay={1.1} className="lg:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                      <Brain className="w-5 h-5 text-accent" />
                      <h3 className="text-lg font-semibold">AI 智能分析</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-white/80 leading-relaxed">{stockData.summary}</p>
                    </div>
                  </Card>
                )}
              </div>

              {/* Data Source Footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-center text-xs text-white/30 mt-8 pb-8"
              >
                数据来源: TuShare Pro (A股) / Finnhub (美股) | 仅供投资参考，不构成投资建议
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        <AnimatePresence>
          {!stockData && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <div className="text-6xl mb-6">🔍</div>
              <h2 className="text-2xl font-bold mb-2">开始查询</h2>
              <p className="text-white/50">输入股票代码查看智能投资分析</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <div className="text-sm text-white/30">热门:</div>
                {['AAPL', 'NVDA', 'TSLA', '600519'].map(code => (
                  <button
                    key={code}
                    onClick={() => handleQuickSearch(code)}
                    className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 transition-colors"
                  >
                    {code}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
