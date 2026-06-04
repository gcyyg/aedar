import { NextRequest, NextResponse } from 'next/server'

const BACKENDS = {
  us: process.env.US_BACKEND_URL || 'http://localhost:3001',
  china: process.env.CHINA_BACKEND_URL || 'http://localhost:3002',
}

export async function GET(request: NextRequest) {
  const { pathname } = request.nextUrl
  const market = request.nextUrl.searchParams.get('market') || 'us'
  const path = pathname.replace('/api/stock', '')

  // 去掉 ?market=us 参数，只传原始查询参数
  const params = new URLSearchParams(request.nextUrl.searchParams)
  params.delete('market')

  const backend = BACKENDS[market as keyof typeof BACKENDS] || BACKENDS.us
  const target = `${backend}/api/stock${path}?${params.toString()}`

  try {
    const res = await fetch(target, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        host: undefined,
      },
      signal: request.signal,
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Proxy error' }, { status: 502 })
  }
}
