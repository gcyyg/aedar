import axios from 'axios';
const FINNHUB_KEY = 'd8fo3d9r01qn443auhngd8fo3d9r01qn443auho0';
export async function chainRoutes(app) {
    // 获取股票产业链关系（兼容 /api/chain/:symbol 和 /api/chain/:symbol/chain）
    app.get('/:symbol', async (req, reply) => {
        const { symbol } = req.params;
        const upperSymbol = symbol.toUpperCase();
        try {
            // 1. 获取同行公司列表
            const peersRes = await axios.get(`https://finnhub.io/api/v1/stock/peers`, {
                params: { symbol: upperSymbol, token: FINNHUB_KEY },
                timeout: 10000
            });
            const peers = peersRes.data || [];
            const allSymbols = [upperSymbol, ...peers].slice(0, 12); // 最多12个节点
            // 2. 并行获取每个公司的基本信息
            const nodesData = await Promise.allSettled(allSymbols.map(sym => fetchCompanyInfo(sym)));
            // 3. 构建节点
            const nodes = nodesData
                .filter(r => r.status === 'fulfilled' && r.value)
                .map((r) => r.value);
            // 4. 构建关系边（同行 + 概念关联）
            const edges = buildEdges(nodes, upperSymbol);
            // 5. 计算每个节点的基础评分（简化版）
            const scoredNodes = nodes.map(n => ({
                ...n,
                score: calculateSimpleScore(n),
                level: getNodeLevel(n)
            }));
            return {
                symbol: upperSymbol,
                totalNodes: scoredNodes.length,
                nodes: scoredNodes,
                edges
            };
        }
        catch (err) {
            console.error('Chain API error:', err);
            return reply.status(500).send({ error: '产业链数据获取失败', message: err.message });
        }
    });
    // 获取行业概念列表
    app.get('/industries', async () => {
        return {
            industries: [
                { code: 'Semiconductors', name: '半导体', icon: '🔲' },
                { code: 'Technology', name: '科技', icon: '💻' },
                { code: 'Automobiles', name: '汽车', icon: '🚗' },
                { code: 'Banking', name: '银行', icon: '🏦' },
                { code: 'Retail', name: '零售', icon: '🛒' },
                { code: 'Energy', name: '能源', icon: '⚡' },
                { code: 'Healthcare', name: '医疗', icon: '🏥' },
                { code: 'Software', name: '软件', icon: '📱' },
            ]
        };
    });
}
// 获取单个公司基础信息
async function fetchCompanyInfo(symbol) {
    try {
        const res = await axios.get(`https://finnhub.io/api/v1/stock/profile2`, {
            params: { symbol, token: FINNHUB_KEY },
            timeout: 8000
        });
        const d = res.data;
        if (!d.name)
            return null;
        return {
            symbol: d.ticker,
            name: d.name,
            industry: d.finnhubIndustry || 'Unknown',
            country: d.country || 'US',
            logo: d.logo || '',
            marketCap: 0,
            exchange: d.exchange || 'US'
        };
    }
    catch (e) {
        console.error(`fetchCompanyInfo(${symbol}):`, e.message);
        return null;
    }
}
// 构建关系边
function buildEdges(nodes, targetSymbol) {
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            // 同行关系
            if (a.industry === b.industry) {
                edges.push({
                    source: a.symbol,
                    target: b.symbol,
                    type: 'industry',
                    strength: 1
                });
            }
            // 与目标股的关系（更强）
            if (a.symbol === targetSymbol || b.symbol === targetSymbol) {
                edges.push({
                    source: a.symbol === targetSymbol ? a.symbol : b.symbol,
                    target: a.symbol === targetSymbol ? b.symbol : a.symbol,
                    type: 'focus',
                    strength: 2
                });
            }
        }
    }
    return edges;
}
// 简化评分（基于市场数据）
function calculateSimpleScore(node) {
    // 简单评分逻辑
    const industryScores = {
        'Semiconductors': 85,
        'Software': 78,
        'Technology': 75,
        'Automobiles': 60,
        'Banking': 55,
        'Retail': 50,
        'Energy': 58,
        'Healthcare': 65,
    };
    return industryScores[node.industry] || 50;
}
// 获取节点等级
function getNodeLevel(node) {
    if (node.symbol === node.symbol)
        return 'S';
    if (node.industry === 'Semiconductors')
        return 'A';
    return 'B';
}
