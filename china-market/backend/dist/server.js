import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { stockRoutes } from './routes/stock.js';
import { chainRoutes } from './routes/chain.js';
import { cache } from './services/cache.js';
const PORT = Number(process.env.PORT) || 3001;
const app = Fastify({
    logger: true
});
// 插件
await app.register(cors, { origin: '*' });
await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });
// 健康检查
app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cacheSize: cache.keys().length
}));
// 路由
app.register(stockRoutes, { prefix: '/api/stock' });
app.register(chainRoutes, { prefix: '/api/chain' });
// 启动
const start = async () => {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🚀 CEDAR Backend running on http://0.0.0.0:${PORT}`);
    }
    catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
export default app;
