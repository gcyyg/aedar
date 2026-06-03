# CEDAR AI - 智能投资决策系统

前后端一体化部署项目

## 📁 项目结构

```
cedar-ai/
├── frontend/          # Next.js 15 前端
├── backend/           # Fastify 后端 API
└── README.md
```

## 🚀 本地开发

```bash
# 安装依赖
npm install
npm run install:all

# 启动前后端
npm run dev

# 前端: http://localhost:3000
# 后端: http://localhost:3001
```

## 📦 部署

### Docker (腾讯云)

```bash
docker build -t cedar-ai .
docker run -d -p 3000:3000 --name cedar cedar-ai
```

### 手动部署

```bash
# 前端构建
cd frontend && npm install && npm run build && cd ..

# 后端启动
cd backend && npm install && npm start
```

## 🔧 环境变量

前端 `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

后端 `.env`:
```
PORT=3001
TUSHARE_TOKEN=your_token
FINNHUB_KEY=your_key
```

## 📊 API 接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/stock/:symbol` | 获取股票评分 |
| POST | `/api/stock/batch` | 批量查询 |
| DELETE | `/api/stock/:symbol/cache` | 清除缓存 |
| GET | `/api/stock/markets` | 支持的市场 |

## 🛠️ 技术栈

- **前端**: Next.js 15, TailwindCSS, Framer Motion, ECharts
- **后端**: Fastify, Node-Cache, Axios
- **数据源**: TuShare Pro, Finnhub, Alpha Vantage
- **AI**: MiniMax-M2.7