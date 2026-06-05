import { NextResponse } from 'next/server'

const CHINA_BACKEND_URL = process.env.CHINA_BACKEND_URL || 'http://localhost:3002'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  try {
    const res = await fetch(`${CHINA_BACKEND_URL}/api/stock/search?q=${encodeURIComponent(q)}`, {
      next: { revalidate: 300 }
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 502 })
  }
}