/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // 股票数据
      {
        source: '/api/stock/:symbol',
        destination: 'http://localhost:3001/api/stock/:symbol',
      },
      // 产业链
      {
        source: '/api/chain/:path*',
        destination: 'http://localhost:3001/api/chain/:path*',
      },
      // 向后兼容旧的 query param 格式
      {
        source: '/api/stock',
        destination: 'http://localhost:3001/api/stock/:symbol',
      },
    ]
  },
}

module.exports = nextConfig
