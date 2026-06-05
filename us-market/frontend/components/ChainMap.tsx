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
}

interface ChainEdge {
  source: string
  target: string
  type: string
  strength: number
}

interface ChainData {
  symbol: string
  nodes: ChainNode[]
  edges: ChainEdge[]
}

const INDUSTRY_COLORS: Record<string, string> = {
  'Semiconductors': '#0095ff',
  'Software': '#00d68f',
  'Technology': '#7b61ff',
  'Automobiles': '#ff6b35',
  'Banking': '#ffd700',
  'Retail': '#ff9ecd',
  'Energy': '#00c7b7',
  'Healthcare': '#ff6b6b',
  'Unknown': '#666'
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
    
    fetch(`/cn/api/chain/${symbol}/chain`, { signal: controller.signal })
      .then(r => {
        clearTimeout(timeout)
        if (!r.ok) throw new Error('获取产业链数据失败')
        return r.json()
      })
      .then(d => {
        setData(d)
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
    const height = 400

    svg.attr('width', width).attr('height', height)

    // 添加背景
    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'rgba(10,10,20,0.5)')
      .attr('rx', 12)

    const nodes = data!.nodes.map(n => ({ ...n, id: n.symbol }))
    const edges = data!.edges
      .filter(e => e.type === 'industry')
      .map(e => ({ ...e }))

    // 力导向布局
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(edges as any).id((d: any) => d.id).distance(100).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(45))

    // 绘制连线
    const link = svg.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', 'rgba(0,149,255,0.2)')
      .attr('stroke-width', 1)

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

    // 节点圆圈
    node.append('circle')
      .attr('r', d => d.symbol === data!.symbol ? 32 : 24)
      .attr('fill', d => {
        const color = INDUSTRY_COLORS[d.industry] || '#666'
        return d.symbol === data!.symbol ? color : `${color}80`
      })
      .attr('stroke', d => d.symbol === data!.symbol ? '#fff' : 'rgba(255,255,255,0.3)')
      .attr('stroke-width', d => d.symbol === data!.symbol ? 2 : 1)

    // Logo 图像
    node.append('clipPath')
      .attr('id', d => `clip-${d.symbol}`)
      .append('circle')
      .attr('r', d => d.symbol === data!.symbol ? 28 : 20)

    node.append('image')
      .attr('xlink:href', d => d.logo)
      .attr('x', d => d.symbol === data!.symbol ? -28 : -20)
      .attr('y', d => d.symbol === data!.symbol ? -28 : -20)
      .attr('width', d => d.symbol === data!.symbol ? 56 : 40)
      .attr('height', d => d.symbol === data!.symbol ? 56 : 40)
      .attr('clip-path', d => `url(#clip-${d.symbol})`)
      .attr('preserveAspectRatio', 'xMidYMid slice')

    // 股票代码
    node.append('text')
      .text(d => d.symbol)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.symbol === data!.symbol ? 48 : 38)
      .attr('fill', '#fff')
      .attr('font-size', d => d.symbol === data!.symbol ? 12 : 10)
      .attr('font-weight', d => d.symbol === data!.symbol ? 'bold' : 'normal')

    // 节点评分
    node.append('text')
      .text(d => d.score)
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.symbol === data!.symbol ? 62 : 50)
      .attr('fill', 'rgba(255,255,255,0.4)')
      .attr('font-size', 9)

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
          <span className="text-xs text-white/40">{data.symbol} · {data.nodes.length} 个节点</span>
        </div>
        <div className="flex gap-2">
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
        <svg ref={svgRef} className="w-full" style={{ height: 400 }} />
      </div>

      {/* 图例 */}
      <div className="px-4 pb-3 flex gap-4 text-[10px] text-white/40">
        <span>● 拖拽节点移动</span>
        <span>● 线条 = 行业关联</span>
        <span>● 圆圈大小 = 关注度</span>
      </div>
    </div>
  )
}