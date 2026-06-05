/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // A股后端（3002）直接代理，不经过 US 后端
      {
        source: '/cn/api/:path*',
        destination: 'http://localhost:3002/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig
