import { NextRequest, NextResponse } from 'next/server'

// DEBUG: 直接代理到后端并返回调试信息
export async function GET(request: NextRequest) {
  const rawUrl: string = request.url
  let q = ''
  try {
    const m = rawUrl.match(/[?&]q=([^&]+)/)
    q = m ? decodeURIComponent(m[1]) : ''
  } catch {
    q = ''
  }

  // 代理到后端
  try {
    const proxiedUrl = `http://localhost:3002/api/stock/search?q=${encodeURIComponent(q)}`
    const res = await fetch(proxiedUrl)
    const data = await res.json()
    return NextResponse.json({
      type: 'proxy_debug',
      frontend_q: q,
      frontend_q_bytes: [...q].map(c => c.charCodeAt(0)),
      proxied_url: proxiedUrl,
      backend_response: data,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) })
  }
}