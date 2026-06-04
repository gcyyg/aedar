/**
 * A股常用股票基本信息本地缓存
 * 解决 TuShare stock_basic API 1次/小时限速问题
 * Key: 6位代码（不含.SH/.SZ后缀）
 */

import { pinyin } from 'pinyin'

/**
 * 获取中文名称的拼音首字母缩写
 * 例如：贵州茅台 -> GTM，招商银行 -> ZSYH
 */
export function getPinyinInitials(name: string): string {
  try {
    const pys = pinyin(name, { style: 0 })  // style 0 = full pinyin
    return pys.map(p => p[0][0].toUpperCase()).join('')
  } catch {
    return ''
  }
}

export function getPinyinFull(name: string): string {
  try {
    const pys = pinyin(name, { style: 0 })
    return pys.flat().join('').toLowerCase()
  } catch {
    return ''
  }
}

export const CHINA_STOCKS_MAP: Record<string, { name: string; industry: string; market: string }> = {
  // 沪深300 核心成分股
  '600519': { name: '贵州茅台', industry: '白酒', market: '上交所' },
  '600036': { name: '招商银行', industry: '银行', market: '上交所' },
  '600276': { name: '恒瑞医药', industry: '化学制药', market: '上交所' },
  '600887': { name: '伊利股份', industry: '乳品', market: '上交所' },
  '600030': { name: '中信证券', industry: '证券', market: '上交所' },
  '600031': { name: '三一重工', industry: '工程机械', market: '上交所' },
  '600048': { name: '保利发展', industry: '房地产', market: '上交所' },
  '600050': { name: '中国联通', industry: '通信服务', market: '上交所' },
  '600089': { name: '特变电工', industry: '电气设备', market: '上交所' },
  '600104': { name: '上汽集团', industry: '汽车整车', market: '上交所' },
  '600109': { name: '国金证券', industry: '证券', market: '上交所' },
  '600111': { name: '北方稀土', industry: '稀土', market: '上交所' },
  '600115': { name: '东方航空', industry: '航空', market: '上交所' },
  '600118': { name: '中国卫星', industry: '航天装备', market: '上交所' },
  '600150': { name: '中国船舶', industry: '船舶制造', market: '上交所' },
  '600160': { name: '巨化股份', industry: '化工', market: '上交所' },
  '600170': { name: '上海建工', industry: '建筑施工', market: '上交所' },
  '600176': { name: '中国巨石', industry: '玻纤', market: '上交所' },
  '600183': { name: '生益科技', industry: '覆铜板', market: '上交所' },
  '600196': { name: '复星医药', industry: '生物制药', market: '上交所' },
  '600309': { name: '万华化学', industry: '化工', market: '上交所' },
  '600406': { name: '国电南瑞', industry: '电力设备', market: '上交所' },
  '600438': { name: '通威股份', industry: '光伏', market: '上交所' },
  '600547': { name: '山东黄金', industry: '黄金', market: '上交所' },
  '600570': { name: '恒生电子', industry: '软件服务', market: '上交所' },
  '600585': { name: '海螺水泥', industry: '水泥', market: '上交所' },
  '600588': { name: '用友网络', industry: '软件服务', market: '上交所' },
  '600606': { name: '绿地控股', industry: '房地产', market: '上交所' },
  '600690': { name: '海尔智家', industry: '家电', market: '上交所' },
  '600703': { name: '三安光电', industry: 'LED', market: '上交所' },
  '600745': { name: '闻泰科技', industry: '半导体', market: '上交所' },
  '600760': { name: '中航沈飞', industry: '航空装备', market: '上交所' },
  '600809': { name: '山西汾酒', industry: '白酒', market: '上交所' },
  '600837': { name: '海通证券', industry: '证券', market: '上交所' },
  '600867': { name: '通化东宝', industry: '生物制药', market: '上交所' },
  '600893': { name: '航发动力', industry: '航空发动机', market: '上交所' },
  '600900': { name: '长江电力', industry: '水电', market: '上交所' },
  '600905': { name: '三峡能源', industry: '新能源', market: '上交所' },
  '600918': { name: '中泰证券', industry: '证券', market: '上交所' },
  '600926': { name: '杭州银行', industry: '银行', market: '上交所' },
  '600941': { name: '中国移动', industry: '通信', market: '上交所' },
  '600989': { name: '宝丰能源', industry: '煤化工', market: '上交所' },
  '600999': { name: '招商证券', industry: '证券', market: '上交所' },
  '601006': { name: '大秦铁路', industry: '铁路运输', market: '上交所' },
  '601012': { name: '隆基绿能', industry: '光伏', market: '上交所' },
  '601066': { name: '中信建投', industry: '证券', market: '上交所' },
  '601088': { name: '中国神华', industry: '煤炭', market: '上交所' },
  '601118': { name: '海南橡胶', industry: '橡胶', market: '上交所' },
  '601138': { name: '工业富联', industry: '电子制造', market: '上交所' },
  '601166': { name: '兴业银行', industry: '银行', market: '上交所' },
  '601169': { name: '北京银行', industry: '银行', market: '上交所' },
  '601186': { name: '中国铁建', industry: '建筑', market: '上交所' },
  '601211': { name: '国泰君安', industry: '证券', market: '上交所' },
  '601225': { name: '陕西煤业', industry: '煤炭', market: '上交所' },
  '601236': { name: '红塔证券', industry: '证券', market: '上交所' },
  '601288': { name: '农业银行', industry: '银行', market: '上交所' },
  '601318': { name: '中国平安', industry: '保险', market: '上交所' },
  '601328': { name: '交通银行', industry: '银行', market: '上交所' },
  '601336': { name: '新华保险', industry: '保险', market: '上交所' },
  '601390': { name: '中国中铁', industry: '建筑', market: '上交所' },
  '601398': { name: '工商银行', industry: '银行', market: '上交所' },
  '601601': { name: '中国太保', industry: '保险', market: '上交所' },
  '601628': { name: '中国人寿', industry: '保险', market: '上交所' },
  '601658': { name: '邮储银行', industry: '银行', market: '上交所' },
  '601668': { name: '中国建筑', industry: '建筑', market: '上交所' },
  '601688': { name: '华泰证券', industry: '证券', market: '上交所' },
  '601698': { name: '中国卫通', industry: '卫星通信', market: '上交所' },
  '601728': { name: '中国电信', industry: '通信', market: '上交所' },
  '601800': { name: '中国交建', industry: '建筑', market: '上交所' },
  '601818': { name: '光大银行', industry: '银行', market: '上交所' },
  '601857': { name: '中国石油', industry: '石油开采', market: '上交所' },
  '601888': { name: '中国中免', industry: '旅游零售', market: '上交所' },
  '601899': { name: '紫金矿业', industry: '铜金矿', market: '上交所' },
  '601919': { name: '中远海控', industry: '航运', market: '上交所' },
  '601985': { name: '中国核电', industry: '核电', market: '上交所' },
  '601988': { name: '中国银行', industry: '银行', market: '上交所' },
  '601989': { name: '中国重工', industry: '船舶', market: '上交所' },
  '601990': { name: '南京证券', industry: '证券', market: '上交所' },
  '601995': { name: '中金公司', industry: '证券', market: '上交所' },
  '603259': { name: '药明康德', industry: '医药服务', market: '上交所' },
  '603288': { name: '海天味业', industry: '调味品', market: '上交所' },
  '603501': { name: '韦尔股份', industry: '半导体', market: '上交所' },
  '603799': { name: '华友钴业', industry: '钴铜', market: '上交所' },
  '603806': { name: '福斯特', industry: '光伏材料', market: '上交所' },
  '603868': { name: '飞鹤奶粉', industry: '乳品', market: '上交所' },
  '603899': { name: '晨光股份', industry: '文具', market: '上交所' },
  '603986': { name: '兆易创新', industry: '半导体', market: '上交所' },
  '688012': { name: '中微公司', industry: '半导体设备', market: '科创板' },
  '688041': { name: '海光信息', industry: '半导体', market: '科创板' },
  '688111': { name: '金山办公', industry: '软件', market: '科创板' },
  '688126': { name: '沪硅产业', industry: '半导体材料', market: '科创板' },
  '688981': { name: '中芯国际', industry: '半导体制造', market: '科创板' },
  '688502': { name: '路维光电', industry: '半导体', market: '科创板' },
  // 深交所
  '000001': { name: '平安银行', industry: '银行', market: '深交所' },
  '000002': { name: '万科A', industry: '房地产', market: '深交所' },
  '000063': { name: '中兴通讯', industry: '通信设备', market: '深交所' },
  '000066': { name: '中国长城', industry: '计算机', market: '深交所' },
  '000100': { name: 'TCL科技', industry: '电子', market: '深交所' },
  '000333': { name: '美的集团', industry: '家电', market: '深交所' },
  '000338': { name: '潍柴动力', industry: '发动机', market: '深交所' },
  '000425': { name: '徐工机械', industry: '工程机械', market: '深交所' },
  '000538': { name: '云南白药', industry: '中药', market: '深交所' },
  '000568': { name: '泸州老窖', industry: '白酒', market: '深交所' },
  '000596': { name: '古井贡酒', industry: '白酒', market: '深交所' },
  '000651': { name: '格力电器', industry: '家电', market: '深交所' },
  '000661': { name: '长春高新', industry: '生物制药', market: '深交所' },
  '000708': { name: '中信特钢', industry: '特钢', market: '深交所' },
  '000725': { name: '京东方A', industry: '显示面板', market: '深交所' },
  '000768': { name: '中航西飞', industry: '航空装备', market: '深交所' },
  '000858': { name: '五粮液', industry: '白酒', market: '深交所' },
  '000876': { name: '新希望', industry: '饲料', market: '深交所' },
  '000895': { name: '双汇发展', industry: '肉制品', market: '深交所' },
  '000938': { name: '紫光股份', industry: '网络设备', market: '深交所' },
  '000961': { name: '中南建设', industry: '房地产', market: '深交所' },
  '000983': { name: '山西焦煤', industry: '煤炭', market: '深交所' },
  '001979': { name: '招商蛇口', industry: '房地产', market: '深交所' },
  '002001': { name: '新和成', industry: '化学原料药', market: '中小板' },
  '002027': { name: '分众传媒', industry: '广告传媒', market: '中小板' },
  '002049': { name: '紫光国微', industry: '半导体', market: '中小板' },
  '002120': { name: '韵达股份', industry: '快递', market: '中小板' },
  '002142': { name: '宁波银行', industry: '银行', market: '中小板' },
  '002230': { name: '科大讯飞', industry: 'AI', market: '中小板' },
  '002236': { name: '大华股份', industry: '安防', market: '中小板' },
  '002252': { name: '上海莱士', industry: '血液制品', market: '中小板' },
  '002304': { name: '洋河股份', industry: '白酒', market: '中小板' },
  '002311': { name: '海大集团', industry: '饲料', market: '中小板' },
  '002352': { name: '顺丰控股', industry: '快递', market: '中小板' },
  '002371': { name: '北方华创', industry: '半导体设备', market: '中小板' },
  '002375': { name: '亚厦股份', industry: '装饰', market: '中小板' },
  '002412': { name: '汉森制药', industry: '中药', market: '中小板' },
  '002415': { name: '海康威视', industry: '安防', market: '中小板' },
  '002434': { name: '万里扬', industry: '汽车零部件', market: '中小板' },
  '002460': { name: '赣锋锂业', industry: '锂矿', market: '中小板' },
  '002475': { name: '立讯精密', industry: '消费电子', market: '中小板' },
  '002493': { name: '荣盛石化', industry: '石化', market: '中小板' },
  '002594': { name: '比亚迪', industry: '新能源汽车', market: '中小板' },
  '002601': { name: '龙佰集团', industry: '钛白粉', market: '中小板' },
  '002607': { name: '亚玛顿', industry: '光伏玻璃', market: '中小板' },
  '002714': { name: '牧原股份', industry: '生猪养殖', market: '中小板' },
  '002736': { name: '国信证券', industry: '证券', market: '中小板' },
  '002812': { name: '恩捷股份', industry: '锂电池隔膜', market: '中小板' },
  '002841': { name: '视源股份', industry: '显示模组', market: '中小板' },
  '002916': { name: '深南电路', industry: 'PCB', market: '中小板' },
  '002920': { name: '兆丰股份', industry: '汽车零部件', market: '中小板' },
  '003816': { name: '中国广核', industry: '核电', market: '深交所' },
  '003876': { name: 'OpenHarmony', industry: '软件', market: '深交所' },
  '300001': { name: '特锐德', industry: '充电桩', market: '创业板' },
  '300015': { name: '爱尔眼科', industry: '医疗服务', market: '创业板' },
  '300033': { name: '同花顺', industry: '互联网金融', market: '创业板' },
  '300059': { name: '东方财富', industry: '互联网金融', market: '创业板' },
  '300122': { name: '智飞生物', industry: '疫苗', market: '创业板' },
  '300124': { name: '汇川技术', industry: '工业自动化', market: '创业板' },
  '300142': { name: '沃森生物', industry: '疫苗', market: '创业板' },
  '300223': { name: '北京君正', industry: '半导体', market: '创业板' },
  '300274': { name: '阳光电源', industry: '光伏逆变器', market: '创业板' },
  '300347': { name: '泰格医药', industry: '医药服务', market: '创业板' },
  '300364': { name: '中文在线', industry: '数字阅读', market: '创业板' },
  '300408': { name: '三环集团', industry: '电子元件', market: '创业板' },
  '300474': { name: '景嘉微', industry: 'GPU', market: '创业板' },
  '300496': { name: '中科创达', industry: '软件', market: '创业板' },
  '300529': { name: '健帆生物', industry: '医疗器械', market: '创业板' },
  '300601': { name: '康泰生物', industry: '疫苗', market: '创业板' },
  '300628': { name: '亿联网络', industry: '通信设备', market: '创业板' },
  '300750': { name: '宁德时代', industry: '锂电池', market: '创业板' },
  '300759': { name: '康龙化成', industry: '医药服务', market: '创业板' },
  '300760': { name: '迈瑞医疗', industry: '医疗器械', market: '创业板' },
  '300896': { name: '爱美客', industry: '医美', market: '创业板' },
  '300982': { name: '苏文电能', industry: '电力服务', market: '创业板' },
  '301071': { name: '力量钻石', industry: '人造钻石', market: '创业板' },
  '000657': { name: '中钨高新', industry: '钨', market: '深交所' },
}

/**
 * 懒加载：拼音首字母 → 代码 反向索引
 */
let pinyinIndex: Map<string, string> | null = null

function buildPinyinIndex(): Map<string, string> {
  if (pinyinIndex) return pinyinIndex
  pinyinIndex = new Map()
  for (const [code, info] of Object.entries(CHINA_STOCKS_MAP)) {
    const pys = pinyin(info.name, { style: 0 })
    const initials = pys.map(p => p[0][0].toUpperCase()).join('')
    pinyinIndex.set(initials, code)
    // 也存全拼小写
    const full = pys.flat().join('').toLowerCase()
    pinyinIndex.set(full, code)
  }
  return pinyinIndex
}

/**
 * 根据股票代码或拼音查询本地基本信息
 */
export function getChinaStockBasic(symbol: string): { symbol: string; name: string; market: string; industry: string; area: string } | null {
  const input = symbol.replace(/\.(SH|SZ|BJ)/i, '').toUpperCase()

  // 1. 精确6位代码
  if (/^\d{6}$/.test(input)) {
    const info = CHINA_STOCKS_MAP[input]
    if (info) return { symbol: input, name: info.name, market: info.market, industry: info.industry, area: info.market }
  }

  // 2. 拼音首字母或全拼查找
  const idx = buildPinyinIndex()
  const code = idx.get(input.toUpperCase()) || idx.get(input.toLowerCase())
  if (code) {
    const info = CHINA_STOCKS_MAP[code]
    return { symbol: code, name: info.name, market: info.market, industry: info.industry, area: info.market }
  }

  return null
}
