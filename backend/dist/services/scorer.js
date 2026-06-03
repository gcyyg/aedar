// 评分引擎
// ===== 评分计算 =====
export function calculateScores(data) {
    const { basic, price, kline } = data;
    // 1. 追踪评级 (技术面 + 行业热度 + 资金面)
    const trackScore = calculateTrackScore(price, kline, basic.industry);
    // 2. 成长性评分
    const growthScore = calculateGrowthScore(price);
    // 3. 估值评分
    const valuationScore = calculateValuationScore(price);
    // 4. 风险评分
    const riskScore = calculateRiskScore(price);
    // 5. 市场温度
    const marketTemp = calculateMarketTemp(price);
    // 6. 均线评估
    const maEvaluation = calculateMAEval(kline, price);
    // 7. 综合评分
    const cedarScore = Math.round(trackScore * 0.25 +
        growthScore * 0.25 +
        valuationScore * 0.25 +
        riskScore * 0.25);
    // 8. Cedar 等级
    const cedarLevel = getCedarLevel(cedarScore);
    // 9. 中美映射
    const chinaUsMapping = getChinaUsMapping(basic.symbol, basic.industry);
    // 10. 赛道归属
    const trackInfo = getIndustryTrackInfo(basic.industry);
    return {
        symbol: basic.symbol,
        name: basic.name,
        cedarScore,
        cedarLevel,
        trackScore,
        trackLevel: getTrackLevel(trackScore),
        growthScore,
        growthLevel: getGrowthLevel(growthScore),
        valuationScore,
        valuationLevel: getValuationLevel(valuationScore),
        riskScore,
        riskLevel: getRiskLevel(riskScore),
        marketTemp,
        marketTempLevel: getMarketTempLevel(marketTemp),
        maEvaluation,
        industry: basic.industry,
        industryTrack: trackInfo.track,
        industryTrackLabel: trackInfo.trackLabel,
        chinaUsMapping,
        summary: '',
        price: {
            current: price.current,
            change: price.change,
            changePercent: price.changePercent,
            pe: price.pe,
            pb: price.pb,
            marketCap: price.marketCap
        },
        updatedAt: new Date().toISOString()
    };
}
// ===== 赛道等级：行业热度 + 资金面 映射 =====
// 行业热度基准分 (综合各平台数据:东方财富/同花顺/雪球/Wind)
const INDUSTRY_HEAT = {
    // 🔥 S级热门赛道
    'AI': { heat: 95, track: 'S' }, '人工智能': { heat: 95, track: 'S' },
    '半导体': { heat: 88, track: 'S' }, '集成电路': { heat: 90, track: 'S' },
    '芯片': { heat: 88, track: 'S' }, '算力': { heat: 88, track: 'S' },
    '低空经济': { heat: 85, track: 'S' }, '新能源汽车': { heat: 85, track: 'S' },
    '智能汽车': { heat: 85, track: 'S' }, '机器人': { heat: 83, track: 'S' },
    '商业航天': { heat: 82, track: 'S' }, '光通信': { heat: 80, track: 'S' },
    // ⭐ A级成长赛道
    '电动车': { heat: 83, track: 'A' }, '云计算': { heat: 82, track: 'A' },
    '创新药': { heat: 80, track: 'A' }, '医疗器械': { heat: 76, track: 'A' },
    '储能': { heat: 74, track: 'A' }, '消费电子': { heat: 72, track: 'A' },
    '新能源': { heat: 75, track: 'A' }, '氢能源': { heat: 70, track: 'A' },
    '生物医药': { heat: 78, track: 'A' }, '量子科技': { heat: 78, track: 'A' },
    '军工': { heat: 68, track: 'A' }, '国防军工': { heat: 68, track: 'A' },
    '航空装备': { heat: 67, track: 'A' }, '软件服务': { heat: 68, track: 'A' },
    '大数据': { heat: 80, track: 'A' }, '数据中心': { heat: 75, track: 'A' },
    // 📊 B级稳定赛道
    '光伏': { heat: 68, track: 'B' }, '苹果产业链': { heat: 70, track: 'B' },
    '电子元件': { heat: 66, track: 'B' }, '通信设备': { heat: 65, track: 'B' },
    '游戏': { heat: 64, track: 'B' }, '5G': { heat: 63, track: 'B' },
    '风电': { heat: 65, track: 'B' }, '互联网服务': { heat: 67, track: 'B' },
    '医疗服务': { heat: 58, track: 'B' }, '中药': { heat: 52, track: 'B' },
    '化学制药': { heat: 50, track: 'B' }, '白酒': { heat: 55, track: 'B' },
    '化妆品': { heat: 55, track: 'B' }, '食品饮料': { heat: 55, track: 'B' },
    '家电': { heat: 52, track: 'B' }, '乳品': { heat: 50, track: 'B' },
    '证券': { heat: 50, track: 'B' }, '保险': { heat: 48, track: 'B' },
    // 📉 C级冷门赛道
    '银行': { heat: 45, track: 'C' }, '家居': { heat: 48, track: 'C' },
    '建筑工程': { heat: 45, track: 'C' }, '建材': { heat: 40, track: 'C' },
    '电力': { heat: 40, track: 'C' }, '化工': { heat: 40, track: 'C' },
    '航空': { heat: 35, track: 'C' }, '机场': { heat: 38, track: 'C' },
    '房地产': { heat: 30, track: 'C' }, '钢铁': { heat: 30, track: 'C' },
    '煤炭': { heat: 28, track: 'C' }, '石油': { heat: 35, track: 'C' },
    '造纸': { heat: 30, track: 'C' }, '纺织服装': { heat: 28, track: 'C' },
    '公路铁路': { heat: 32, track: 'C' }, '火电': { heat: 35, track: 'C' },
};
export function getIndustryTrackInfo(industry) {
    const info = INDUSTRY_HEAT[industry];
    const track = info?.track ?? 'C';
    const heat = info?.heat ?? 40;
    const trackLabel = track === 'S' ? 'S级热门' : track === 'A' ? 'A级成长' : track === 'B' ? 'B级稳定' : 'C级冷门';
    const heatLabel = heat >= 80 ? '🔥 超热' : heat >= 65 ? '⭐ 热门' : heat >= 45 ? '📊 平稳' : '📉 冷门';
    const emoji = heat >= 80 ? '🔥' : heat >= 65 ? '⭐' : heat >= 45 ? '📊' : '📉';
    const color = track === 'S' ? '#ff6b35' : track === 'A' ? '#ffaa00' : track === 'B' ? '#00d68f' : '#6b7aff';
    return { track, heat, heatLabel, trackLabel, emoji, color };
}
// 资金面加成: 成交额异常放大 = 主力关注
function getCapitalBonus(volume, avgVolume) {
    if (avgVolume <= 0)
        return 0;
    const ratio = volume / avgVolume;
    if (ratio > 5)
        return 20; // 5倍以上成交 → 主力爆买
    if (ratio > 3)
        return 15; // 3倍以上 → 大幅加仓
    if (ratio > 2)
        return 10; // 2倍以上 → 明显流入
    if (ratio > 1.5)
        return 5; // 1.5倍以上 → 温和流入
    if (ratio < 0.5)
        return -10; // 缩量一半 → 资金撤离
    return 0;
}
// 市值规模加成 (大市值龙头 = 赛道确定性高)
function getScaleBonus(marketCap) {
    if (marketCap > 1000000000000)
        return 10; // 万亿以上
    if (marketCap > 100000000000)
        return 5; // 千亿以上
    if (marketCap < 10000000000)
        return -5; // 百亿以下
    return 0;
}
// 计算赛道综合评分: 技术面50% + 行业热度40% + 资金面10%
export function calculateTrackScore(price, kline, industry) {
    let techScore = 50; // 技术面基准分
    // ── 技术评分 (均线系统) ──
    if (kline) {
        const closes = kline.data.map(d => d.close);
        const ma30 = kline.ma.ma30;
        const ma60 = kline.ma.ma60;
        const current = closes[closes.length - 1];
        if (current > ma30[ma30.length - 1])
            techScore += 10;
        if (current > ma60[ma60.length - 1])
            techScore += 10;
        if (ma30[ma30.length - 1] > ma60[ma60.length - 1])
            techScore += 10;
    }
    // ── 动量评分 (近期涨幅) ──
    if (price.changePercent > 8)
        techScore += 15;
    else if (price.changePercent > 5)
        techScore += 10;
    else if (price.changePercent > 2)
        techScore += 5;
    else if (price.changePercent > 0)
        techScore += 2;
    else if (price.changePercent < -8)
        techScore -= 15;
    else if (price.changePercent < -5)
        techScore -= 10;
    else if (price.changePercent < -2)
        techScore -= 5;
    techScore = Math.min(100, Math.max(0, techScore));
    // ── 行业热度 ──
    const industryHeat = INDUSTRY_HEAT[industry]?.heat ?? 50;
    // ── 资金面加成 ──
    const avgVolume = price.history.length >= 20
        ? price.history.slice(-20).reduce((sum, d) => sum + d.volume, 0) / 20
        : price.volume;
    const capitalBonus = getCapitalBonus(price.volume, avgVolume);
    // ── 规模加成 ──
    const scaleBonus = getScaleBonus(price.marketCap);
    // ── 综合赛道分: 技术50% + 行业40% + 资金面/规模 10% ──
    const trackScore = Math.round(techScore * 0.50 +
        industryHeat * 0.40 +
        (50 + capitalBonus + scaleBonus) * 0.10);
    return Math.min(100, Math.max(0, trackScore));
}
export function getTrackLevel(score) {
    // 综合赛道评分等级
    if (score >= 85)
        return 'S';
    if (score >= 70)
        return 'A';
    if (score >= 50)
        return 'B';
    return 'C';
}
export function getTrackLevelDetail(score, industry) {
    const info = getIndustryTrackInfo(industry);
    return {
        level: getTrackLevel(score),
        industryHeat: info.heat,
        heatLabel: info.heatLabel
    };
}
function calculateGrowthScore(price) {
    let score = 50;
    // 使用历史数据计算涨跌幅
    if (price.history.length >= 250) {
        const yearAgo = price.history[price.history.length - 250];
        const growth = ((price.current - yearAgo.close) / yearAgo.close) * 100;
        if (growth > 50)
            score += 30;
        else if (growth > 30)
            score += 25;
        else if (growth > 20)
            score += 20;
        else if (growth > 10)
            score += 15;
        else if (growth > 0)
            score += 10;
        else if (growth > -10)
            score -= 10;
        else if (growth > -20)
            score -= 20;
        else
            score -= 30;
    }
    // PE 估值对成长的暗示
    if (price.pe > 0) {
        if (price.pe < 20)
            score += 10;
        else if (price.pe > 60)
            score -= 15;
        else if (price.pe > 100)
            score -= 25;
    }
    return Math.min(100, Math.max(0, score));
}
function calculateValuationScore(price) {
    let score = 50;
    // PE 评分
    if (price.pe > 0) {
        if (price.pe < 10)
            score += 25;
        else if (price.pe < 15)
            score += 20;
        else if (price.pe < 20)
            score += 15;
        else if (price.pe < 30)
            score += 5;
        else if (price.pe < 50)
            score -= 10;
        else if (price.pe < 100)
            score -= 20;
        else
            score -= 30;
    }
    // PB 评分
    if (price.pb > 0) {
        if (price.pb < 1)
            score += 15;
        else if (price.pb < 2)
            score += 10;
        else if (price.pb < 3)
            score += 5;
        else if (price.pb > 5)
            score -= 10;
    }
    return Math.min(100, Math.max(0, score));
}
function calculateRiskScore(price) {
    let score = 50;
    // 市值风险 (大市值 = 低风险)
    if (price.marketCap > 1000000000000)
        score += 30;
    else if (price.marketCap > 100000000000)
        score += 20;
    else if (price.marketCap > 10000000000)
        score += 10;
    else if (price.marketCap < 1000000000)
        score -= 20;
    // 波动性风险
    if (price.history.length >= 30) {
        const returns = price.history.slice(-30).map((d, i) => i === 0 ? 0 : (d.close - price.history[i - 1].close) / price.history[i - 1].close);
        const vol = standardDeviation(returns) * Math.sqrt(252); // 年化波动率
        if (vol < 0.15)
            score += 15;
        else if (vol < 0.25)
            score += 5;
        else if (vol < 0.4)
            score -= 10;
        else
            score -= 20;
    }
    return Math.min(100, Math.max(0, score));
}
function calculateMarketTemp(price) {
    // 简化的市场温度计
    // 基于价格相对52周高点的位置
    if (price.high > 0) {
        const position = (price.current - price.low) / (price.high - price.low);
        return Math.round(position * 100);
    }
    return 50;
}
function calculateMAEval(kline, price) {
    const result = {
        ma30: 'neutral',
        ma60: 'neutral',
        ma120: 'neutral',
        ma240: 'neutral',
        overall: 'neutral'
    };
    if (!kline || kline.data.length < 10)
        return result;
    const current = price.current;
    const ma30 = kline.ma.ma30[kline.ma.ma30.length - 1];
    const ma60 = kline.ma.ma60[kline.ma.ma60.length - 1];
    const ma120 = kline.ma.ma120[kline.ma.ma120.length - 1];
    const ma240 = kline.ma.ma240[kline.ma.ma240.length - 1];
    if (current > ma30)
        result.ma30 = 'bull';
    else if (current < ma30)
        result.ma30 = 'bear';
    if (current > ma60)
        result.ma60 = 'bull';
    else if (current < ma60)
        result.ma60 = 'bear';
    if (current > ma120)
        result.ma120 = 'bull';
    else if (current < ma120)
        result.ma120 = 'bear';
    if (current > ma240)
        result.ma240 = 'bull';
    else if (current < ma240)
        result.ma240 = 'bear';
    const bullish = [result.ma30, result.ma60, result.ma120, result.ma240].filter(m => m === 'bull').length;
    if (bullish >= 3)
        result.overall = 'bull';
    else if (bullish <= 1)
        result.overall = 'bear';
    return result;
}
function getCedarLevel(score) {
    if (score >= 90)
        return 'S';
    if (score >= 80)
        return 'A';
    if (score >= 65)
        return 'B';
    if (score >= 50)
        return 'C';
    if (score >= 30)
        return 'D';
    return 'AVOID';
}
function getGrowthLevel(score) {
    if (score >= 80)
        return 'A';
    if (score >= 60)
        return 'B';
    if (score >= 40)
        return 'C';
    return 'D';
}
function getValuationLevel(score) {
    if (score >= 75)
        return 'low';
    if (score >= 55)
        return 'medium';
    if (score >= 35)
        return 'high';
    return 'very_high';
}
function getRiskLevel(score) {
    if (score >= 80)
        return 'low';
    if (score >= 60)
        return 'medium';
    if (score >= 40)
        return 'high';
    return 'very_high';
}
function getMarketTempLevel(temp) {
    if (temp >= 80)
        return 'fever';
    if (temp >= 55)
        return 'warm';
    if (temp >= 35)
        return 'neutral';
    return 'cold';
}
function getChinaUsMapping(symbol, industry) {
    // 简化的中美行业映射
    const map = {
        '新能源汽车': 'Tesla, Rivian',
        '锂电池': 'QuantumScape, Solid Power',
        '光伏': 'First Solar, Enphase',
        '半导体': 'Nvidia, AMD, Intel',
        '互联网': 'Google, Meta, Amazon',
        '消费电子': 'Apple, Samsung',
        '医药': 'Pfizer, Johnson & Johnson',
        '银行': 'JPMorgan, Bank of America',
        '保险': 'Berkshire Hathaway, AIG',
        '券商': 'Goldman Sachs, Morgan Stanley',
        '白酒': 'Diageo, Constellation Brands',
        '房地产': 'D.R. Horton, Lennar',
        '食品': 'Nestle, Kraft Heinz',
        '饮料': 'Coca-Cola, PepsiCo',
        '教育': 'Chegg, Duolingo',
        '电商': 'Amazon, Shopify',
        '云计算': 'AWS, Azure, Google Cloud',
        'AI': 'OpenAI, Anthropic, Google AI',
    };
    return map[industry] || null;
}
function standardDeviation(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const squareDiffs = arr.map(v => Math.pow(v - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length);
}
