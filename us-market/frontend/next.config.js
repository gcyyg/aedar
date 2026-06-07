/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // /cn/api/analysis/* → US后端3000（由 Next.js route handler 处理）
      // /cn/api/stock/* → A股后端3002
      {
        source: '/cn/api/stock/:path*',
        destination: 'http://localhost:3002/api/stock/:path*',
      },
      {
        source: '/cn/api/chain/:path*',
        destination: 'http://localhost:3002/api/chain/:path*',
      },
      // /cn/api/search → A股后端3002
      {
        source: '/cn/api/stock/search',
        destination: 'http://localhost:3002/api/stock/search',
      },
    ]
  },
}

module.exports = nextConfig
