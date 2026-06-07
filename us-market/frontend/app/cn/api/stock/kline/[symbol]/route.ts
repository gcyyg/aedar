import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const { symbol } = params

  if (!symbol?.trim()) {
    return NextResponse.json({ error: 'Missing symbol' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `http://localhost:3002/api/stock/kline/${encodeURIComponent(symbol)}`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: 'K线数据获取失败' }, { status: 502 })
  }
}
