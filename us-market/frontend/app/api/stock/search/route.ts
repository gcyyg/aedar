import { NextResponse } from 'next/server'

const US_BACKEND_URL = process.env.US_BACKEND_URL || 'http://localhost:3000'
const CHINA_BACKEND_URL = process.env.CHINA_BACKEND_URL || 'http://localhost:3002'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const market = searchParams.get('market') || 'us'
  
  // china/cn → A股后端，其他 → 美股后端
  const isChina = market === 'china' || market === 'cn'
  const backendUrl = isChina ? CHINA_BACKEND_URL : US_BACKEND_URL

  try {
    const res = await fetch(`${backendUrl}/api/stock/search?q=${encodeURIComponent(q)}`, {
      cache: 'no-store'
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Backend unavailable', results: [] }, { status: 502 })
  }
}