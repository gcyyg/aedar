import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol
  try {
    const res = await fetch(`${BACKEND_URL}/api/stock/${encodeURIComponent(symbol)}`, {
      next: { revalidate: 300 } // cache 5 min
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Backend unavailable', symbol }, { status: 502 })
  }
}
