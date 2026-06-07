import { NextResponse } from 'next/server'

const US_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') || 'us'
  const symbol = params.symbol

  const backend = market === 'china' ? process.env.CHINA_BACKEND_URL || 'http://localhost:3002' : US_BACKEND_URL

  try {
    const res = await fetch(`${backend}/api/stock/kline/${encodeURIComponent(symbol)}?market=${market}`, {
      next: { revalidate: 300 }
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'K线数据获取失败' }, { status: 404 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}
