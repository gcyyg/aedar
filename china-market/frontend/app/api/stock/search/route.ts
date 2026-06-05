import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''

  if (!q.trim()) {
    return NextResponse.json({ results: [] })
  }

  try {
    const proxiedUrl = `http://localhost:3002/api/stock/search?q=${encodeURIComponent(q)}`
    const res = await fetch(proxiedUrl, { next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`Backend ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}
