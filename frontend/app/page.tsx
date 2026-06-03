'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, TrendingUp, TrendingDown, AlertTriangle, Shield,
  Activity, BarChart3, ArrowUpRight, ArrowDownRight,
  Zap, Target, Award, ChevronRight, Loader2, Sparkles,
  ArrowRight, Droplet, Thermometer, LineChart, Map, Brain
} from 'lucide-react'
import ReactECharts from 'echarts-for-react'
import { clsx } from 'clsx'

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

// ── MA Chart ──────────────────────────────────────────
function MAChart() {
  const option = {
    backgroundColor: 'transparent',
    grid: { top: 20, right: 20, bottom: 40, left: 50 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 60 }, (_, i) => i),
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
        data: Array.from({ length: 60 }, (_, i) => {
          const base = 180 + Math.sin(i * 0.15) * 10 + Math.random() * 5
          return base.toFixed(2)
        }),
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
      {
        name: 'MA30',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: Array.from({ length: 60 }, (_, i) => (175 + i * 0.3 + Math.sin(i * 0.1) * 5).toFixed(2)),
        lineStyle: { color: '#ffaa00', width: 1, type: 'dashed' },
        animationDuration: 2500,
        animationDelay: 500,
      },
      {
        name: 'MA60',
        type: 'line',
        smooth: true,
        symbol: 'none',
        data: Array.from({ length: 60 }, (_, i) => (170 + i * 0.25 + Math.cos(i * 0.08) * 4).toFixed(2)),
        lineStyle: { color: '#00d68f', width: 1, type: 'dotted' },
        animationDuration: 3000,
        animationDelay: 1000,
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
function ScoreCard({ title, value, grade, icon: Icon, delay = 0 }: {
  title: string; value: number; grade?: string; icon: any; delay?: number
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
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────
export default function HomePage() {
  const [searchValue, setSearchValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
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
    await new Promise(r => setTimeout(r, 2000))
    setIsLoading(false)
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
              className="search-input pl-12 pr-12 h-14 w-full text-base"
            />
            <AnimatePresence>
              {isLoading ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <Loader2 className="w-5 h-5 text-accent animate-spin" />
                </motion.div>
              ) : (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={handleSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors"
                >
                  <ArrowRight className="w-4 h-4 text-accent" />
                </motion.button>
              )}
            </AnimatePresence>
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
              onClick={() => setSearchValue(code)}
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

        {/* Hero Section - Cedar Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
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
                <AnimatedNumber value={87} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
              >
                <Award className="w-4 h-4 text-green-400" />
                <span className="text-green-400 font-semibold">钻石级</span>
              </motion.div>
            </div>

            {/* Right: Breakdown */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { label: '赛道', value: 95, icon: Target },
                { label: '成长', value: 92, icon: TrendingUp },
                { label: '估值', value: 78, icon: BarChart3 },
                { label: '风险', value: 82, icon: Shield },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.1 }}
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
          <ScoreCard title="赛道评分" value={95} grade="S" icon={Target} delay={0.1} />
          <ScoreCard title="成长性" value={92} grade="A" icon={TrendingUp} delay={0.2} />
          <ScoreCard title="估值分析" value={78} icon={BarChart3} delay={0.3} />
          <ScoreCard title="风险评估" value={82} icon={Shield} delay={0.4} />
          <ScoreCard title="市场情绪" value={68} icon={Activity} delay={0.5} />
          <ScoreCard title="资金流向" value={75} icon={Droplet} delay={0.6} />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Market Temperature */}
          <Card delay={0.7}>
            <div className="flex items-center gap-2 mb-6">
              <Thermometer className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold">市场温度</h3>
              <span className="ml-auto text-sm px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                高温
              </span>
            </div>
            <div className="flex items-center justify-center mb-6">
              <TempGauge value={78} />
              <div className="ml-8 text-center">
                <div className="text-4xl font-bold font-mono text-white mb-1">
                  <AnimatedNumber value={78} />
                </div>
                <div className="text-sm text-white/40">温度指数</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '技术面', value: 80, color: 'from-blue-500 to-cyan-500' },
                { label: '情绪面', value: 75, color: 'from-purple-500 to-pink-500' },
                { label: '资金面', value: 78, color: 'from-green-500 to-emerald-500' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className={clsx('text-lg font-bold font-mono bg-gradient-to-r bg-clip-text text-transparent', item.color)}>
                    {item.value}
                  </div>
                  <div className="text-xs text-white/40 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* MA Evaluation */}
          <Card delay={0.8}>
            <div className="flex items-center gap-2 mb-4">
              <LineChart className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold">均线评估</h3>
              <span className="ml-auto text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                多头排列
              </span>
            </div>
            <MAChart />
            <div className="flex justify-center gap-6 mt-4">
              {[
                { label: 'MA30', value: '多头', color: 'text-yellow-400' },
                { label: 'MA60', value: '多头', color: 'text-green-400' },
                { label: 'MA120', value: '多头', color: 'text-cyan-400' },
                { label: 'MA240', value: '多头', color: 'text-blue-400' },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <div className={clsx('text-sm font-mono font-bold', item.color)}>{item.value}</div>
                  <div className="text-xs text-white/30 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* China-US Mapping */}
        <Card delay={0.9} className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Map className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold">中美产业映射</h3>
          </div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {[
              { us: 'NVIDIA', cn: ['寒武纪', '海光信息', '中际旭创'], symbol: 'NVDA' },
              { us: 'Tesla', cn: ['比亚迪', '小鹏汽车', '理想汽车'], symbol: 'TSLA' },
              { us: 'Apple', cn: ['华为', '小米', 'OPPO'], symbol: 'AAPL' },
            ].map((item, i) => (
              <motion.div
                key={item.us}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 + i * 0.2 }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="text-center">
                  <div className="text-sm font-bold text-white">{item.us}</div>
                  <div className="text-xs text-white/40">{item.symbol}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-white/20" />
                <div className="flex gap-2">
                  {item.cn.map(cn => (
                    <span key={cn} className="px-2 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-xs border border-blue-500/30">
                      {cn}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* AI Summary */}
        <Card delay={1.0} className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Brain className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold">AI 投资总结</h3>
            <div className="ml-auto flex items-center gap-1 text-xs text-white/40">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              MiniMax-M2.7
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Summary Points */}
            <div className="space-y-4">
              {[
                { icon: TrendingUp, label: '核心逻辑', text: 'AI赛道持续爆发，NVIDIA作为GPU霸主享受行业红利，订单排期已至2027年', color: 'text-green-400' },
                { icon: Target, label: '成长动力', text: '数据中心业务同比+409%，AI芯片需求远超供给，侧翼竞争者短期无法威胁', color: 'text-blue-400' },
                { icon: Shield, label: '风险提示', text: '估值偏高(PE 65x)，警惕竞争格局变化与宏观利率冲击', color: 'text-yellow-400' },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + i * 0.2 }}
                  className="flex gap-3 p-3 rounded-xl bg-white/5"
                >
                  <div className={clsx('mt-1', item.color)}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-white/40 mb-1">{item.label}</div>
                    <div className="text-sm text-white/80 leading-relaxed">{item.text}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right: Verdict */}
            <div className="flex flex-col justify-between">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5 }}
                className="p-6 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/30 text-center"
              >
                <div className="text-6xl mb-4">💎</div>
                <div className="text-2xl font-bold text-green-400 mb-2">强烈推荐买入</div>
                <div className="text-sm text-white/60">目标价: $200</div>
                <div className="text-xs text-white/40 mt-1">较当前价 +25%</div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 mt-1" />
                  <div className="text-sm text-yellow-400/80">
                    当前估值偏高，建议分批建仓，短期回调风险存在。中长期看好，需关注宏观利率变化。
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </Card>

        {/* Industry Chain */}
        <Card delay={1.1} className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold">产业链地图</h3>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {[
              { label: '上游', items: ['台积电', 'SK海力士', 'ASML', '信越化学'], color: 'border-blue-500/50 bg-blue-500/10' },
              { label: '中游', items: ['NVIDIA', 'AMD', '英特尔', '高通'], color: 'border-purple-500/50 bg-purple-500/10' },
              { label: '下游', items: ['AWS', 'Azure', 'Google', 'Meta', 'OpenAI'], color: 'border-green-500/50 bg-green-500/10' },
            ].map((layer, i) => (
              <div key={layer.label} className="flex-1 min-w-[200px]">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.3 + i * 0.2 }}
                  className={clsx('p-4 rounded-xl border', layer.color)}
                >
                  <div className="text-xs text-white/40 uppercase tracking-widest mb-3">{layer.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {layer.items.map(item => (
                      <span key={item} className="px-3 py-1 rounded-lg bg-white/10 text-sm text-white/80 border border-white/5">
                        {item}
                      </span>
                    ))}
                  </div>
                </motion.div>
                {i < 2 && (
                  <div className="hidden lg:flex items-center justify-center py-2">
                    <ChevronRight className="w-4 h-4 text-white/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="text-center text-sm text-white/30 pt-8 border-t border-white/5"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            {['Next.js 15', 'Fastify', 'TuShare Pro', 'Finnhub', 'MiniMax AI'].map((tech, i) => (
              <span key={tech} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
                {tech}
              </span>
            ))}
          </div>
          <p>CEDAR AI 智能投资决策系统 · 2026</p>
        </motion.footer>
      </div>
    </div>
  )
}