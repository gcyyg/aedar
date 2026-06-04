import { FastifyInstance } from 'fastify'
import axios from 'axios'
import { cache } from '../services/cache.js'
import { CHINA_STOCKS_MAP } from '../services/chinaStocks.js'

// East Money API endpoints
const EM_INDUSTRY_LIST = 'https://push2delay.eastmoney.com/api/qt/clist/get'
const EM_CONCEPT_LIST = 'https://push2delay.eastmoney.com/api/qt/clist/get'
const EM_STOCK_LIST = 'https://push2delay.eastmoney.com/api/qt/clist/get'

// 行业代码 → 名称 映射（东方财富128行业）
let industryMap: Map<string, string> | null = null
let conceptMap: Map<string, string> | null = null

// ===== 产业链类型定义 =====

export interface ChainNode {
  symbol: string
  name: string
  industry: string
  industryCode?: string
  market: string
  relation: 'self' | 'peer' | 'upstream' | 'downstream' | 'related'
  marketCap?: number
  currentPrice?: number
  changePercent?: number
  score?: number
}

export interface ChainEdge {
  source: string
  target: string
  type: 'industry' | 'peer' | 'upstream' | 'downstream' | 'concept'
  strength: number
}

export interface ChainResult {
  symbol: string
  name: string
  industry: string
  totalNodes: number
  nodes: ChainNode[]
  edges: ChainEdge[]
  upstream: string[]
  downstream: string[]
  relatedConcepts: string[]
}

// ===== 行业关系定义（手动构建上游下游）=====

// ===== 行业关系映射表（手动构建上下游）=====
// key: 本地行业名（与 chinaStocks.ts 保持一致）
// value: { upstream: 上游行业[], downstream: 下游行业[], concepts: 关联概念[] }

const INDUSTRY_CHAIN: Record<string, { upstream: string[]; downstream: string[]; concepts: string[] }> = {
  // ===== 食品饮料 =====
  '白酒': {
    upstream: ['农产品加工', '饲料', '包装材料', '玻璃制造'],
    downstream: ['酒店餐饮', '旅游零售', '商超'],
    concepts: ['白酒概念', '超级品牌', '沪股通', '消费降级']
  },
  '非白酒': {
    upstream: ['农产品加工', '饮料乳品'],
    downstream: ['商超', '餐饮'],
    concepts: ['啤酒概念', '沪股通']
  },
  '食品加工': {
    upstream: ['农产品加工', '饲料'],
    downstream: ['商超', '餐饮'],
    concepts: ['食品加工', '消费降级', '沪股通']
  },
  '饮料乳品': {
    upstream: ['农产品加工', '包装材料'],
    downstream: ['商超', '餐饮'],
    concepts: ['乳业', '饮料概念', '消费降级']
  },
  '调味品': {
    upstream: ['农产品加工', '包装材料'],
    downstream: ['餐饮', '商超'],
    concepts: ['调味品', '超级品牌', '消费降级']
  },
  '饲料': {
    upstream: ['农产品加工', '化工'],
    downstream: ['畜禽养殖', '白酒'],
    concepts: ['饲料', '猪肉概念']
  },
  '农产品加工': {
    upstream: ['农业种植'],
    downstream: ['白酒', '饮料乳品', '食品加工', '饲料'],
    concepts: ['农产品', '乡村振兴']
  },

  // ===== 医药 =====
  '化学制药': {
    upstream: ['化学原料', '医药中间体'],
    downstream: ['医药商业', '医疗服务'],
    concepts: ['化学制药', '仿制药', '带量采购']
  },
  '生物制药': {
    upstream: ['生物制品', '医药中间体'],
    downstream: ['医药商业', '医疗服务'],
    concepts: ['生物医药', '疫苗', '创新药']
  },
  '中药': {
    upstream: ['中成药', '中药材'],
    downstream: ['医疗服务', '医药商业'],
    concepts: ['中药', '中医药', '超级品牌']
  },
  '医疗器械': {
    upstream: ['电子元件', '生物制品'],
    downstream: ['医疗服务', '医院'],
    concepts: ['医疗器械', '医疗新基建', '国产替代']
  },
  '医疗服务': {
    upstream: ['医疗器械', '医药服务'],
    downstream: ['医院', '健康管理'],
    concepts: ['医疗服务', '眼科', '牙科']
  },
  '医药服务': {
    upstream: ['化学制药', '生物制药'],
    downstream: ['医疗服务', '医院'],
    concepts: ['CXO', '医药研发外包', '创新药']
  },

  // ===== 半导体/电子 =====
  '半导体': {
    upstream: ['半导体材料', '半导体设备', '电子化学品'],
    downstream: ['消费电子', '汽车电子', '通信设备'],
    concepts: ['半导体', '国产芯片', '集成电路', 'AI算力']
  },
  '半导体制造': {
    upstream: ['半导体材料', '硅料'],
    downstream: ['半导体', '消费电子'],
    concepts: ['半导体制造', '晶圆代工', '国产替代']
  },
  '半导体设备': {
    upstream: ['电子元件', '机械制造'],
    downstream: ['半导体制造'],
    concepts: ['半导体设备', '国产替代', '集成电路']
  },
  '半导体材料': {
    upstream: ['化工', '稀有金属'],
    downstream: ['半导体制造', '半导体'],
    concepts: ['半导体材料', '硅片', '国产替代']
  },
  'LED': {
    upstream: ['半导体材料', '电子元件'],
    downstream: ['消费电子', '照明', '显示'],
    concepts: ['LED', 'MiniLED', '第三代半导体']
  },
  '电子元件': {
    upstream: ['半导体材料', '电子化学品'],
    downstream: ['消费电子', '半导体', 'LED'],
    concepts: ['电子元件', 'MLCC', 'PCB']
  },
  '电子制造': {
    upstream: ['电子元件', '半导体'],
    downstream: ['消费电子', '通信设备'],
    concepts: ['消费电子', '代工', '沪股通']
  },
  '显示面板': {
    upstream: ['半导体材料', '电子元件'],
    downstream: ['消费电子', 'LED', '光电'],
    concepts: ['面板', 'LCD', 'OLED']
  },
  '消费电子': {
    upstream: ['半导体', '电子元件', '显示面板'],
    downstream: ['通信设备', '软件服务'],
    concepts: ['消费电子', '智能手机', 'VR/AR', 'AI终端']
  },
  '通信设备': {
    upstream: ['半导体', '电子元件'],
    downstream: ['运营商', '软件服务'],
    concepts: ['通信设备', '5G', '运营商']
  },

  // ===== 新能源 =====
  '光伏': {
    upstream: ['硅料', '硅片', '光伏设备'],
    downstream: ['电力', '储能', '新能源汽车'],
    concepts: ['光伏', '新能源', '碳中和', 'HIT电池']
  },
  '光伏逆变器': {
    upstream: ['半导体', '电子元件'],
    downstream: ['光伏', '储能'],
    concepts: ['光伏逆变器', '储能', '新能源']
  },
  '锂电池': {
    upstream: ['锂矿', '正极材料', '电解液'],
    downstream: ['新能源汽车', '储能', '消费电子'],
    concepts: ['锂电池', '新能源车', '储能', '固态电池']
  },
  '锂电池隔膜': {
    upstream: ['化工', '锂矿'],
    downstream: ['锂电池'],
    concepts: ['锂电池隔膜', '新能源', '储能']
  },
  '锂矿': {
    upstream: ['矿业', '稀有金属'],
    downstream: ['锂电池', '正极材料'],
    concepts: ['锂矿', '新能源', '锂资源']
  },
  '新能源汽车': {
    upstream: ['锂电池', '汽车零部件', '充电桩'],
    downstream: ['汽车服务', '充电桩运营'],
    concepts: ['新能源汽车', '特斯拉', '比亚迪', '智能驾驶']
  },
  '充电桩': {
    upstream: ['电子元件', '锂电池'],
    downstream: ['新能源汽车', '充电桩运营'],
    concepts: ['充电桩', '新能源', '新基建']
  },
  '电力设备': {
    upstream: ['钢铁', '电子元件'],
    downstream: ['电力', '储能'],
    concepts: ['电力设备', '特高压', '智能电网']
  },

  // ===== 汽车 =====
  '汽车整车': {
    upstream: ['汽车零部件', '锂电池', '钢铁'],
    downstream: ['汽车服务', '经销商'],
    concepts: ['汽车整车', '新能源汽车', '中字头']
  },
  '汽车零部件': {
    upstream: ['钢铁', '塑料', '电子元件'],
    downstream: ['汽车整车', '新能源汽车'],
    concepts: ['汽车零部件', '特斯拉', '比亚迪']
  },
  '发动机': {
    upstream: ['钢铁', '精密制造'],
    downstream: ['汽车整车', '工程机械'],
    concepts: ['发动机', '潍柴动力', '中字头']
  },
  '工程机械': {
    upstream: ['钢铁', '发动机'],
    downstream: ['房地产', '基建'],
    concepts: ['工程机械', '挖掘机', '基建']
  },

  // ===== 金融 =====
  '银行': {
    upstream: [],
    downstream: [],
    concepts: ['银行', '沪股通', '中字头', '破净']
  },
  '证券': {
    upstream: ['银行'],
    downstream: ['互联网金融'],
    concepts: ['证券', '沪股通', '财富管理']
  },
  '保险': {
    upstream: ['银行', '投资'],
    downstream: ['医疗服务'],
    concepts: ['保险', '中字头', '养老']
  },
  '互联网金融': {
    upstream: ['软件服务', '银行'],
    downstream: ['金融科技'],
    concepts: ['互联网金融', '金融科技', '数字货币']
  },

  // ===== 周期行业 =====
  '煤炭': {
    upstream: ['矿业'],
    downstream: ['电力', '钢铁', '化工'],
    concepts: ['煤炭', '中字头', '资源股']
  },
  '石油开采': {
    upstream: ['矿业'],
    downstream: ['化工', '电力'],
    concepts: ['石油', '能源安全', '中字头']
  },
  '钢铁': {
    upstream: ['煤炭', '铁矿石'],
    downstream: ['房地产', '汽车整车', '工程机械'],
    concepts: ['钢铁', '特钢', '中字头']
  },
  '铜金矿': {
    upstream: ['矿业'],
    downstream: ['半导体', '电子元件', '电力设备'],
    concepts: ['铜矿', '黄金', '有色金属']
  },
  '黄金': {
    upstream: ['矿业', '珠宝'],
    downstream: ['珠宝', '投资'],
    concepts: ['黄金', '避险', '贵金属']
  },
  '稀土': {
    upstream: ['矿业'],
    downstream: ['半导体', '新能源汽车', '风电'],
    concepts: ['稀土', '稀有金属', '国产替代']
  },
  '石化': {
    upstream: ['石油开采', '煤炭'],
    downstream: ['化工', '塑料'],
    concepts: ['石化', '乙烯', '化工']
  },
  '化工': {
    upstream: ['煤炭', '石油开采'],
    downstream: ['半导体材料', '新能源汽车', '农药'],
    concepts: ['化工', '化学制品', '周期']
  },
  '钛白粉': {
    upstream: ['矿业', '化工'],
    downstream: ['涂料', '造纸'],
    concepts: ['钛白粉', '涂料', '周期']
  },
  '煤化工': {
    upstream: ['煤炭'],
    downstream: ['化工', '塑料'],
    concepts: ['煤化工', '化工', '资源股']
  },

  // ===== 消费 =====
  '家电': {
    upstream: ['钢铁', '塑料', '电子元器件'],
    downstream: ['零售', '房地产链'],
    concepts: ['家电', '超级品牌', '智能家居', '以旧换新']
  },
  '零售': {
    upstream: ['消费品'],
    downstream: ['消费者'],
    concepts: ['零售', '新零售', '电商']
  },
  '旅游零售': {
    upstream: ['旅游业', '消费品'],
    downstream: ['消费者'],
    concepts: ['旅游零售', '免税', '中国中免']
  },
  '房地产': {
    upstream: ['钢铁', '水泥', '建筑装饰'],
    downstream: ['家具家居', '家电', '物业管理'],
    concepts: ['房地产', '物业管理', '保障房']
  },
  '物业管理': {
    upstream: ['房地产'],
    downstream: ['社区服务'],
    concepts: ['物业管理', '房地产', '城市服务']
  },

  // ===== 基建制造 =====
  '水泥': {
    upstream: ['石灰石', '煤炭'],
    downstream: ['房地产', '基建'],
    concepts: ['水泥', '基建', '周期']
  },
  '玻纤': {
    upstream: ['化工', '矿石'],
    downstream: ['建筑', '风电', '汽车'],
    concepts: ['玻纤', '复合材料', '风电叶片']
  },
  '建筑': {
    upstream: ['钢铁', '水泥', '建筑装饰'],
    downstream: ['房地产', '基建'],
    concepts: ['建筑', '基建', '中字头']
  },
  '建筑施工': {
    upstream: ['钢铁', '水泥'],
    downstream: ['房地产', '基建'],
    concepts: ['建筑施工', '基建', '中字头']
  },
  '船舶制造': {
    upstream: ['钢铁', '发动机'],
    downstream: ['航运', '军工'],
    concepts: ['船舶', '造船', '中字头']
  },
  '船舶': {
    upstream: ['钢铁', '船舶制造'],
    downstream: ['航运', '军工'],
    concepts: ['船舶', '造船', '中字头']
  },
  '通用设备': {
    upstream: ['钢铁', '电子元件'],
    downstream: ['汽车', '工程机械', '电力设备'],
    concepts: ['通用设备', '机械', '周期']
  },
  '专用设备': {
    upstream: ['钢铁', '半导体设备'],
    downstream: ['半导体制造', '医疗'],
    concepts: ['专用设备', '半导体设备', '医疗设备']
  },
  '特钢': {
    upstream: ['铁矿石', '煤炭'],
    downstream: ['汽车整车', '工程机械', '建筑'],
    concepts: ['特钢', '特殊钢', '军工']
  },

  // ===== 电力能源 =====
  '水电': {
    upstream: [],
    downstream: ['电力'],
    concepts: ['水电', '清洁能源', '电力']
  },
  '核电': {
    upstream: ['核燃料', '特种设备'],
    downstream: ['电力'],
    concepts: ['核电', '清洁能源', '三代核电']
  },
  '电力': {
    upstream: ['煤炭', '水电', '核电'],
    downstream: ['电力设备', '工业用电'],
    concepts: ['电力', '电网', '特高压']
  },
  '新能源': {
    upstream: ['光伏', '储能'],
    downstream: ['电力', '新能源汽车'],
    concepts: ['新能源', '碳中和', '绿电']
  },

  // ===== TMT =====
  '软件服务': {
    upstream: ['半导体', '云计算'],
    downstream: ['消费电子', '企业服务'],
    concepts: ['软件', 'SaaS', '云计算', 'AI']
  },
  '通信': {
    upstream: ['半导体', '电子元件'],
    downstream: ['运营商', '软件服务'],
    concepts: ['通信', '运营商', '5G']
  },
  '通信服务': {
    upstream: ['通信设备'],
    downstream: ['消费者', '企业'],
    concepts: ['通信服务', '运营商', '5G']
  },
  'AI': {
    upstream: ['半导体', '软件服务'],
    downstream: ['消费电子', '企业服务'],
    concepts: ['AI', '人工智能', '大模型', '算力']
  },
  '云计算': {
    upstream: ['半导体', '数据中心'],
    downstream: ['软件服务', '企业服务'],
    concepts: ['云计算', 'IDC', '数据中心', '算力']
  },
  '计算机': {
    upstream: ['半导体', '软件服务'],
    downstream: ['企业服务', '政府'],
    concepts: ['计算机', '信创', '网络安全']
  },
  '网络设备': {
    upstream: ['半导体', '电子元件'],
    downstream: ['通信设备', '数据中心'],
    concepts: ['网络设备', '交换机', '路由器']
  },
  '安防': {
    upstream: ['半导体', '软件服务'],
    downstream: ['政府', '企业'],
    concepts: ['安防', '摄像头', 'AI监控']
  },

  // ===== 交通运输 =====
  '航运': {
    upstream: ['船舶', '港口'],
    downstream: ['进出口', '物流'],
    concepts: ['航运', '集运', '油运']
  },
  '航空': {
    upstream: ['航空装备', '燃油'],
    downstream: ['旅游业', '物流'],
    concepts: ['航空', '民航', '出行']
  },
  '航空装备': {
    upstream: ['特种材料', '发动机'],
    downstream: ['航空', '军工'],
    concepts: ['航空装备', '军工', '大飞机']
  },
  '航空发动机': {
    upstream: ['特种材料', '精密制造'],
    downstream: ['航空装备'],
    concepts: ['航空发动机', '军工', '大飞机']
  },
  '铁路运输': {
    upstream: ['钢铁', '机械设备'],
    downstream: ['物流', '客运'],
    concepts: ['铁路运输', '高铁', '中字头']
  },
  '快递': {
    upstream: ['物流', '包装材料'],
    downstream: ['电商', '消费者'],
    concepts: ['快递', '物流', '电商']
  },

  // ===== 农业 =====
  '畜禽养殖': {
    upstream: ['饲料', '农产品加工'],
    downstream: ['食品加工', '商超'],
    concepts: ['养殖', '猪肉', '鸡肉']
  },
  '生猪养殖': {
    upstream: ['饲料', '农产品加工'],
    downstream: ['食品加工', '商超'],
    concepts: ['猪肉', '养殖', '猪周期']
  },

  // ===== 其他 =====
  '覆铜板': {
    upstream: ['化工', '铜金矿'],
    downstream: ['半导体', '消费电子'],
    concepts: ['覆铜板', 'PCB', '电子材料']
  },
  'PCB': {
    upstream: ['覆铜板', '电子元件'],
    downstream: ['消费电子', '半导体'],
    concepts: ['PCB', '印制电路板', '电子制造']
  },
  '医美': {
    upstream: ['医疗器械', '生物制品'],
    downstream: ['消费者', '医院'],
    concepts: ['医美', '玻尿酸', '胶原蛋白']
  },
  '数字阅读': {
    upstream: ['软件服务', '云计算'],
    downstream: ['消费者', 'IP运营'],
    concepts: ['数字阅读', 'IP', '内容创作']
  },
  '广告传媒': {
    upstream: ['软件服务', '内容'],
    downstream: ['品牌商', '消费者'],
    concepts: ['广告传媒', '分众', '营销']
  },
  '文具': {
    upstream: ['化工', '塑料'],
    downstream: ['教育', '商超'],
    concepts: ['文具', '办公', '消费降级']
  },
  '肉制品': {
    upstream: ['畜禽养殖', '农产品加工'],
    downstream: ['商超', '餐饮'],
    concepts: ['肉制品', '双汇', '消费降级']
  },
  '乳品': {
    upstream: ['农产品加工', '包装材料'],
    downstream: ['商超', '消费者'],
    concepts: ['乳业', '伊利', '消费降级']
  }
}

// ===== 备用关键词映射（当精确匹配失败时）=====
const KEYWORD_INDUSTRY_MAP: Record<string, string> = {
  '酒': '白酒',
  '饮料': '饮料乳品',
  '奶': '乳品',
  '食品': '食品加工',
  '电池': '锂电池',
  '电芯': '锂电池',
  '芯片': '半导体',
  'IC': '半导体',
  '制药': '化学制药',
  '医药': '化学制药',
  '医疗': '医疗器械',
  '银行': '银行',
  '券商': '证券',
  '保险': '保险',
  '光伏': '光伏',
  '风电': '新能源',
  '核电': '核电',
  '水电': '水电',
  '电力': '电力',
  '煤炭': '煤炭',
  '钢铁': '钢铁',
  '水泥': '水泥',
  '汽车': '汽车整车',
  '家电': '家电',
  '地产': '房地产',
  '房地产': '房地产',
  '物业': '物业管理',
  '养猪': '生猪养殖',
  '猪肉': '畜禽养殖',
  '养殖': '畜禽养殖',
  '航空': '航空',
  '航运': '航运',
  '快递': '快递',
  '物流': '快递',
  '软件': '软件服务',
  'AI': 'AI',
  '通信': '通信',
  '安防': '安防',
  '云计算': '云计算',
  '计算机': '计算机',
  '互联网': '软件服务',
  '游戏': '软件服务',
}

// ===== 东方财富 API 请求 =====

// 获取行业/概念列表并缓存
async function fetchIndustryList(): Promise<Map<string, string>> {
  if (industryMap) return industryMap

  const cacheKey = 'em_industry_map'
  const cached = cache.get<Map<string, string>>(cacheKey)
  if (cached) {
    industryMap = cached
    return cached
  }

  try {
    const res = await axios.get(EM_INDUSTRY_LIST, {
      params: {
        fid: 'f62',
        po: 1,
        pz: 200,
        pn: 1,
        np: 1,
        fltt: 2,
        invt: 2,
        fs: 'm:90+s:4', // 行业板块
        fields: 'f12,f14'
      },
      timeout: 10000
    })

    const map = new Map<string, string>()
    if (res.data?.data?.diff) {
      for (const item of res.data.data.diff) {
        map.set(item.f12, item.f14)
      }
    }

    industryMap = map
    cache.set(cacheKey, map, 86400) // 缓存24小时
    return map
  } catch (e: any) {
    console.error('fetchIndustryList error:', e.message)
    return new Map()
  }
}

// 获取概念列表并缓存
async function fetchConceptList(): Promise<Map<string, string>> {
  if (conceptMap) return conceptMap

  const cacheKey = 'em_concept_map'
  const cached = cache.get<Map<string, string>>(cacheKey)
  if (cached) {
    conceptMap = cached
    return cached
  }

  try {
    const res = await axios.get(EM_CONCEPT_LIST, {
      params: {
        fid: 'f62',
        po: 1,
        pz: 500,
        pn: 1,
        np: 1,
        fltt: 2,
        invt: 2,
        fs: 'm:90+t:2', // 概念板块
        fields: 'f12,f14'
      },
      timeout: 10000
    })

    const map = new Map<string, string>()
    if (res.data?.data?.diff) {
      for (const item of res.data.data.diff) {
        map.set(item.f12, item.f14)
      }
    }

    conceptMap = map
    cache.set(cacheKey, map, 86400)
    return map
  } catch (e: any) {
    console.error('fetchConceptList error:', e.message)
    return new Map()
  }
}

// 获取行业成分股
async function fetchIndustryStocks(industryCode: string): Promise<string[]> {
  const cacheKey = `em_ind_stocks_${industryCode}`
  const cached = cache.get<string[]>(cacheKey)
  if (cached) return cached

  try {
    const res = await axios.get(EM_STOCK_LIST, {
      params: {
        fid: 'f3',
        po: 1,
        pz: 50,
        pn: 1,
        np: 1,
        fltt: 2,
        invt: 2,
        fs: `m:0+t:6+s:${industryCode}`,
        fields: 'f12'
      },
      timeout: 10000
    })

    const stocks = res.data?.data?.diff?.map((item: any) => item.f12) || []
    cache.set(cacheKey, stocks, 3600) // 缓存1小时
    return stocks
  } catch (e: any) {
    console.error(`fetchIndustryStocks(${industryCode}) error:`, e.message)
    return []
  }
}

// ===== 核心算法：构建产业链图 =====

function findRelatedIndustries(industry: string): { upstream: string[]; downstream: string[]; concepts: string[] } {
  // 精确匹配
  for (const [key, value] of Object.entries(INDUSTRY_CHAIN)) {
    if (industry === key || industry.includes(key) || key.includes(industry)) {
      return value
    }
  }

  // 关键词匹配（使用 KEYWORD_INDUSTRY_MAP）
  for (const [keyword, mappedIndustry] of Object.entries(KEYWORD_INDUSTRY_MAP)) {
    if (industry.includes(keyword)) {
      const chainInfo = INDUSTRY_CHAIN[mappedIndustry]
      if (chainInfo) return chainInfo
    }
  }

  return { upstream: [], downstream: [], concepts: [] }
}

function getStockInfo(symbol: string): { name: string; industry: string; market: string } | null {
  // 提取纯数字代码
  const code = symbol.replace(/\D/g, '').slice(0, 6)

  // 先查本地缓存
  const local = CHINA_STOCKS_MAP[code]
  if (local) {
    return { name: local.name, industry: local.industry, market: local.market }
  }

  return null
}

function buildChainGraph(symbol: string): ChainResult {
  const stockInfo = getStockInfo(symbol)
  const name = stockInfo?.name || symbol
  const industry = stockInfo?.industry || 'Unknown'
  const market = stockInfo?.market || '沪深'

  const nodes: ChainNode[] = []
  const edges: ChainEdge[] = []
  const upstream: string[] = []
  const downstream: string[] = []
  const relatedConcepts: string[] = []

  // 1. 添加目标股票（self）
  nodes.push({
    symbol,
    name,
    industry,
    industryCode: '',
    market,
    relation: 'self',
    score: 100
  })

  // 2. 查找同行股票（peer）
  const peerStocks = findPeerStocks(symbol, industry)
  for (const peer of peerStocks.slice(0, 5)) {
    nodes.push({
      ...peer,
      relation: 'peer'
    })
    edges.push({
      source: symbol,
      target: peer.symbol,
      type: 'peer',
      strength: 1
    })
  }

  // 3. 查找上下游关系
  const chainInfo = findRelatedIndustries(industry)

  for (const upInd of chainInfo.upstream) {
    const upStocks = getStocksByIndustry(upInd)
    for (const s of upStocks.slice(0, 3)) {
      if (s.symbol !== symbol && !nodes.find(n => n.symbol === s.symbol)) {
        nodes.push({ ...s, relation: 'upstream' })
        upstream.push(s.name)
        edges.push({
          source: s.symbol,
          target: symbol,
          type: 'upstream',
          strength: 0.8
        })
      }
    }
  }

  for (const downInd of chainInfo.downstream) {
    const downStocks = getStocksByIndustry(downInd)
    for (const s of downStocks.slice(0, 3)) {
      if (s.symbol !== symbol && !nodes.find(n => n.symbol === s.symbol)) {
        nodes.push({ ...s, relation: 'downstream' })
        downstream.push(s.name)
        edges.push({
          source: symbol,
          target: s.symbol,
          type: 'downstream',
          strength: 0.8
        })
      }
    }
  }

  // 4. 添加概念关联
  for (const concept of chainInfo.concepts.slice(0, 3)) {
    relatedConcepts.push(concept)
  }

  return {
    symbol,
    name,
    industry,
    totalNodes: nodes.length,
    nodes,
    edges,
    upstream,
    downstream,
    relatedConcepts
  }
}

// 从本地缓存查找同行股票
function findPeerStocks(symbol: string, industry: string): Array<{ symbol: string; name: string; industry: string; market: string }> {
  const peers: Array<{ symbol: string; name: string; industry: string; market: string }> = []

  for (const [code, info] of Object.entries(CHINA_STOCKS_MAP)) {
    if (info.industry === industry && code !== symbol.replace(/\D/g, '').slice(0, 6)) {
      peers.push({
        symbol: code,
        name: info.name,
        industry: info.industry,
        market: info.market
      })
    }
  }

  return peers.slice(0, 6)
}

// 根据行业获取股票
function getStocksByIndustry(industry: string): Array<{ symbol: string; name: string; industry: string; market: string }> {
  const stocks: Array<{ symbol: string; name: string; industry: string; market: string }> = []

  const industryKeywords = getIndustryKeywords(industry)

  for (const [code, info] of Object.entries(CHINA_STOCKS_MAP)) {
    if (industryKeywords.some(kw => info.industry.includes(kw))) {
      stocks.push({
        symbol: code,
        name: info.name,
        industry: info.industry,
        market: info.market
      })
    }
  }

  return stocks.slice(0, 5)
}

function getIndustryKeywords(industry: string): string[] {
  const map: Record<string, string[]> = {
    '白酒': ['白酒', '酒'],
    '半导体': ['半导体', '电子'],
    '光伏': ['光伏', '新能源'],
    '锂电池': ['锂电池', '锂', '电池'],
    '新能源汽车': ['新能源', '汽车'],
    '医疗器械': ['医疗', '器械'],
    '银行': ['银行'],
    '证券': ['证券'],
    '家电': ['家电'],
    '房地产': ['房地产', '物业'],
  }

  return map[industry] || [industry]
}

// ===== 路由定义 =====

export async function chainRoutes(app: FastifyInstance) {

  // 获取 A股 产业链图
  app.get<{ Params: { symbol: string } }>('/:symbol/chain', async (req, reply) => {
    const { symbol } = req.params
    const code = symbol.replace(/\D/g, '').slice(0, 6)

    try {
      const result = buildChainGraph(code)
      return result
    } catch (err: any) {
      console.error('China Chain API error:', err)
      return reply.status(500).send({ error: '产业链数据获取失败', message: err.message })
    }
  })

  // 获取行业列表
  app.get('/industries', async () => {
    const map = await fetchIndustryList()
    const industries = Array.from(map.entries()).map(([code, name]) => ({
      code,
      name,
      count: 0 // 成分股数量需要单独请求
    }))
    return { total: industries.length, industries }
  })

  // 获取概念列表
  app.get('/concepts', async () => {
    const map = await fetchConceptList()
    const concepts = Array.from(map.entries()).map(([code, name]) => ({ code, name }))
    return { total: concepts.length, concepts }
  })

  // 获取行业成分股
  app.get<{ Params: { code: string } }>('/industry/:code/stocks', async (req, reply) => {
    const { code } = req.params
    try {
      const stocks = await fetchIndustryStocks(code)
      return { industryCode: code, industryName: '', total: stocks.length, stocks }
    } catch (err: any) {
      return reply.status(500).send({ error: '获取行业成分股失败', message: err.message })
    }
  })

  // 搜索行业/概念
  app.get<{ Querystring: { q: string } }>('/search', async (req, reply) => {
    const { q } = req.query
    if (!q) return { industries: [], concepts: [] }

    const industryMap = await fetchIndustryList()
    const conceptMap = await fetchConceptList()

    const industries = Array.from(industryMap.entries())
      .filter(([_, name]) => name.includes(q))
      .map(([code, name]) => ({ code, name, type: 'industry' }))

    const concepts = Array.from(conceptMap.entries())
      .filter(([_, name]) => name.includes(q))
      .map(([code, name]) => ({ code, name, type: 'concept' }))

    return { industries, concepts, total: industries.length + concepts.length }
  })
}