import axios from 'axios';
const EM_SEARCH_API = 'https://searchapi.eastmoney.com/api/suggest/get';
const EM_TOKEN = '***';
export async function stockRoutes(app) {
    app.get('/search', async (req, reply) => {
        const rawUrl = req.raw.url;
        let decodedQ = '';
        try {
            const m = rawUrl.match(/[?&]q=([^&]+)/);
            decodedQ = m ? decodeURIComponent(m[1]) : '';
        }
        catch {
            decodedQ = '';
        }
        console.log('[search] rawUrl:', rawUrl);
        console.log('[search] decodedQ:', decodedQ);
        if (!decodedQ.trim()) {
            return reply.status(400).send({ error: '搜索词不能为空' });
        }
        try {
            const apiUrl = `${EM_SEARCH_API}?input=${encodeURIComponent(decodedQ)}&type=14&token=${EM_TOKEN}&count=10`;
            console.log('[search] apiUrl:', apiUrl);
            const apiRes = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.eastmoney.com',
                },
            });
            const apiData = apiRes.data;
            const hits = apiData?.QuotationCodeTable?.Data || [];
            console.log('[search] eastmoney hits:', hits.length);
            const results = hits
                .filter((h) => h.Classify === 'AStock' && ['1', '2'].includes(h.SecurityType))
                .map((h) => ({
                symbol: h.UnifiedCode || h.Code || '',
                name: h.Name || h.SecurityName || '',
                market: h.SecurityType === '1' ? '沪A' : '深A',
            }));
            return { query: decodedQ, results };
        }
        catch (err) {
            console.error('[search] eastmoney failed:', err);
            return { query: decodedQ, results: [] };
        }
    });
}
