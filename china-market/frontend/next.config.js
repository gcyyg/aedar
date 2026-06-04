const nextConfig = {
  async rewrites() {
    return [
      // 股票搜索（必须放在 :symbol 前面，避免被误匹配）
      {
        source: '/api/stock/search',
        destination: 'http://localhost:3003/api/stock/search',
      },
      // 股票数据
      {
        source: '/api/stock/basic/:symbol',
        destination: 'http://localhost:3003/api/stock/basic/:symbol',
      },
      {
        source: '/api/stock/kline/:symbol',
        destination: 'http://localhost:3003/api/stock/kline/:symbol',
      },
      {
        source: '/api/stock/:symbol',
        destination: 'http://localhost:3003/api/stock/:symbol',
      },
      // 产业链
      {
        source: '/api/chain/:path*',
        destination: 'http://localhost:3003/api/chain/:path*',
      },
      // 向后兼容旧的 query param 格式
      {
        source: '/api/stock',
        destination: 'http://localhost:3003/api/stock/:symbol',
      },
    ]
  },
}

module.exports = nextConfig