'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

interface ChainNode {
  id: string
  symbol: string
  name: string
  industry: string
  logo: string
  score: number
  level: string
  relation: string
}

interface ChainEdge {
  source: string
  target: string
  type: string
  strength: number
}

interface ChainData {
  symbol: string
  name: string
  industry: string
  nodes: ChainNode[]
  edges: ChainEdge[]
}

// 行业 → 颜色映射
const INDUSTRY_COLORS: Record<string, string> = {
  '白酒': '#c0392b',
  '银行': '#f39c12',
  '化学制药': '#e74c3c',
  '生物制药': '#e74c3c',
  '中药': '#c0392b',
  '医疗器械': '#27ae60',
  '医疗服务': '#27ae60',
  '医药服务': '#27ae60',
  '半导体': '#0095ff',
  'LED': '#9b59b6',
  '电子元件': '#8e44ad',
  '电子制造': '#8e44ad',
  '消费电子': '#0095ff',
  '通信设备': '#0095ff',
  '软件服务': '#00d68f',
  'AI': '#00d68f',
  '云计算': '#00d68f',
  '光伏': '#f1c40f',
  '锂电池': '#27ae60',
  '新能源汽车': '#e67e22',
  '汽车整车': '#e67e22',
  '汽车零部件': '#e67e22',
  '充电桩': '#e67e22',
  '电力设备': '#3498db',
  '电力': '#3498db',
  '水电': '#3498db',
  '核电': '#3498db',
  '新能源': '#2ecc71',
  '煤炭': '#7f8c8d',
  '石油开采': '#7f8c8d',
  '钢铁': '#7f8c8d',
  '化工': '#7f8c8d',
  '石化': '#7f8c8d',
  '水泥': '#7f8c8d',
  '家电': '#e84393',
  '房地产': '#e84393',
  '证券': '#e67e22',
  '保险': '#e67e22',
  '航空': '#2980b9',
  '航空装备': '#2980b9',
  '航空发动机': '#2980b9',
  '航运': '#2980b9',
  '船舶': '#2980b9',
  '稀土': '#2980b9',
  '黄金': '#f39c12',
  '锂矿': '#27ae60',
  '农产品加工': '#27ae60',
  '食品加工': '#e74c3c',
  '饮料乳品': '#e74c3c',
  '调味品': '#e74c3c',
  '乳品': '#e74c3c',
  '畜禽养殖': '#27ae60',
  '旅游零售': '#9b59b6',
  'Unknown': '#666'
}

// 关系类型 → 标签
const RELATION_LABELS: Record<string, string> = {
  self: '目标',
  peer: '同行',
  upstream: '上游',
  downstream: '下游',
  related: '关联'
}

// 生成公司首字母缩写 SVG（作为 Logo 替代）
function makeInitialsSVG(symbol: string, _name: string, color: string): string {
  // 优先显示股票代码，没有则显示名称前2字符
  const abbrev = symbol ? symbol.slice(0, 6) : _name.slice(0, 2)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="${color}" rx="8"/>
    <text x="32" y="40" font-size="${abbrev.length > 4 ? '14' : '18'}" font-weight="bold" fill="white"
      text-anchor="middle" font-family="sans-serif">${abbrev}</text>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function getNodeColor(industry: string, relation: string, targetSymbol: string, symbol: string): string {
  const baseColor = INDUSTRY_COLORS[industry] || '#666'
  if (symbol === targetSymbol) return baseColor
  return baseColor + '80' // 半透明
}

function getStrokeColor(symbol: string, targetSymbol: string): string {
  return symbol === targetSymbol ? '#fff' : 'rgba(255,255,255,0.3)'
}

function getStrokeWidth(symbol: string, targetSymbol: string): number {
  return symbol === targetSymbol ? 2 : 1
}

export default function ChainMap({ symbol }: { symbol: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<ChainData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError('')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    fetch(`/api/chain/${symbol}/chain`, { signal: controller.signal })
      .then(r => {
        clearTimeout(timeout)
        if (!r.ok) throw new Error('获取产业链数据失败')
        return r.json()
      })
      .then(d => {
        // 为每个节点生成 logo SVG
        const enriched = {
          ...d,
          nodes: d.nodes.map((n: any) => ({
            ...n,
            id: n.symbol,
            logo: n.logo || makeInitialsSVG(n.symbol, n.name, INDUSTRY_COLORS[n.industry] || '#666')
          }))
        }
        setData(enriched)
        setLoading(false)
      })
      .catch(e => {
        clearTimeout(timeout)
        setError(e.name === 'AbortError' ? '超时' : e.message)
        setLoading(false)
      })
  }, [symbol])

  useEffect(() => {
    if (!data || !svgRef.current) return
    renderChart()
  }, [data])

  function renderChart() {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current!.clientWidth || 600
    const height = 420
    const targetSymbol = data!.symbol

    svg.attr('width', width).attr('height', height)

    // 背景
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'rgba(10,10,20,0.5)')
      .attr('rx', 12)

    const nodes = data!.nodes.map(n => ({ ...n }))
    const edges = data!.edges.map(e => ({ ...e }))

    // 力导向布局
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(edges as any).id((d: any) => d.id).distance(120).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-350))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50))

    // 绘制连线
    const link = svg.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => d.type === 'upstream' ? '#ff6b35' : '#00d68f')
      .attr('stroke-width', 1.5)
      .attr('opacity', (d: any) => d.type === 'upstream' ? 0.7 : 0.5)
      .attr('stroke-dasharray', (d: any) => d.type === 'upstream' ? '6,4' : 'none')

    // 绘制节点组
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    const isTarget = (d: any) => d.symbol === targetSymbol
    const r = (d: any) => isTarget(d) ? 34 : 26

    // 节点圆圈
    node.append('circle')
      .attr('r', r)
      .attr('fill', (d: any) => getNodeColor(d.industry, d.relation, targetSymbol, d.symbol))
      .attr('stroke', (d: any) => getStrokeColor(d.symbol, targetSymbol))
      .attr('stroke-width', (d: any) => getStrokeWidth(d.symbol, targetSymbol))

    // Logo clipPath
    node.append('clipPath')
      .attr('id', (d: any) => `clip-${d.symbol}`)
      .append('circle')
      .attr('r', (d: any) => isTarget(d) ? 28 : 20)

    // Logo 图像
    node.append('image')
      .attr('xlink:href', (d: any) => d.logo)
      .attr('x', (d: any) => isTarget(d) ? -28 : -20)
      .attr('y', (d: any) => isTarget(d) ? -28 : -20)
      .attr('width', (d: any) => isTarget(d) ? 56 : 40)
      .attr('height', (d: any) => isTarget(d) ? 56 : 40)
      .attr('clip-path', (d: any) => `url(#clip-${d.symbol})`)
      .attr('preserveAspectRatio', 'xMidYMid slice')

    // ★ 中文名称标签（所有节点）
    node.append('text')
      .text((d: any) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => isTarget(d) ? 50 : 40)
      .attr('fill', '#fff')
      .attr('font-size', (d: any) => isTarget(d) ? 10 : 9)
      .attr('font-weight', (d: any) => isTarget(d) ? 'bold' : 'normal')
      .attr('paint-order', 'stroke')
      .attr('stroke', 'rgba(0,0,0,0.6)')
      .attr('stroke-width', 3)
      .each(function(d: any) {
        const el = d3.select(this)
        const text = el.text()
        // 超长名称截断（4个字截为3个）
        if (text.length > 4) el.text(text.slice(0, 4) + '…')
      })

    // 关系类型标签（同行/上下游）
    node.append('text')
      .text((d: any) => {
        if (d.symbol === targetSymbol) return ''
        return RELATION_LABELS[d.relation] || d.relation
      })
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => isTarget(d) ? 62 : 52)
      .attr('fill', 'rgba(255,255,255,0.5)')
      .attr('font-size', 8)

    // 更新位置
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })
  }

  if (loading) {
    return (
      <div className="bg-[rgba(15,15,25,0.6)] border border-white/[0.08] rounded-xl p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#0095ff] border-t-transparent rounded-full mx-auto mb-3"></div>
        <p className="text-white/40 text-sm">产业链地图加载中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-[rgba(15,15,25,0.6)] border border-white/[0.08] rounded-xl p-8 text-center">
        <p className="text-red-400 text-sm">⚠️ {error}</p>
      </div>
    )
  }

  if (!data) return null

  const industries = [...new Set(data.nodes.map(n => n.industry))]

  return (
    <div className="bg-[rgba(15,15,25,0.6)] border border-white/[0.08] rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔗</span>
          <span className="text-sm font-medium text-white">产业链地图</span>
          <span className="text-xs text-white/40">{data.name} · {data.nodes.length} 个节点</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {industries.map(ind => (
            <span
              key={ind}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${INDUSTRY_COLORS[ind] || '#666'}30`,
                color: INDUSTRY_COLORS[ind] || '#666'
              }}
            >
              {ind}
            </span>
          ))}
        </div>
      </div>

      {/* 图表区域 */}
      <div className="p-4">
        <svg ref={svgRef} className="w-full" style={{ height: 420 }} />
      </div>

      {/* 图例 */}
      <div className="px-4 pb-3 flex gap-4 text-[10px] text-white/40 flex-wrap">
        <span>● 拖拽节点移动</span>
        <span>● 虚线 = 上游关系</span>
        <span>● 实线 = 同行/下游</span>
      </div>
    </div>
  )
}