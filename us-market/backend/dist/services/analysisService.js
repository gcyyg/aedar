/**
 * 金融分析服务 (Comps / DCF / LBO / Competitive Analysis)
 * 复用 anthropics/financial-services 的技能模式
 * 调用 MiniMax 生成专业分析结果
 */
import 'dotenv/config';
import axios from 'axios';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cache } from './cache.js';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.MINIMAX_DOMESTIC_API_KEY;
const MINIMAX_API_URL = 'https://api.minimaxi.com/v1/text/chatcompletion_v2';
// ── Skill 加载 ──────────────────────────────────────────
const SKILLS_BASE = '/home/ubuntu/.hermes/skills/fintech';
function loadSkill(name) {
    try {
        return readFileSync(resolve(SKILLS_BASE, name, 'SKILL.md'), 'utf-8');
    }
    catch {
        return '';
    }
}
const SKILLS = {
    comps: loadSkill('comps-analysis'),
    dcf: loadSkill('dcf-model'),
    lbo: loadSkill('lbo-model'),
    competitive: loadSkill('competitive-analysis'),
    audit: loadSkill('audit-xls'),
};
// ── Prompt 构建 ──────────────────────────────────────────
function buildPrompt(type, data) {
    const { symbol, name, price, financials, peers, industry, country } = data;
    const lang = country === 'china' ? 'zh' : 'en';
    const skill = SKILLS[type] || '';
    const prompts = {
        comps: `你是资深投行分析师，为 ${name}(${symbol}) 构建机构级同业比较分析。

**股票数据：**
- 当前股价: $${price.current}
- 市盈率(PE): ${price.pe || 'N/A'}
- 市净率(PB): ${price.pb || 'N/A'}
- 市值: $${price.marketCap >= 1e9 ? (price.marketCap / 1e9).toFixed(2) + 'B' : (price.marketCap / 1e6).toFixed(2) + 'M'}
- 行业: ${industry}

**财务数据：**
${financials ? `- 营收: $${(financials.revenue / 1e9).toFixed(2)}B, 增长 ${financials.revenueGrowth?.toFixed(1) || 'N/A'}%
- 毛利率: ${financials.grossMargin?.toFixed(1) || 'N/A'}%
- EBITDA利润率: ${financials.ebitdaMargin?.toFixed(1) || 'N/A'}%
- 净利润率: ${financials.netMargin?.toFixed(1) || 'N/A'}%` : 'N/A'}

${peers && peers.length > 0 ? `**可比公司（同业）：**\n${peers.map(p => `- ${p.name}(${p.symbol}): PE=${p.pe || 'N/A'}, PB=${p.pb || 'N/A'}, 市值$${(p.marketCap / 1e9).toFixed(1)}B`).join('\n')}` : ''}

**技能参考：**
${skill.slice(0, 3000)}

请输出 JSON：
{
  "title": "同业比较分析 - ${symbol}",
  "sections": [{"title": "同业选择", "content": "选择理由..."}, {"title": "估值对比", "content": "..."}],
  "table": {
    "headers": ["公司", "PE", "PB", "EV/EBITDA", "市值"],
    "rows": [[公司名, PE, PB, 倍数, 市值], ...],
    "stats": [{"label": "PE中位数", "value": "xx"}, {"label": "PB中位数", "value": "xx"}]
  },
  "keyMetrics": {"targetPE": 25, "targetPB": 3.5, "upside": "15%"},
  "summary": "结论：当前估值处于同业中枢，PE略高于中位数15%..."
}

严格输出纯JSON，不要markdown代码块包裹。`,
        dcf: `你是资深投行分析师，为 ${name}(${symbol}) 构建DCF估值模型。

**股票数据：**
- 当前股价: $${price.current}
- 市盈率(PE): ${price.pe || 'N/A'}
- 市净率(PB): ${price.pb || 'N/A'}
- 市值: $${(price.marketCap / 1e9).toFixed(2)}B

**财务数据：**
${financials ? `- 营收: $${(financials.revenue / 1e9).toFixed(2)}B
- 营收增长: ${financials.revenueGrowth?.toFixed(1) || 'N/A'}%
- 利润增长: ${financials.profitGrowth?.toFixed(1) || 'N/A'}%
- 毛利率: ${financials.grossMargin?.toFixed(1) || 'N/A'}%` : 'N/A'}

**技能参考：**
${skill.slice(0, 2000)}

请输出 JSON（DCF敏感性分析）：
{
  "title": "DCF估值 - ${symbol}",
  "sections": [
    {"title": "核心假设", "content": "WACC=9%, 永续增长率=3%, 预测期5年", "data": {"WACC": "9%", "Terminal Growth": "3%", "Prediction Period": "5年"}},
    {"title": "现金流预测", "content": "FCF预测", "data": {"Year1 FCF": "$X亿", "Year5 FCF": "$X亿"}}
  ],
  "sensitivity": {
    "rowHeaders": ["8%", "9%", "10%", "11%", "12%"],
    "colHeaders": ["2%", "2.5%", "3%", "3.5%", "4%"],
    "centerLabel": "Base Case",
    "values": [[28, 30, 32, 35, 38], [25, 27, 29, 32, 36], [22, 24, 27, 30, 34], [20, 22, 24, 27, 31], [18, 20, 22, 25, 29]]
  },
  "keyMetrics": {"fairValue": 165, "currentPrice": ${price.current}, "upside": "18%", "wacc": "9%", "terminalG": "3%"},
  "summary": "基于WACC=9%、永续增长=3%的假设，DCF估值$165，当前价格$140，有18%上行空间。"
}

严格输出纯JSON。`,
        lbo: `你是PE分析师，为 ${name}(${symbol}) 构建LBO分析。

**股票数据：**
- 市值: $${(price.marketCap / 1e9).toFixed(2)}B
- 行业: ${industry}

请输出 JSON（LBO回报分析）：
{
  "title": "LBO分析 - ${symbol}",
  "sections": [
    {"title": "交易结构", "content": "PE入场所需条件", "data": {"EV": "$X亿", "Equity": "$X亿", "Debt": "$X亿", "LTV": "65%"}},
    {"title": "回报分析", "content": "5年持有期回报", "data": {"Entry Multiple": "8.5x", "Exit Multiple": "9.0x", "MOIC": "2.1x", "IRR": "16%"}}
  ],
  "keyMetrics": {"entryEV": 85, "debtAmount": 55, "equityAmount": 30, "irr": "16%", "moic": "2.1x"},
  "summary": "在9x退出倍数假设下，5年IRR约16%，MOIC约2.1x，对PE基金具有吸引力。"
}

严格输出纯JSON。`,
        competitive: `你是战略咨询分析师，为 ${name}(${symbol}) 构建竞争格局分析。

**目标公司：**
- 名称: ${name}
- 行业: ${industry}
- 当前估值: PE=${price.pe || 'N/A'}, PB=${price.pb || 'N/A'}

${peers && peers.length > 0 ? `**主要竞争对手：**\n${peers.map(p => `- ${p.name}(${p.symbol}): PE=${p.pe || 'N/A'}, 市值$${(p.marketCap / 1e9).toFixed(1)}B`).join('\n')}` : ''}

请输出 JSON：
{
  "title": "竞争格局分析 - ${symbol}",
  "sections": [
    {"title": "市场定位", "content": "SWOT分析框架"},
    {"title": "竞争优势", "content": "护城河分析"}
  ],
  "chartData": {
    "type": "bar",
    "title": "估值对比",
    "labels": ["${symbol}", ...${JSON.stringify(peers?.map(p => p.symbol) || [])}, "行业中位数"],
    "series": [{"name": "PE", "data": [${price.pe || 0}, ...${JSON.stringify(peers?.map(p => p.pe || 0) || [])}, 18]}]
  },
  "summary": "结论：..."
}

严格输出纯JSON。`,
        audit: `你是财务模型审计师，审计 ${name}(${symbol}) 的估值逻辑。

**已知数据：**
- PE=${price.pe || 'N/A'} (行业均值约18x)
- PB=${price.pb || 'N/A'} (行业均值约3x)
- ROE=${price.roe || 'N/A'}%
- 市值: $${(price.marketCap / 1e9).toFixed(2)}B

请输出 JSON（模型审计报告）：
{
  "title": "模型审计 - ${symbol}",
  "sections": [
    {"title": "估值合理性", "content": "检查结论", "data": {"PE vs 行业中位数": "高估20%", "PB合理性": "合理"}},
    {"title": "风险提示", "content": "需关注的异常"}
  ],
  "keyMetrics": {"peDeviation": "+20%", "pbDeviation": "0%", "auditStatus": "Minor Issues"},
  "summary": "模型审计结论：..."
}

严格输出纯JSON。`,
    };
    return prompts[type];
}
// ── 主函数 ──────────────────────────────────────────
export async function runAnalysis(type, symbol, name, priceData, financials, peers, industry, country) {
    // 1. 查缓存
    const cacheKey = `analysis:${type}:${symbol}:${country}`;
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    // 2. 构建 prompt
    const prompt = buildPrompt(type, { symbol, name, price: priceData, financials, peers, industry, country });
    let raw = '';
    if (MINIMAX_API_KEY) {
        try {
            const res = await axios.post(MINIMAX_API_URL, {
                model: 'MiniMax-M2.7',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 3000,
            }, {
                headers: {
                    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            });
            const msg = res.data?.choices?.[0]?.message?.content || '';
            raw = msg.trim();
        }
        catch (e) {
            console.error('MiniMax analysis error:', e.message);
            raw = '';
        }
    }
    let result;
    if (raw) {
        // 从AI输出解析JSON
        try {
            // 去除可能的 ```json 包裹
            const jsonStr = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
            result = JSON.parse(jsonStr);
        }
        catch {
            // fallback: 把原始文本塞到summary
            result = { summary: raw.slice(0, 500) };
        }
    }
    else {
        result = {};
    }
    const final = {
        type,
        symbol,
        name,
        title: result.title || `${type.toUpperCase()} Analysis - ${symbol}`,
        sections: result.sections || [],
        table: result.table || undefined,
        sensitivity: result.sensitivity || undefined,
        chartData: result.chartData || undefined,
        keyMetrics: result.keyMetrics || {},
        summary: result.summary || '分析生成失败，请稍后重试。',
        disclaimer: '⚠️ 本分析仅供参考，不构成投资建议。所有数据来源于公开信息，输出结果需经专业人士审核。',
        generatedAt: new Date().toLocaleString('zh-CN'),
    };
    // 缓存1小时
    cache.set(cacheKey, final, 3600);
    return final;
}
