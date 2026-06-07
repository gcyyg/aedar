import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string; symbol: string } }
) {
  const { type, symbol } = params
  const { searchParams } = new URL(request.url)

  if (!symbol?.trim()) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  try {
    const url = `http://localhost:3002/api/analysis/${type}/${encodeURIComponent(symbol)}`
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: '深度分析数据获取失败' }, { status: 502 })
  }
}
