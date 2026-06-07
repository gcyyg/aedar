'use client'
import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  BarChart3, TrendingUp, Shield, Users, FileText, 
  Loader2, X, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react'

// ── Types ──────────────────────────────────────────
type AnalysisType = 'comps' | 'dcf' | 'lbo' | 'competitive' | 'audit'

interface AnalysisSection {
  title: string
  content: string
  data?: Record<string, string | number>
}

interface TableData {
  headers: string[]
  rows: (string | number)[][]
  stats?: { label: string; value: string }[]
}

interface SensitivityTable {
  rowHeaders: string[]
  colHeaders: string[]
  centerLabel: string
  values: (string | number)[][]
}

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'scatter'
  title: string
  labels: string[]
  series: { name: string; data: number[] }[]
}

interface AnalysisResult {
  type: AnalysisType
  symbol: string
  name: string
  title: string
  sections: AnalysisSection[]
  table?: TableData
  sensitivity?: SensitivityTable
  chartData?: ChartData
  keyMetrics?: Record<string, string | number>
  summary: string
  disclaimer: string
  generatedAt: string
}

// ── Config ──────────────────────────────────────────
const ANALYSIS_CONFIGS: Record<AnalysisType, {
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  desc: string
}> = {
  comps: {
    label: '同业比较',
    icon: '📊',
    color: '#00d68f',
    bgColor: 'rgba(0,214,143,0.08)',
    borderColor: 'rgba(0,214,143,0.25)',
    desc: 'EV/EBITDA、EV/Revenue、P/E 等估值倍数统计',
  },
  dcf: {
    label: 'DCF估值',
    icon: '💰',
    color: '#ffd700',
    bgColor: 'rgba(255,215,0,0.08)',
    borderColor: 'rgba(255,215,0,0.25)',
    desc: '现金流折现、敏感性分析、内在价值',
  },
  lbo: {
    label: 'LBO分析',
    icon: '🏦',
    color: '#ff6b6b',
    bgColor: 'rgba(255,107,107,0.08)',
    borderColor: 'rgba(255,107,107,0.25)',
    desc: '杠杆收购、IRR/MOIC回报、债务安排',
  },
  competitive: {
    label: '竞争格局',
    icon: '🗺️',
    color: '#00b4d8',
    bgColor: 'rgba(0,180,216,0.08)',
    borderColor: 'rgba(0,180,216,0.25)',
    desc: '市场定位、竞品对比、SWOT分析',
  },
  audit: {
    label: '模型审计',
    icon: '🔍',
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.08)',
    borderColor: 'rgba(167,139,250,0.25)',
    desc: '公式检查、BS平衡、逻辑验证',
  },
}

// ── Sensitivity Matrix ──────────────────────────────────────────
function SensitivityMatrix({ data }: { data: SensitivityTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left text-white/40 pr-4 py-1">WACC ↓ / g →</th>
            {data.colHeaders.map((h, i) => (
              <th key={i} className="text-center text-white/60 px-3 py-1 font-normal">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rowHeaders.map((rowH, ri) => (
            <tr key={ri}>
              <td className="text-right text-white/40 pr-4 py-1 font-mono">{rowH}</td>
              {data.colHeaders.map((_, ci) => {
                const val = data.values[ri]?.[ci]
                const isCenter = ri === Math.floor(data.rowHeaders.length / 2) && ci === Math.floor(data.colHeaders.length / 2)
                return (
                  <td key={ci} className={`text-center px-3 py-1 font-mono ${isCenter ? 'font-bold text-white' : 'text-white/70'}`}
                    style={isCenter ? { background: 'rgba(0,214,143,0.15)', borderRadius: '4px' } : {}}>
                    {typeof val === 'number' ? `$${val}` : val}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[10px] text-white/30 mt-2 text-center">
        {data.centerLabel} 高亮 · 单位：美元/股
      </div>
    </div>
  )
}

// ── Comps Table ──────────────────────────────────────────
function CompsTable({ data }: { data: TableData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            {data.headers.map((h, i) => (
              <th key={i} className="text-left text-white/40 pb-2 pr-4 font-normal first:text-white/60">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-white/[0.06]">
              {row.map((cell, ci) => (
                <td key={ci} className={`py-2 pr-4 ${ci === 0 ? 'text-white/80' : 'text-white/60 font-mono'} ${typeof cell === 'number' && ci > 0 ? 'text-right' : ''}`}>
                  {typeof cell === 'number' ? (ci > 0 ? cell.toFixed(1) : cell) : cell}
                </td>
              ))}
            </tr>
          ))}
          {data.stats && (
            <tr className="border-t border-white/10">
              {data.headers.map((_, ci) => {
                const stat = data.stats?.[ci - 1]
                return (
                  <td key={ci} className={`py-2 pr-4 font-medium text-[10px] ${ci === 0 ? 'text-white/40' : 'text-white/50 font-mono text-right'}`}>
                    {ci === 0 ? stat?.label || '' : stat?.value || ''}
                  </td>
                )
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ── Bar Chart (CSS) ──────────────────────────────────────────
function BarChartSimple({ data }: { data: ChartData }) {
  const maxVal = Math.max(...data.series.flatMap(s => s.data))
  return (
    <div>
      <div className="text-[10px] text-white/30 mb-3">{data.title}</div>
      <div className="flex items-end gap-3 h-32">
        {data.labels.map((label, li) => (
          <div key={li} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex flex-col gap-0.5">
              {data.series.map((s, si) => (
                <div key={si} className="h-4 rounded-sm" style={{ 
                  width: `${maxVal > 0 ? (s.data[li] / maxVal * 100) : 0}%`,
                  background: si === 0 ? '#00d68f' : si === 1 ? '#ffd700' : '#ff6b6b',
                  marginLeft: 'auto',
                }} />
              ))}
            </div>
            <div className="text-[9px] text-white/30 text-center" style={{ fontSize: '9px' }}>{label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        {data.series.map((s, si) => (
          <div key={si} className="flex items-center gap-1 text-[10px] text-white/40">
            <div className="w-2 h-2 rounded-sm" style={{ background: si === 0 ? '#00d68f' : si === 1 ? '#ffd700' : '#ff6b6b' }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Key Metrics Grid ──────────────────────────────────────────
function KeyMetricsGrid({ metrics }: { metrics: Record<string, string | number> }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {Object.entries(metrics).map(([key, val]) => (
        <div key={key} className="bg-white/[0.04] border border-white/[0.07] rounded-lg p-2">
          <div className="text-[9px] text-white/30 mb-1">{key}</div>
          <div className="text-sm font-bold font-mono text-white">{val}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main Analysis Result Card ──────────────────────────────────────────
function AnalysisResultCard({ result, onClose }: { result: AnalysisResult; onClose: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({})
  const cfg = ANALYSIS_CONFIGS[result.type]

  const toggleSection = (i: number) => setExpandedSections(prev => ({ ...prev, [i]: !prev[i] }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-xl border overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.4)', borderColor: cfg.borderColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: cfg.borderColor, background: cfg.bgColor }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{cfg.icon}</span>
          <div>
            <div className="text-sm font-bold text-white">{result.title}</div>
            <div className="text-[10px] text-white/40">{result.name} · {result.generatedAt}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Key Metrics */}
      {result.keyMetrics && Object.keys(result.keyMetrics).length > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <KeyMetricsGrid metrics={result.keyMetrics} />
        </div>
      )}

      {/* Comps Table */}
      {result.table && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <CompsTable data={result.table} />
        </div>
      )}

      {/* Sensitivity Matrix */}
      {result.sensitivity && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="text-[10px] text-white/30 mb-3 uppercase tracking-wider">敏感性分析 · 单位：美元/股</div>
          <SensitivityMatrix data={result.sensitivity} />
        </div>
      )}

      {/* Chart */}
      {result.chartData && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <BarChartSimple data={result.chartData} />
        </div>
      )}

      {/* Sections */}
      {result.sections.map((section, i) => (
        <div key={i} className="border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <button
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
            onClick={() => toggleSection(i)}
          >
            <span className="text-xs font-medium text-white/80">{section.title}</span>
            {expandedSections[i] ? <ChevronUp size={12} className="text-white/30" /> : <ChevronDown size={12} className="text-white/30" />}
          </button>
          <AnimatePresence>
            {expandedSections[i] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="px-4 pb-3"
              >
                <p className="text-[11px] text-white/50 leading-relaxed">{section.content}</p>
                {section.data && (
                  <div className="mt-2 grid grid-cols-2 gap-1">
                    {Object.entries(section.data).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[10px]">
                        <span className="text-white/30">{k}</span>
                        <span className="text-white/60 font-mono">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Summary */}
      <div className="px-4 py-3" style={{ background: cfg.bgColor }}>
        <div className="text-[10px] text-white/30 mb-1.5 uppercase tracking-wider">分析结论</div>
        <p className="text-xs text-white/70 leading-relaxed">{result.summary}</p>
        <div className="mt-2 flex items-start gap-1.5 text-[9px] text-white/25">
          <AlertTriangle size={10} className="mt-0.5 shrink-0" />
          <span>{result.disclaimer}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ── Analysis Buttons ──────────────────────────────────────────
const ANALYSIS_TYPES: AnalysisType[] = ['comps', 'dcf', 'lbo', 'competitive', 'audit']

interface AnalysisButtonsProps {
  symbol: string
  market: 'us' | 'china'
}

export default function AnalysisButtons({ symbol, market }: AnalysisButtonsProps) {
  const [activeType, setActiveType] = useState<AnalysisType | null>(null)
  const [loadingStates, setLoadingStates] = useState<Record<AnalysisType, boolean>>({
    comps: false, dcf: false, lbo: false, competitive: false, audit: false,
  })
  const [results, setResults] = useState<Record<AnalysisType, AnalysisResult | null>>({
    comps: null, dcf: null, lbo: null, competitive: null, audit: null,
  })

  // 加载单个分析
  const loadAnalysis = useCallback(async (type: AnalysisType) => {
    if (results[type]) return // 已有结果不重复加载
    setLoadingStates(prev => ({ ...prev, [type]: true }))
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`/${market === 'china' ? 'cn/' : ''}api/analysis/${type}/${symbol}?market=${market}`, { signal: controller.signal })
      clearTimeout(timeoutId)
      if (!res.ok) throw new Error('请求失败')
      const data = await res.json()
      setResults(prev => ({ ...prev, [type]: data }))
    } catch (e: any) {
      if (e.name === 'AbortError' || e.message?.includes('abort')) {
        console.error('Analysis timeout:', type)
      } else {
        console.error('Analysis error:', e)
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [type]: false }))
    }
  }, [symbol, market, results])

  // 股票代码变化时，重置状态
  useEffect(() => {
    if (!symbol) return
    setResults({ comps: null, dcf: null, lbo: null, competitive: null, audit: null })
    setActiveType(null)
  }, [symbol])

  const currentResult = activeType ? results[activeType] : null

  return (
    <div className="space-y-4">
      {/* Buttons Row */}
      <div className="flex flex-wrap gap-2">
        {ANALYSIS_TYPES.map(type => {
          const cfg = ANALYSIS_CONFIGS[type]
          const isActive = activeType === type
          const isLoading = loadingStates[type]
          const hasResult = !!results[type]
          return (
            <button
              key={type}
              onClick={() => setActiveType(isActive ? null : type)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all hover:scale-[1.02]"
              style={{
                background: isActive ? cfg.bgColor : hasResult ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                borderColor: isActive ? cfg.borderColor : hasResult ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
                color: isActive ? cfg.color : hasResult ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)',
              }}
            >
              <span>{cfg.icon}</span>
              <span>{cfg.label}</span>
              {isLoading && <Loader2 size={10} className="animate-spin" />}
              {!isLoading && !hasResult && <span className="w-1.5 h-1.5 rounded-full bg-white/20" />}
            </button>
          )
        })}
      </div>

      {/* Analysis Result Panel */}
      <AnimatePresence mode="wait">
        {currentResult && (
          <AnalysisResultCard
            key={activeType}
            result={currentResult}
            onClose={() => setActiveType(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}