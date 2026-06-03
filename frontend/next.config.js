/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // 支持新路径格式
      {
        source: '/api/stock/:symbol',
        destination: 'http://localhost:3001/api/stock/:symbol',
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
