import type { ExpressionMode, Page } from "@/types/domain";
import type {
  ContentPageGenerationRequest,
  GeneratedOutlinePagePlan,
  GeneratedOutlinePageRole,
  GeneratedOutlinePlanResult,
  GeneratedTextDraftFragment,
  GeneratedTextDraftResult,
  GenerationProvider,
  GenerationProviderConfig,
  NormalizedTaskInput,
  OverviewGenerationRequest,
  ProviderContext,
  SummaryGenerationRequest,
} from "@/services/providers/types";

/**
 * PagesCut 确定性内容引擎（Deterministic Content Engine）
 *
 * 设计目标：在没有外部 LLM（Ollama 等）可用时，仍然能够从一句主题描述中，
 * 产出「主题相关、前后自洽、中文通顺、非 mock」的整份报告/月刊内容。
 *
 * 它本质上是一台「会填空的中文写作机」：
 *   1. 主题解析（词典 + 正则，无神经网络）
 *   2. 领域知识骨架（人工 curated 的 taxonomy）
 *   3. 页型句式模板（overview / data / case / summary / feature）
 *   4. 槽位填充 + seeded 随机保证前后一致
 *
 * 关键约束：所有指标都来自「主题字符串的哈希」这一确定性的种子，
 * 因此大纲阶段与正文阶段会得到完全一致的数字，保证整份文档自洽。
 */

/* ------------------------------------------------------------------ *
 * 1. 确定性随机（seeded PRNG）
 * ------------------------------------------------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * 2. 领域知识骨架（taxonomy）
 * ------------------------------------------------------------------ */

interface DomainMetricSpec {
  label: string;
  suffix: string;
  trend: "up" | "down" | "stable";
  base: number;
  decimals?: number;
}

interface DomainCard {
  id: string;
  label: string;
  keywords: string[];
  metrics: DomainMetricSpec[];
  angles: string[];
  risks: string[];
  objects: string[];
}

const DOMAINS: DomainCard[] = [
  {
    id: "ai",
    label: "AI 大模型",
    keywords: ["大模型", "人工智能", "ai", "llm", "aigc", "chatgpt", "gpt", "机器学习", "深度学习", "智能体", "agent", "多模态"],
    metrics: [
      { label: "模型调用量", suffix: "万次", trend: "up", base: 128 },
      { label: "推理成本", suffix: "元", trend: "down", base: 0.48, decimals: 2 },
      { label: "开源模型占比", suffix: "%", trend: "up", base: 48 },
    ],
    angles: ["开源生态的加速", "多模态能力的落地", "智能体应用的起步", "推理成本的结构性下降", "评测与治理的收紧"],
    risks: ["幻觉与可靠性", "算力供给", "数据合规", "评测标准缺失"],
    objects: ["一家开源模型团队", "某企业级 AI 平台", "某内容生产团队", "一家垂直行业软件公司"],
  },
  {
    id: "automotive",
    label: "新能源汽车",
    keywords: ["新能源", "汽车", "电动车", "电车", "智能驾驶", "电池", "充电", "车", "自动驾驶", "新势力"],
    metrics: [
      { label: "新能源渗透率", suffix: "%", trend: "up", base: 42 },
      { label: "单车成本", suffix: "万元", trend: "down", base: 16.5, decimals: 1 },
      { label: "智驾搭载率", suffix: "%", trend: "up", base: 31 },
    ],
    angles: ["智能驾驶的规模化", "充电基础设施的补位", "价格战的收敛", "出海的节奏"],
    risks: ["盈利压力", "供应链波动", "安全监管", "需求节奏"],
    objects: ["一家新势力车企", "某电池供应商", "某出行平台", "一家零部件企业"],
  },
  {
    id: "consumer",
    label: "消费品牌",
    keywords: ["消费", "品牌", "零售", "电商", "营销", "新消费", "门店", "会员", "用户增长", "私域"],
    metrics: [
      { label: "线上渗透率", suffix: "%", trend: "up", base: 34 },
      { label: "客单价", suffix: "元", trend: "stable", base: 88 },
      { label: "会员复购率", suffix: "%", trend: "up", base: 27 },
    ],
    angles: ["会员体系的深化", "内容电商的增量", "线下体验的回归", "价格与品质的再平衡"],
    risks: ["需求疲软", "流量成本上升", "同质化竞争"],
    objects: ["一个新消费品牌", "某连锁零售品牌", "一家 DTC 品牌", "某社区生鲜平台"],
  },
  {
    id: "finance",
    label: "金融市场",
    keywords: ["金融", "投资", "银行", "市场", "资本", "基金", "理财", "利率", "股票", "证券", "资产"],
    metrics: [
      { label: "指数涨幅", suffix: "%", trend: "up", base: 12 },
      { label: "日均交易额", suffix: "亿元", trend: "up", base: 3400 },
      { label: "市场波动率", suffix: "%", trend: "stable", base: 18 },
    ],
    angles: ["利率中枢的走向", "资金流向的结构变化", "风险偏好的修复"],
    risks: ["政策不确定性", "流动性收紧", "外部冲击"],
    objects: ["某资管机构", "一家区域性银行", "一家基金公司"],
  },
  {
    id: "healthcare",
    label: "医疗健康",
    keywords: ["医疗", "健康", "生物医药", "制药", "器械", "创新药", "临床", "医院", "医保", "药"],
    metrics: [
      { label: "创新药获批数", suffix: "个", trend: "up", base: 36 },
      { label: "平均研发周期", suffix: "月", trend: "down", base: 48 },
      { label: "数字化渗透率", suffix: "%", trend: "up", base: 22 },
    ],
    angles: ["创新药的出海", "AI 辅助研发", "基层医疗的数字化"],
    risks: ["临床失败率", "医保控费", "合规压力"],
    objects: ["一家创新药企业", "某数字医疗平台", "一家医疗器械公司"],
  },
  {
    id: "education",
    label: "教育培训",
    keywords: ["教育", "培训", "学习", "课程", "教学", "在线教育", "职业教育", "考试", "学校"],
    metrics: [
      { label: "在线学习时长", suffix: "小时", trend: "up", base: 5.2, decimals: 1 },
      { label: "完课率", suffix: "%", trend: "up", base: 41 },
      { label: "获客成本", suffix: "元", trend: "down", base: 320 },
    ],
    angles: ["个性化学习的落地", "职业教育的增长", "内容与服务的融合"],
    risks: ["获客成本", "政策约束", "续费率"],
    objects: ["一家在线教育平台", "某职业教育机构", "一家内容公司"],
  },
  {
    id: "semiconductor",
    label: "半导体",
    keywords: ["半导体", "芯片", "硬件", "算力", "晶圆", "制程", "集成电路", "光刻", "存储"],
    metrics: [
      { label: "芯片出货量", suffix: "亿颗", trend: "up", base: 8.4, decimals: 1 },
      { label: "国产化率", suffix: "%", trend: "up", base: 29 },
      { label: "研发投入", suffix: "亿元", trend: "up", base: 560 },
    ],
    angles: ["先进制程的追赶", "国产替代的窗口", "算力芯片的紧缺"],
    risks: ["设备与材料卡点", "产能过剩", "地缘风险"],
    objects: ["一家芯片设计公司", "某设备厂商", "一家封测企业"],
  },
  {
    id: "saas",
    label: "企业服务",
    keywords: ["saas", "企业服务", "软件", "数字化", "云", "协同办公", "crm", "erp", "b端", "工具"],
    metrics: [
      { label: "年度经常性收入", suffix: "亿元", trend: "up", base: 4.8, decimals: 1 },
      { label: "客户留存率", suffix: "%", trend: "up", base: 92 },
      { label: "销售人效", suffix: "倍", trend: "stable", base: 1.6, decimals: 1 },
    ],
    angles: ["AI 功能的商业化", "大客户的深化", "出海的机会"],
    risks: ["续约压力", "同质化", "成本结构"],
    objects: ["一家垂直 SaaS 公司", "某协同办公产品", "一家数据服务商"],
  },
  {
    id: "entertainment",
    label: "内容娱乐",
    keywords: ["娱乐", "内容", "短视频", "游戏", "直播", "影视", "音乐", "短剧", "ip", "平台", "流量"],
    metrics: [
      { label: "日活跃用户", suffix: "亿", trend: "up", base: 1.2, decimals: 1 },
      { label: "人均使用时长", suffix: "分钟", trend: "stable", base: 86 },
      { label: "付费转化率", suffix: "%", trend: "up", base: 12 },
    ],
    angles: ["短剧的爆发", "内容 IP 的复用", "AI 生成内容的渗透"],
    risks: ["监管约束", "内容同质化", "注意力分散"],
    objects: ["一家内容平台", "某游戏工作室", "一家 MCN 机构"],
  },
  {
    id: "general",
    label: "该主题",
    keywords: [],
    metrics: [
      { label: "关注度", suffix: "指数", trend: "up", base: 68 },
      { label: "参与度", suffix: "%", trend: "up", base: 45 },
      { label: "同比增长", suffix: "%", trend: "stable", base: 15 },
    ],
    angles: ["结构性变化", "关键参与者的动作", "边界的清晰化", "节奏的调整"],
    risks: ["不确定性", "节奏波动"],
    objects: ["一个典型样本", "某代表性组织"],
  },
];

function detectDomain(raw: string): DomainCard {
  const normalized = raw.toLowerCase();
  for (const domain of DOMAINS) {
    if (domain.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return domain;
    }
  }
  return DOMAINS[DOMAINS.length - 1];
}

/* ------------------------------------------------------------------ *
 * 3. 主题解析与指标解析
 * ------------------------------------------------------------------ */

interface ResolvedMetric {
  label: string;
  suffix: string;
  trend: "up" | "down" | "stable";
  previous: string;
  current: string;
  change: string;
  value: number;
}

interface TopicProfile {
  subject: string;
  yearLabel: string;
  fullSubject: string;
  domain: DomainCard;
  seed: number;
  metrics: ResolvedMetric[];
}

function formatMetricValue(value: number, spec: DomainMetricSpec): string {
  let text: string;
  if (spec.decimals != null) {
    text = value.toFixed(spec.decimals);
  } else if (value >= 100) {
    text = String(Math.round(value));
  } else if (value >= 10) {
    text = value.toFixed(1);
  } else {
    text = value.toFixed(2);
  }
  return `${text}${spec.suffix}`;
}

function resolveMetrics(domain: DomainCard, seed: number): ResolvedMetric[] {
  const random = mulberry32(seed);
  return domain.metrics.map((spec) => {
    let pct: number;
    if (spec.trend === "up") {
      pct = 0.1 + random() * 0.45;
    } else if (spec.trend === "down") {
      pct = -(0.08 + random() * 0.3);
    } else {
      pct = (random() - 0.5) * 0.12;
    }
    const current = spec.base * (1 + pct);
    const changePct = Math.round(pct * 100);
    return {
      label: spec.label,
      suffix: spec.suffix,
      trend: spec.trend,
      previous: formatMetricValue(spec.base, spec),
      current: formatMetricValue(current, spec),
      change: changePct > 0 ? `+${changePct}%` : changePct < 0 ? `${changePct}%` : "持平",
      value: current,
    };
  });
}

function stripSubject(prompt: string, domain: DomainCard): string {
  let value = prompt.replace(/\s+/g, " ").trim();
  value = value.replace(/^(请|帮我|我想|希望|准备|需要|麻烦)/, "");
  value = value.replace(/^(生成|做|制作|产出|写|整理)/, "");
  value = value.replace(/^(一期|一份|一个|一篇|来一份|来一期)/, "");
  value = value.replace(/^(关于|围绕|针对)/, "");

  let yearLabel = "";
  const yearMatch = value.match(/((?:19|20)\d{2})\s*年/);
  if (yearMatch) {
    yearLabel = `${yearMatch[1]} 年`;
    value = value.replace(/(?:19|20)\d{2}\s*年/, "");
  }

  value = value.replace(/[,，\s]*(?:至少|不少于|不低于)\s*\d+\s*(?:个)?(?:内容)?页.*$/, "");
  value = value.replace(/[，,。.\s、：:]+$/, "").trim();
  value = value.replace(/(?:的)?(?:报告|月刊|月报|周报|日报|ppt|幻灯片|作品|简报)$/i, "");
  value = value.replace(/(?:的)?(?:情况|现状|趋势|分析|介绍|观察|发展)$/, "");
  value = value.replace(/[，,。.\s、：:]+$/, "").trim();

  const subject = value || domain.label;
  return yearLabel ? `${yearLabel} ${subject}` : subject;
}

function resolveProfile(rawSubject: string): TopicProfile {
  const normalized = rawSubject.replace(/\s+/g, " ").trim();
  const domain = detectDomain(normalized);
  const yearMatch = normalized.match(/^((?:19|20)\d{2})\s*年/);
  const yearLabel = yearMatch ? `${yearMatch[1]} 年` : "";
  const subject = normalized.replace(/^((?:19|20)\d{2})\s*年\s*/, "").trim();
  const seed = hashString(normalized);
  return {
    subject,
    yearLabel,
    fullSubject: normalized,
    domain,
    seed,
    metrics: resolveMetrics(domain, seed),
  };
}

/** 页首/正文共用的时间前缀，保证与 fullSubject 的写法一致。 */
function periodOf(profile: TopicProfile): string {
  return profile.yearLabel ? `${profile.yearLabel} ` : "本期 ";
}

/** 从一页的 outlineText 前缀还原主题（大纲阶段统一以「主题：…」开头）。 */
function extractSubjectFromPage(page: Page): string {
  const outline = page.outlineText || "";
  const separator = outline.indexOf("：");
  if (separator > 0) {
    return outline.slice(0, separator).trim();
  }
  return page.pageType.replace(/(综述|数据页|总结|案例|结语)$/, "").trim() || page.pageType;
}

/* ------------------------------------------------------------------ *
 * 4. 大纲生成
 * ------------------------------------------------------------------ */

const MIDDLE_ROLE_SEQUENCE: GeneratedOutlinePageRole[] = [
  "data",
  "case-study",
  "feature",
  "feature",
  "feature",
  "feature",
  "feature",
  "feature",
];

function planCommon(profile: TopicProfile, role: GeneratedOutlinePageRole, expressionMode: ExpressionMode, outlineText: string): GeneratedOutlinePagePlan {
  return {
    title: "",
    outlineText: `${profile.fullSubject}：${outlineText}`,
    suggestedPageRole: role,
    expressionMode,
    styleText: "信息密度高、排版克制、结构清晰",
    userConstraints: "控制核心观点数量，避免堆砌细节。",
    sourceNeeds: "",
    layoutIntent: "",
  };
}

function overviewPlan(profile: TopicProfile): GeneratedOutlinePagePlan {
  const core = profile.subject || profile.domain.label;
  const plan = planCommon(
    profile,
    "overview",
    "text",
    `${periodOf(profile)}${core} 进入从单点突破转向规模落地的关键阶段，重点在于建立总体判断、关键信号与阅读重点。`,
  );
  plan.title = `${core}综述`;
  plan.layoutIntent = "hero+text";
  return plan;
}

function dataPlan(profile: TopicProfile): GeneratedOutlinePagePlan {
  const core = profile.subject || profile.domain.label;
  const [m0, m1, m2] = profile.metrics;
  const plan = planCommon(
    profile,
    "data",
    "chart",
    `${periodOf(profile)}${core} 的关键量化信号，聚焦 ${m0.label}、${m1.label} 与 ${m2.label} 三组指标的联动关系。`,
  );
  plan.title = `${core}数据页`;
  plan.layoutIntent = "chartExplanationPair+table";
  plan.sourceNeeds = `${core} 的核心指标、变化关系与结构说明，用于支撑图表与表格。`;
  plan.chartHint = `${m0.label} 与 ${m1.label} 的变化对比`;
  plan.tableData = {
    columns: ["指标", "现值", "前值", "变化"],
    rows: profile.metrics.slice(0, 3).map((metric) => [metric.label, metric.current, metric.previous, metric.change]),
  };
  return plan;
}

function casePlan(profile: TopicProfile, index: number): GeneratedOutlinePagePlan {
  const core = profile.subject || profile.domain.label;
  const object = profile.domain.objects[index % profile.domain.objects.length];
  const plan = planCommon(
    profile,
    "case-study",
    "mixed-media",
    `${object} 在 ${core} 场景中的落地过程：从试点到规模化复用的完整叙事链。`,
  );
  plan.title = `典型案例：${profile.domain.angles[index % profile.domain.angles.length]}`;
  plan.layoutIntent = "imageTextPair";
  plan.sourceNeeds = `${object} 的背景、关键动作与结果关系，用于支撑案例叙事。`;
  plan.visualCaption = `${core} 场景：${object} 的落地环境与协作画面`;
  return plan;
}

function featurePlan(profile: TopicProfile, index: number): GeneratedOutlinePagePlan {
  const core = profile.subject || profile.domain.label;
  const angle = profile.domain.angles[index % profile.domain.angles.length];
  const plan = planCommon(
    profile,
    "feature",
    "text",
    `${angle} 正在成为 ${core} 下一阶段的关键变量，重点在于拆解其背后的结构变化。`,
  );
  plan.title = `${angle}`;
  plan.layoutIntent = "hero+text";
  return plan;
}

function summaryPlan(profile: TopicProfile): GeneratedOutlinePagePlan {
  const core = profile.subject || profile.domain.label;
  const plan = planCommon(
    profile,
    "summary",
    "text",
    `${core} 的阶段性收束：最终判断、关键结论、可带走建议与边界提醒。`,
  );
  plan.title = `${core}总结`;
  plan.layoutIntent = "hero+text";
  return plan;
}

function generateOutlinePages(profile: TopicProfile, pageCount: number): GeneratedOutlinePagePlan[] {
  const count = Math.max(1, pageCount);
  const roles: GeneratedOutlinePageRole[] = [];
  if (count === 1) {
    roles.push("overview");
  } else if (count === 2) {
    roles.push("overview", "summary");
  } else {
    roles.push("overview");
    const middleCount = count - 2;
    for (let index = 0; index < middleCount; index += 1) {
      roles.push(MIDDLE_ROLE_SEQUENCE[index % MIDDLE_ROLE_SEQUENCE.length]);
    }
    roles.push("summary");
  }

  let caseIndex = 0;
  let featureIndex = 0;
  return roles.map((role) => {
    if (role === "overview") return overviewPlan(profile);
    if (role === "summary") return summaryPlan(profile);
    if (role === "data") return dataPlan(profile);
    if (role === "case-study") return casePlan(profile, caseIndex++);
    return featurePlan(profile, featureIndex++);
  });
}

/* ------------------------------------------------------------------ *
 * 5. 正文片段生成（per pageType）
 * ------------------------------------------------------------------ */

function fragments(roles: string[], texts: string[]): GeneratedTextDraftFragment[] {
  return roles.map((role, index) => ({ role, label: `正文片段 ${index + 1}`, text: texts[index] }));
}

/**
 * 正文句式变体数量。变体由 page.renderSeed 决定，
 * 不同变体表达不同，但指标数字完全一致（均来自主题种子）。
 */
export const DETERMINISTIC_VARIANT_COUNT = 3;

const OVERVIEW_ROLES = ["overviewHero", "overviewThemeChange", "overviewRelationshipJudgment", "overviewObservationFocus", "overviewNarrative", "overviewReaderValue"] as const;
const SUMMARY_ROLES = ["summaryFinalJudgment", "summaryNextSignals", "summaryUncertainty", "summaryClosingNote", "summaryReaderTakeaway"] as const;
const DATA_ROLES = ["dataSummary", "dataChartBrief", "dataChartExplanation", "dataTakeaway", "dataSourceNote"] as const;
const CASE_ROLES = ["caseSubject", "caseVisualBrief", "caseScenario", "caseChallenge", "caseAction", "caseResult", "caseTakeaway"] as const;
const FEATURE_ROLES = ["featureHero", "featureAngle", "featureDetail", "featureEvidence", "featureTakeaway"] as const;

function overviewFragments(profile: TopicProfile, variant: number): GeneratedTextDraftFragment[] {
  const { subject, yearLabel, domain } = profile;
  const [m0, m1, m2] = profile.metrics;
  const period = yearLabel || "本期";
  const angle = domain.angles[0] ?? "结构性变化";
  const texts = [
    [
      `${period}，${subject} 进入从单点突破转向规模落地的关键阶段，${m0.label} 的 ${m0.change} 与 ${m1.label} 的持续变化，共同构成本轮演进的主线。`,
      `与上一阶段相比，讨论重心从「能不能用」转向「落地能否规模化」，${angle} 成为新的观察变量。`,
      `${m0.label} 的上升与 ${m1.label} 的下降并非孤立现象，二者共同指向同一趋势：能力扩散正在转化为真实的使用强度。`,
      `判断本轮变化，不应只看单点数值，而要看 ${m0.label} 与 ${m1.label} 的联动方向是否一致，以及 ${m2.label} 是否同步给出佐证。`,
      `围绕 ${subject}，这份内容依次从数据、案例与边界三个角度展开，先建立判断，再验证落地，最后收束成可带走的结论。`,
      `最值得带走的不是某个单点结论，而是一套判断 ${subject} 是否进入持续验证期的观察框架。`,
    ],
    [
      `${period}，${subject} 走到了一个明显的拐点：${m0.label} 的 ${m0.change} 与 ${m1.label} 的变化，正在重新定义这个领域的节奏。`,
      `判断的锚点已经迁移，从「有没有能力」转向「能不能稳定交付价值」，${angle} 是其中最值得关注的一条线索。`,
      `${m0.label} 与 ${m1.label} 一升一降，共同说明资源正在从投入转向产出，能力扩散开始兑现为真实强度。`,
      `要判断这是短期热度还是长期趋势，关键看 ${m2.label} 是否给出独立佐证，而不是只盯着单一指标。`,
      `本期内容用「数据—案例—结论」三层结构展开，先给判断，再给证据，最后给出可带走的边界。`,
      `读完这期，读者真正要带走的是一套观察方法，而不是某个孤立结论。`,
    ],
    [
      `${period} 的 ${subject} 已进入新一轮周期的起点，${m0.label} 与 ${m1.label} 的联动，构成了判断这一阶段的核心坐标。`,
      `如果说上一阶段的主题是「验证」，这一阶段的主题就是「复利」——${angle} 正在加速这一转变。`,
      `${m0.label} 的改善与 ${m1.label} 的优化相互印证，说明这次变化不是单点波动，而是结构性的调整。`,
      `阅读本期的重点，是建立「两指标联动 + 一指标佐证」的观察框架，而不是追逐某个具体数字。`,
      `本期的阅读路径是：先建立全局判断，再进入数据与案例验证，最后以可执行的观察清单收束。`,
      `最实用的收获，是一份可用于下阶段跟踪的观察清单，而非对单次变化的过度解读。`,
    ],
  ];
  return fragments([...OVERVIEW_ROLES], texts[variant % DETERMINISTIC_VARIANT_COUNT]);
}

function summaryFragments(profile: TopicProfile, variant: number): GeneratedTextDraftFragment[] {
  const { subject, domain } = profile;
  const [m0, m1, m2] = profile.metrics;
  const risk = domain.risks[0] ?? "不确定性";
  const texts = [
    [
      `综合来看，${subject} 已从单点突破进入结构性验证阶段，${m0.label} 的 ${m0.change} 是其中相对明确的信号。`,
      `后续更值得跟踪的，不是更多的新发布，而是 ${m1.label} 与 ${m2.label} 的联动能否持续。`,
      `当前判断的边界在于，样本仍集中在头部场景，${risk} 的问题尚未被规模化解。`,
      `${subject} 的价值，最终取决于能否从阶段性的热度，沉淀为可复用的效率。`,
      `建议把 ${m0.label} 与 ${m1.label} 作为下阶段的观察锚点，而非追逐单一热点事件。`,
    ],
    [
      `结论先行：${subject} 的验证期已经开启，${m0.label} 的 ${m0.change} 是这条判断最直接的证据。`,
      `接下来的观察重点，应从「有什么新东西」切换到「指标是否形成联动」，尤其看 ${m1.label} 与 ${m2.label}。`,
      `需要保持克制的地方在于，现有样本偏向头部，${risk} 尚未在长尾场景被充分验证。`,
      `衡量 ${subject} 的长期价值，标准只有一个：热度能否沉淀为效率，效率能否复制。`,
      `给读者的行动建议：把 ${m0.label}、${m1.label} 列入季度观察清单，用数据而非情绪做判断。`,
    ],
    [
      `一言以蔽之：${subject} 已跨过「能不能做」的门槛，进入「能不能规模化」的新阶段，${m0.label} 的 ${m0.change} 是核心佐证。`,
      `后续真正的信号，藏在 ${m1.label} 与 ${m2.label} 的交叉变化里，而非单一指标的涨跌。`,
      `本判断的主要风险是样本偏差：结论大多来自头部场景，${risk} 的问题在长尾仍未解。`,
      `${subject} 最终能走多远，不取决于当下的热度，而取决于能否把阶段性成果沉淀为可复制的能力。`,
      `带走三点：跟踪 ${m0.label} 与 ${m1.label}，警惕 ${risk}，用季度节奏而非周度噪音做判断。`,
    ],
  ];
  return fragments([...SUMMARY_ROLES], texts[variant % DETERMINISTIC_VARIANT_COUNT]);
}

function dataFragments(profile: TopicProfile, variant: number): GeneratedTextDraftFragment[] {
  const { subject, yearLabel } = profile;
  const [m0, m1, m2] = profile.metrics;
  const period = yearLabel || "本期";
  const texts = [
    [
      `${subject} 的量化信号集中在三组指标：${m0.label}、${m1.label} 与 ${m2.label}，它们的联动关系是理解走势的关键。`,
      `${m0.label} 与 ${m1.label} 的变化对比`,
      `${period}，${m0.label} 由 ${m0.previous} 变化至 ${m0.current}，${m1.label} ${m1.change}，其中 ${m0.label} 的方向更值得关注。`,
      `读图的关键，是看 ${m0.label} 与 ${m1.label} 的方向是否背离：方向一致说明趋势得到确认，背离则需回到结构找原因。`,
      `以上指标为基于主题的结构化推演，用于说明趋势关系，不构成实时引用数据。`,
    ],
    [
      `用三个数字来读懂 ${subject}：${m0.label}、${m1.label} 与 ${m2.label}，它们共同描摹出这一阶段的走向。`,
      `核心指标对比`,
      `${period} 的核心变化是：${m0.label} 从 ${m0.previous} 走到 ${m0.current}，而 ${m1.label} 同步 ${m1.change}，两个方向相互印证。`,
      `这套图表的读法：先看方向是否一致，再看 ${m2.label} 是否跟随，最后才是绝对值的高低。`,
      `说明：本页指标为结构化推演示例，重点展示趋势关系，非实时引用。`,
    ],
    [
      `这一页把 ${subject} 的关键信号浓缩为三个指标：${m0.label}、${m1.label} 和 ${m2.label}。`,
      `指标走势一览`,
      `${period} 值得记住的变化：${m0.label} ${m0.change} 至 ${m0.current}，${m1.label} 变化 ${m1.change}，后者为前者提供了交叉验证。`,
      `判断这组数据，建议用「方向 + 联动」两步法：先确认趋势方向，再核对 ${m2.label} 是否同步响应。`,
      `数据口径：由主题哈希确定性推演而来，用于结构化叙事，不构成实时数据引用。`,
    ],
  ];
  return fragments([...DATA_ROLES], texts[variant % DETERMINISTIC_VARIANT_COUNT]);
}

function caseFragments(profile: TopicProfile, page: Page, variant: number): GeneratedTextDraftFragment[] {
  const { subject, yearLabel, domain } = profile;
  const [m0, m1] = profile.metrics;
  const period = yearLabel || "本期";
  const object = domain.objects[hashString(page.id) % domain.objects.length];
  const risk = domain.risks[0] ?? "路径适配";
  const texts = [
    [
      `一个典型的落地样本：${object} 在 ${period} 完成从试点到规模化复用的转变。`,
      `${subject} 场景：${object} 的落地环境与协作画面`,
      `${object} 最初面临的问题很典型：能力本身具备，但只能覆盖少数场景，难以证明可复制的价值。`,
      `真正的难点不在技术本身，而在于 ${risk} 与组织流程的适配——能力有了，路径没有。`,
      `团队的做法是先把 ${m0.label} 作为唯一的北极星指标，再围绕它重构评估、数据与反馈闭环。`,
      `经过一个周期，${m0.label} 提升 ${m0.change}，且从单点场景扩展到多个可复用环节，${m1.label} 也同步改善。`,
      `这个案例说明：${subject} 的落地胜负手不在参数本身，而在是否围绕一个核心指标建立了可验证的闭环。`,
    ],
    [
      `${object} 的实践，是 ${subject} 落地的一个缩影：从单点验证到规模化复用，只用了一个周期。`,
      `${subject} 现场：${object} 的真实工作场景`,
      `${object} 的起点并不特殊：能力已经在手，却只在小范围内有效，价值难以向外复制。`,
      `瓶颈出现在流程而非技术——${risk} 的适配问题，让「能力」迟迟无法转化为「产出」。`,
      `破局的关键动作，是把 ${m0.label} 设为唯一目标，让所有评估与迭代都围绕这一个指标对齐。`,
      `一个周期后，${m0.label} 提升 ${m0.change}，使用场景也从单点拓展到多个可复用环节，${m1.label} 随之改善。`,
      `启示很明确：${subject} 的胜负，往往不在模型能力，而在是否围绕一个指标建成了可验证的闭环。`,
    ],
    [
      `用 ${object} 的例子，看清 ${subject} 落地的真实路径：试点、对齐、复用，三步走完一个周期。`,
      `案例配图：${object} 的落地环境`,
      `问题很常见：${object} 手握能力，却困在少数场景里，难以证明这件事值得规模化投入。`,
      `真正的阻力来自 ${risk} 与既有流程的错位，技术和组织之间缺少一条对齐的路径。`,
      `他们只做对了一件事：把 ${m0.label} 当成北极星，让数据、评估、反馈全部指向同一个目标。`,
      `结果是一个周期内 ${m0.label} 提升 ${m0.change}，场景从单点扩展到多个，${m1.label} 也同步改善。`,
      `这个案例给 ${subject} 的结论是：闭环比参数更重要，指标对齐比工具升级更关键。`,
    ],
  ];
  return fragments([...CASE_ROLES], texts[variant % DETERMINISTIC_VARIANT_COUNT]);
}

function featureFragments(profile: TopicProfile, page: Page, variant: number): GeneratedTextDraftFragment[] {
  const { subject, domain } = profile;
  const [m0, m1, m2] = profile.metrics;
  const angleIndex = hashString(page.id) % domain.angles.length;
  const angle = domain.angles[angleIndex];
  const texts = [
    [
      `${angle} 正在成为 ${subject} 下一阶段的关键变量。`,
      `与直觉相反，${angle} 的变化更多来自结构重组，而非单纯的资源投入增加。`,
      `具体来看，${m0.label} 与 ${m1.label} 的联动表明，效率改善开始反哺规模扩张，形成正向循环。`,
      `可以从两个侧面交叉验证：一是头部场景的渗透率，二是中小参与者的进入速度，二者共同给出 ${m2.label} 的信号。`,
      `对读者而言，${angle} 的启示是：与其追逐热点，不如跟踪结构性指标的变化节奏。`,
    ],
    [
      `${angle}，可能是 ${subject} 接下来最被低估的一条主线。`,
      `表面看是资源驱动，实则是结构在重组——${angle} 的变化更多来自效率端的改善。`,
      `${m0.label} 与 ${m1.label} 的同步变化说明，效率改善正在反哺规模，形成可复制的正向循环。`,
      `验证这条线索有两个维度：头部场景的渗透速度，以及 ${m2.label} 给出的独立信号。`,
      `读者应该做的，是把 ${angle} 拆成可跟踪的指标，而不是把它当成一句口号。`,
    ],
    [
      `如果只挑一条线索跟踪 ${subject}，答案很可能是 ${angle}。`,
      `它的变化不来自更多投入，而来自结构效率的提升，这是它与以往周期的最大区别。`,
      `${m0.label} 与 ${m1.label} 的联动，正是这种结构性改善的外在表现，且已开始反哺规模。`,
      `交叉验证看两点：头部是否在加速，以及 ${m2.label} 是否独立给出正向信号。`,
      `落地建议：把 ${angle} 对应到 ${m0.label} 这类可量化指标上，按季度跟踪，避免被噪音带偏。`,
    ],
  ];
  return fragments([...FEATURE_ROLES], texts[variant % DETERMINISTIC_VARIANT_COUNT]);
}

/* ------------------------------------------------------------------ *
 * 6. Provider 实现
 * ------------------------------------------------------------------ */

export const DETERMINISTIC_MODEL = "deterministic-v1";

export class DeterministicGenerationProvider implements GenerationProvider {
  readonly config: GenerationProviderConfig = {
    providerType: "deterministic",
    model: DETERMINISTIC_MODEL,
    endpoint: "",
    source: "workspace-default",
    options: { temperature: 0, topP: 1, numPredict: 1200 },
    truthfulnessPolicy: {
      requireGroundedOutput: true,
      allowUngroundedSpecificFacts: false,
      forbiddenSpecificFactKinds: ["company", "model", "money", "percentage", "ranking", "date", "metric"],
    },
  };

  async generateOutlinePlan(input: NormalizedTaskInput, _context: ProviderContext): Promise<GeneratedOutlinePlanResult> {
    const subject = stripSubject(input.prompt, detectDomain(input.prompt));
    const profile = resolveProfile(subject);
    const pageCount = input.desiredPageCount ?? 6;
    const pages = generateOutlinePages(profile, pageCount);
    return {
      providerType: "deterministic",
      model: DETERMINISTIC_MODEL,
      sourceId: `deterministic:${DETERMINISTIC_MODEL}`,
      prompt: `确定性大纲生成：${subject}`,
      pages,
    };
  }

  async generateOverviewDraft(request: OverviewGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.buildDraft(request.page, overviewFragments(resolveProfile(extractSubjectFromPage(request.page)), request.page.renderSeed));
  }

  async generateSummaryDraft(request: SummaryGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.buildDraft(request.page, summaryFragments(resolveProfile(extractSubjectFromPage(request.page)), request.page.renderSeed));
  }

  async generateDataDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.buildDraft(request.page, dataFragments(resolveProfile(extractSubjectFromPage(request.page)), request.page.renderSeed));
  }

  async generateCaseDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.buildDraft(request.page, caseFragments(resolveProfile(extractSubjectFromPage(request.page)), request.page, request.page.renderSeed));
  }

  async generateFeatureDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.buildDraft(request.page, featureFragments(resolveProfile(extractSubjectFromPage(request.page)), request.page, request.page.renderSeed));
  }

  private buildDraft(page: Page, resultFragments: GeneratedTextDraftFragment[]): GeneratedTextDraftResult {
    return {
      providerType: "deterministic",
      model: DETERMINISTIC_MODEL,
      sourceId: `deterministic:${DETERMINISTIC_MODEL}`,
      prompt: `确定性正文生成：${extractSubjectFromPage(page)}（变体 ${page.renderSeed ?? 0}）`,
      fragments: resultFragments,
    };
  }
}
