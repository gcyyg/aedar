import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'http://localhost:3000'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol
  try {
    const res = await fetch(`${BACKEND_URL}/api/chain/${encodeURIComponent(symbol)}`, {
      next: { revalidate: 120 }
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Backend unavailable', symbol }, { status: 502 })
  }
}