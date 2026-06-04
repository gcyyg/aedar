import { NextResponse } from 'next/server'

const US_BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'
const CHINA_BACKEND_URL = process.env.CHINA_BACKEND_URL || 'http://localhost:3002'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const { searchParams } = new URL(request.url)
  const market = searchParams.get('market') || 'us'
  const symbol = params.symbol

  const backend = market === 'china' ? CHINA_BACKEND_URL : US_BACKEND_URL

  try {
    const res = await fetch(`${backend}/api/stock/${encodeURIComponent(symbol)}?market=${market}`, {
      next: { revalidate: 300 }
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Backend unavailable', symbol }, { status: 502 })
  }
}
