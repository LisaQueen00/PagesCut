import { getPageDisplayLabel } from "@/lib/pageDisplay";
import { getChartBriefSourceById, getImageSourceAssetById, getTextSourceFragmentById } from "@/lib/pageSources";
import type { FinalCompositionPage, GeneratedCoverContent, GeneratedTocContent, Page, Task } from "@/types/domain";
import type {
  ChartBriefSource,
  GeneratedCaseContractInput,
  GeneratedOverviewContractInput,
  GeneratedSummaryContractInput,
  ImageSourceAsset,
  ManualDataContractInput,
  PageContentPlan,
  PageContentSlotBinding,
  PageIntent,
  PageSourceSet,
  TextSourceFragment,
} from "@/types/pageModel";

function clampText(value: string, limit: number, fallback = "") {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit).trim()}...`;
}

function splitSentences(value: string) {
  return value
    .split(/[。！？!?\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pickFirstMeaningful(value: string, fallback: string) {
  return splitSentences(value)[0] || fallback;
}

function getNarrativeTopic(page: Page) {
  const topic = (page.outlineText || page.pageType)
    .replace(/^(围绕|关于|总结|建立|生成|制作|收束|提炼)\s*/, "")
    .replace(/\s*(建立总览页|做最终收束|沉淀可带走判断|给出后续内容页|先收束主题判断|先建立总体判断|再进入细节页面|再给出后续内容页|下一步建议|边界提醒|提炼一页|选择一个真实业务场景)[\s\S]*$/, "")
    .replace(/[。！？!?\n].*$/, "")
    .replace(/(月刊|周报|日报|报告|PPT|幻灯片|作品)$/i, "")
    .trim();

  return topic || page.pageType;
}

function withSentenceEnd(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return /[。！？!?]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function isInternalOrMetaText(value: string) {
  const normalized = value.toLowerCase();
  const markers = [
    "本页",
    "这页",
    "这一页",
    "这里的正文",
    "这里",
    "本页判断",
    "阅读路径",
    "承担",
    "承接",
    "边界",
    "更适合的处理方式",
    "不应只是",
    "重点不是",
    "应该",
    "如何组织",
    "页面策略",
    "编辑策略",
    "pageintent",
    "pagecontentplan",
    "renderer",
    "contract",
    "assembly",
    "text unit",
    "text slot",
    "slot",
    "requested",
    "resolved",
    "filled",
    "unfilled",
    "fill rule",
    "source",
    "debug",
    "mock",
    "overview 应该",
    "summary 应该",
    "像刊首",
    "像刊末",
    "建立总览页",
    "先收束主题判断",
    "先建立总体判断",
    "进入细节页面",
    "后续内容页",
    "这一限制下",
    "职责",
  ];

  return markers.some((marker) => normalized.includes(marker));
}

function normalizeReaderFacingText(value: string, fallback = "") {
  const readerSentences = splitSentences(value).filter((sentence) => !isInternalOrMetaText(sentence));
  if (readerSentences.length) {
    return readerSentences.map(withSentenceEnd).join("");
  }

  return fallback && !isInternalOrMetaText(fallback) ? fallback : "";
}

function uniqueTextItems(items: string[], fallbackItems: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];

  [...items, ...fallbackItems].forEach((item) => {
    const normalized = item.replace(/\s+/g, "");
    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    unique.push(item);
  });

  return unique;
}

function ensureItems<T>(items: T[], fallbackItems: T[], minimum: number) {
  const next = items.slice();
  let cursor = 0;

  while (next.length < minimum && fallbackItems.length > 0) {
    next.push(fallbackItems[cursor % fallbackItems.length]);
    cursor += 1;
  }

  return next;
}

function normalizePromptTopic(prompt: string, fallback: string) {
  const normalized = prompt
    .replace(/^(请|帮我|我想|希望|准备|需要)/, "")
    .replace(/^(生成|做|制作|产出)/, "")
    .replace(/^(一期|一份|一个)/, "")
    .replace(/^(关于|围绕)/, "")
    .trim();

  return clampText(normalized || fallback, 22, fallback);
}

function parseIssueLabel(prompt: string) {
  const match = prompt.match(/(\d{1,2})\s*月/);
  const month = match ? Number.parseInt(match[1], 10) : new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  return `${year} / ${String(month).padStart(2, "0")}`;
}

function getReaderFacingTextValues(
  page: Page,
  pageSourceSet: PageSourceSet | null | undefined,
  preferredSyntheticOrder: Array<NonNullable<TextSourceFragment["sourceField"]>>,
  fallbackItems: string[],
) {
  const sourceTexts = pageSourceSet
    ? [
        ...preferredSyntheticOrder.flatMap((field) =>
          pageSourceSet.textFragments.filter((item) => item.origin === "synthetic" && item.sourceField === field),
        ),
        ...pageSourceSet.textFragments.filter((item) => item.origin === "user-block"),
      ]
        .map((item) => normalizeReaderFacingText(item.text))
        .filter(Boolean)
    : [];

  if (sourceTexts.length) {
    return sourceTexts;
  }

  const rawTextBlocks = page.userProvidedContentBlocks
    .filter((block): block is Extract<Page["userProvidedContentBlocks"][number], { type: "text" }> => block.type === "text")
    .map((block) => normalizeReaderFacingText(block.text))
    .filter(Boolean);
  if (rawTextBlocks.length) {
    return rawTextBlocks;
  }

  return fallbackItems.map((item) => normalizeReaderFacingText(item, item)).filter(Boolean);
}

function getReaderFacingTextByRole(pageSourceSet: PageSourceSet | null | undefined, role: string) {
  const fragment = pageSourceSet?.textFragments.find((item) => item.origin === "synthetic" && item.sourceRole === role);
  return fragment ? normalizeReaderFacingText(fragment.text) : "";
}

function buildOverviewBaseTexts(page: Page, pageSourceSet?: PageSourceSet | null) {
  const topic = clampText(getNarrativeTopic(page), 30, page.pageType);
  const combined = getReaderFacingTextValues(page, pageSourceSet, ["overviewOllamaDraft", "overviewGeneratedDraft"], [
    `围绕“${topic}”，人工智能相关变化正在从单点事件转向连续演进，模型能力、产品落地与组织采用相互牵引。`,
    "读者最需要关注的是哪些变化已经形成连续信号，哪些仍停留在概念热度和短期讨论中。",
    "输入信息仍有限时，综述段落保持概括判断，避免把未核验细节写成确定事实。",
  ]);

  return {
    primary:
      getReaderFacingTextByRole(pageSourceSet, "overviewHero") ||
      combined[0] ||
      `围绕“${topic}”，人工智能相关变化正在从单点事件转向连续演进。`,
    secondary:
      getReaderFacingTextByRole(pageSourceSet, "overviewThemeChange") ||
      combined[1] ||
      "模型能力、产品落地与组织采用相互牵引，读者需要识别哪些变化正在形成连续信号。",
    tertiary:
      getReaderFacingTextByRole(pageSourceSet, "overviewObservationFocus") ||
      combined[2] ||
      "输入信息仍有限时，综述段落保持概括判断，避免把未核验细节写成确定事实。",
    relationship:
      getReaderFacingTextByRole(pageSourceSet, "overviewRelationshipJudgment") ||
      combined[1] ||
      "变化之间的关系比单点热点更值得关注。",
    narrative:
      getReaderFacingTextByRole(pageSourceSet, "overviewNarrative") ||
      combined[3] ||
      "能力、产品和组织节奏之间的相互牵引，决定了后续内容需要继续验证哪些信号。",
    readerValue:
      getReaderFacingTextByRole(pageSourceSet, "overviewReaderValue") ||
      combined[4] ||
      "读者更需要识别真实采用信号，而不是被未经核验的具体细节牵引。",
    all: combined,
  };
}

function buildSummaryBaseTexts(page: Page, pageSourceSet?: PageSourceSet | null) {
  const topic = clampText(getNarrativeTopic(page), 30, page.pageType);
  const combined = getReaderFacingTextValues(page, pageSourceSet, ["summaryOllamaDraft", "summaryGeneratedDraft"], [
    `围绕“${topic}”，整期内容可以收束为少量可带走的判断。`,
    "接下来更适合继续观察关键变化和支撑信号，而不是把尚未证明的内容写成定论。",
    "人工智能趋势仍处在快速扩散和持续验证之间，清楚但克制的判断比强结论更可靠。",
  ]);

  return {
    primary:
      getReaderFacingTextByRole(pageSourceSet, "summaryFinalJudgment") ||
      combined[0] ||
      `围绕“${topic}”，整期内容可以收束为少量可带走的判断。`,
    secondary:
      getReaderFacingTextByRole(pageSourceSet, "summaryNextSignals") ||
      combined[1] ||
      "接下来更适合继续观察关键变化和支撑信号，而不是给出过强结论。",
    tertiary:
      getReaderFacingTextByRole(pageSourceSet, "summaryUncertainty") ||
      combined[2] ||
      "人工智能趋势仍处在快速扩散和持续验证之间，清楚但克制的判断比强结论更可靠。",
    closing:
      getReaderFacingTextByRole(pageSourceSet, "summaryClosingNote") ||
      combined[3] ||
      "后续判断需要继续等待真实采用和支撑信号，而不是提前变成强结论。",
    readerTakeaway:
      getReaderFacingTextByRole(pageSourceSet, "summaryReaderTakeaway") ||
      combined[4] ||
      "更稳妥的带走信息，是把注意力放在持续变化和可验证信号上。",
    all: combined,
  };
}

export function generateOverviewContractInput(
  page: Page,
  versionLabel: string,
  pageIntent: PageIntent,
  contentPlan: PageContentPlan | null,
  pageSourceSet?: PageSourceSet | null,
): GeneratedOverviewContractInput {
  const baseTexts = buildOverviewBaseTexts(page, pageSourceSet);
  const topic = clampText(getNarrativeTopic(page), 30, page.pageType);
  const tone = page.styleText.trim() || "结构清晰、克制专业";
  const constraint = page.userConstraints.trim() || "保持主题判断优先级。";
  const overviewTexts = uniqueTextItems(baseTexts.all, [
    baseTexts.primary,
    baseTexts.secondary,
    baseTexts.relationship,
    baseTexts.tertiary,
    baseTexts.narrative,
    baseTexts.readerValue,
    "最值得关注的是模型能力、产品落地和业务采用之间的相互牵引。",
    "数据和案例会决定这些变化是短期热度，还是已经进入持续验证。",
    "输入信息有限时，概括判断优先于具体公司、金额和指标断言。",
  ]);
  const heroSummary = overviewTexts[0] ?? baseTexts.primary;
  const calloutText = baseTexts.secondary;
  const signalTexts = [baseTexts.relationship, baseTexts.tertiary];
  const supportPoints = [baseTexts.narrative].filter(Boolean);
  const asideText = baseTexts.readerValue;
  const textUnit = contentPlan?.units.find((unit) => unit.unitType === "text");
  const textAssembly = textUnit?.assembly;
  const textUnits = Array.from({ length: textUnit?.resolvedCount ?? 0 }, (_, index) => {
    const binding = textAssembly?.resolvedUnits?.[index];
    const textSource = getTextFragmentByBinding(pageSourceSet, binding?.slots ?? []);
    return {
      label: textSource?.label || `判断文本单元 ${index + 1}`,
      outcome: binding?.outcome,
      textSlotLabel: `text slot ${index + 1}`,
      slotBindings: binding?.slots ?? [],
    };
  });

  const highlights = [
    clampText(pickFirstMeaningful(asideText, topic), 34, topic),
    clampText(pickFirstMeaningful(calloutText, tone), 34, tone),
    clampText(pickFirstMeaningful(signalTexts[2] ?? baseTexts.tertiary, constraint), 34, constraint),
  ];

  const signalItems = [
    {
      heading: "关系判断",
      detail: signalTexts[0] ?? baseTexts.primary,
    },
    {
      heading: "观察重点",
      detail: signalTexts[1] ?? baseTexts.secondary,
    },
  ];

  const viewpointCards = [
    baseTexts.readerValue,
    overviewTexts.find((item) => item !== heroSummary && item !== calloutText && item !== baseTexts.relationship && item !== baseTexts.tertiary) ??
      "数据和案例会决定这些变化是短期热度，还是已经进入持续验证。",
  ];

  return {
    sourceKind: "generated",
    pageType: "overview",
    pageId: page.id,
    versionLabel,
    title: page.pageType,
    outline: heroSummary,
    tone,
    openingNote: calloutText,
    highlights,
    signalItems,
    signalMetrics: [
      {
        id: "overview-metric-1",
        label: "主题信号",
        value: "连续演进",
        detail: clampText(pickFirstMeaningful(asideText, topic), 42, topic),
      },
      {
        id: "overview-metric-2",
        label: "关系判断",
        value: pageIntent.textDensity === "high" ? "展开观察" : "克制概括",
        detail: clampText(pickFirstMeaningful(baseTexts.secondary, tone), 42, tone),
      },
      {
        id: "overview-metric-3",
        label: "读者价值",
        value: "识别重点",
        detail: "把注意力放在真实采用信号，而不是未核验细节。",
      },
    ],
    viewpointCards,
    supportPoints,
    textUnits,
    textUnitStatus: {
      requestedCount: textUnit?.requestedCount ?? 0,
      resolvedCount: textUnit?.resolvedCount ?? 0,
      filledCount: textUnit?.filledCount ?? 0,
      partialCount: textAssembly?.partialCount ?? 0,
      unfilledCount: textAssembly?.unfilledCount ?? 0,
      fillRule: textAssembly?.fillRule ?? textUnit?.fillRule ?? "all-required-slots",
    },
  };
}

export function generateSummaryContractInput(
  page: Page,
  versionLabel: string,
  pageIntent: PageIntent,
  contentPlan: PageContentPlan | null,
  pageSourceSet?: PageSourceSet | null,
): GeneratedSummaryContractInput {
  const baseTexts = buildSummaryBaseTexts(page, pageSourceSet);
  const topic = clampText(getNarrativeTopic(page), 30, page.pageType);
  const boundary = page.userConstraints.trim() || "主题结论保持克制。";
  const tone = page.styleText.trim() || "克制、收束、可带走";
  const finalJudgment = baseTexts.primary;
  const calloutJudgment = baseTexts.secondary;
  const conclusionTexts = [baseTexts.tertiary];
  const recommendationItems = [baseTexts.readerTakeaway].filter((item) => item && item !== calloutJudgment);
  const cautionItems = [baseTexts.tertiary].filter(Boolean);
  const closingNote = baseTexts.closing;
  const textUnit = contentPlan?.units.find((unit) => unit.unitType === "text");
  const textAssembly = textUnit?.assembly;
  const textUnits = Array.from({ length: textUnit?.resolvedCount ?? 0 }, (_, index) => {
    const binding = textAssembly?.resolvedUnits?.[index];
    const textSource = getTextFragmentByBinding(pageSourceSet, binding?.slots ?? []);
    return {
      label: textSource?.label || `收束文本单元 ${index + 1}`,
      outcome: binding?.outcome,
      textSlotLabel: `text slot ${index + 1}`,
      slotBindings: binding?.slots ?? [],
    };
  });

  const conclusionPoints = [
    {
      heading: "判断余地",
      detail: conclusionTexts[0] ?? baseTexts.tertiary,
    },
  ];

  const recommendations = recommendationItems;
  const cautions = cautionItems;

  return {
    sourceKind: "generated",
    pageType: "summary",
    pageId: page.id,
    versionLabel,
    title: page.pageType,
    finalJudgment,
    openingNote: calloutJudgment,
    conclusionPoints,
    recommendations,
    cautions,
    closingNote,
    evidenceMetrics: [
      {
        id: "summary-metric-1",
        label: "收束重点",
        value: "最终判断",
        detail: clampText(pickFirstMeaningful(baseTexts.primary, topic), 42, topic),
      },
      {
        id: "summary-metric-2",
        label: "观察重点",
        value: pageIntent.textDensity === "high" ? "克制展开" : "继续观察",
        detail: clampText(pickFirstMeaningful(baseTexts.tertiary, tone), 42, tone),
      },
      {
        id: "summary-metric-3",
        label: "判断余地",
        value: "保持克制",
        detail: clampText(pickFirstMeaningful(baseTexts.secondary, boundary), 42, boundary),
      },
    ],
    textUnits,
    textUnitStatus: {
      requestedCount: textUnit?.requestedCount ?? 0,
      resolvedCount: textUnit?.resolvedCount ?? 0,
      filledCount: textUnit?.filledCount ?? 0,
      partialCount: textAssembly?.partialCount ?? 0,
      unfilledCount: textAssembly?.unfilledCount ?? 0,
      fillRule: textAssembly?.fillRule ?? textUnit?.fillRule ?? "all-required-slots",
    },
  };
}

function getSlotBindingLabel(bindings: PageContentSlotBinding[], slotType: PageContentSlotBinding["slotType"]) {
  return bindings.find((binding) => binding.slotType === slotType)?.source?.label ?? "";
}

function getTextFragmentByBinding(pageSourceSet: PageSourceSet | null | undefined, bindings: PageContentSlotBinding[]) {
  const sourceId = bindings.find((binding) => binding.slotType === "text" || binding.slotType === "explanation")?.source?.sourceId;
  return getTextSourceFragmentById(pageSourceSet, sourceId);
}

function getTextBlockValueById(page: Page, sourceId: string | undefined) {
  if (!sourceId) {
    return "";
  }

  const block = page.userProvidedContentBlocks.find((item) => item.id === sourceId);
  return block?.type === "text" ? block.text.trim() : "";
}

function getChartBriefByBinding(pageSourceSet: PageSourceSet | null | undefined, bindings: PageContentSlotBinding[]) {
  const sourceId = bindings.find((binding) => binding.slotType === "chart")?.source?.sourceId;
  return getChartBriefSourceById(pageSourceSet, sourceId);
}

function getImageAssetByBinding(pageSourceSet: PageSourceSet | null | undefined, bindings: PageContentSlotBinding[]) {
  const sourceId = bindings.find((binding) => binding.slotType === "image")?.source?.sourceId;
  return getImageSourceAssetById(pageSourceSet, sourceId);
}

function getTableBlock(page: Page) {
  const block = page.userProvidedContentBlocks.find((item) => item.type === "table");
  return block?.type === "table" ? block : undefined;
}

function deriveTableData(page: Page) {
  const tableBlock = getTableBlock(page);
  const columns = (tableBlock?.columns?.length ? tableBlock.columns : ["指标", "本月", "变化"]).slice(0, 4);
  const rows = (tableBlock?.rows?.length ? tableBlock.rows : [["核心指标", "待补充", "观察中"]]).slice(0, 4);
  return {
    columns,
    rows,
  };
}

function deriveChartSeriesFromDerivedTable(page: Page) {
  const table = deriveTableData(page);
  return table.rows.slice(0, 4).map((row, index) => {
    const rawValue = row.find((cell, cellIndex) => cellIndex > 0 && /\d/.test(cell)) ?? String((index + 2) * 18);
    const numeric = Number.parseFloat(rawValue.replace(/[^\d.-]/g, "")) || (index + 2) * 18;
    return {
      id: `data-series-${index + 1}`,
      label: row[0] || `项 ${index + 1}`,
      value: numeric,
    };
  });
}

function deriveMetricsFromDerivedTable(page: Page, count: number) {
  const table = deriveTableData(page);
  return table.rows.slice(0, Math.max(1, count)).map((row, index) => ({
    id: `data-metric-${index + 1}`,
    label: row[0] || `指标 ${index + 1}`,
    value: row[1] || row[0] || "待补充",
    detail: row.slice(2).filter(Boolean).join(" / ") || "来自当前数据支撑页输入",
  }));
}

export function generateDataContractInput(
  page: Page,
  versionLabel: string,
  pageIntent: PageIntent,
  contentPlan: PageContentPlan | null,
  pageSourceSet?: PageSourceSet | null,
): ManualDataContractInput {
  const chartPairUnit = contentPlan?.units.find((unit) => unit.unitType === "chartExplanationPair");
  const metricsUnit = contentPlan?.units.find((unit) => unit.unitType === "metric");
  const tableUnit = contentPlan?.units.find((unit) => unit.unitType === "table");
  const chartPairAssembly = chartPairUnit?.assembly;
  const resolvedPairCount = chartPairUnit?.resolvedCount ?? Math.max(1, pageIntent.preferredChartCount || 1);
  const metricCount = metricsUnit?.resolvedCount ?? 3;
  const shouldKeepTable = (tableUnit?.requestedCount ?? 1) > 0;
  const derivedTable = deriveTableData(page);
  const derivedMetrics = deriveMetricsFromDerivedTable(page, metricCount);
  const derivedSeries = deriveChartSeriesFromDerivedTable(page);
  const chartExplanationPairs = Array.from({ length: resolvedPairCount }, (_, index) => {
    const binding = chartPairAssembly?.resolvedUnits?.[index];
    return {
      label: `图表说明单元 ${index + 1}`,
      outcome: binding?.outcome,
      chartSlotLabel: `chart slot ${index + 1}`,
      explanationSlotLabel: `explanation slot ${index + 1}`,
      slotBindings: binding?.slots ?? [],
    };
  });

  const chartBriefs = chartExplanationPairs.map((pair) => getChartBriefByBinding(pageSourceSet, pair.slotBindings)).filter(Boolean) as ChartBriefSource[];
  const explanationValues = chartExplanationPairs.map((pair) => {
    const sourceId = pair.slotBindings.find((binding) => binding.slotType === "explanation")?.source?.sourceId;
    return getTextBlockValueById(page, sourceId);
  }).filter(Boolean);

  const chartTitle =
    chartBriefs[0]?.description.trim() ||
    "核心指标变化";
  const chartSummary =
    explanationValues[0] ||
    "当前图表说明仍由规则生成补位，说明 chart 已成立但 explanation source formalization 还未完全深化。";
  const sourceLines = [
    `图表配对状态：requested ${chartPairUnit?.requestedCount ?? resolvedPairCount} / resolved ${chartPairUnit?.resolvedCount ?? resolvedPairCount} / filled ${chartPairUnit?.filledCount ?? 0}。`,
    chartPairAssembly?.partialCount
      ? "当前存在 partial chartExplanationPair，说明图表与说明文本的 source binding 已经开始暴露现实边界。"
      : "当前 chartExplanationPair 在本页已完成承接，图表与说明文本绑定关系成立。",
    shouldKeepTable
      ? "表格继续作为图表之外的结构化数据补充，而不是独立的旁路内容。"
      : "当前表格区允许降级，页面仍以图表支撑为主。",
  ];

  const dataTakeaways = [
    `图表说明单元当前承接 ${resolvedPairCount} 组，页面必须把 chart 与 explanation 的关系显式暴露出来。`,
    explanationValues[0]
      ? `首组说明文本已来自正式 source binding：${clampText(explanationValues[0], 40, "说明文本已绑定")}`
      : "当前 explanation source 不足时，页面虽能继续成立，但会显式暴露 source formalization 的缺口。",
    pageIntent.allowDegrade
      ? "当前 data 页允许在供给不足时降级承接，但不会把缺失解释偷偷抹平。"
      : "当前 data 页不允许随意降级，因此 unresolved / partial 状态必须被看见。",
    "metrics、chart、table、source note 现在都围绕同一条 data contract 组织，而不是各自独立拼装。",
  ];

  return {
    sourceKind: "manual",
    pageType: "data",
    pageId: page.id,
    versionLabel,
    title: page.pageType,
    summary: `${pickFirstMeaningful(page.outlineText, page.pageType)}，本页当前按数据支撑页而不是综述页来组织图表、说明与表格。`,
    metrics: derivedMetrics,
    chartTitle,
    chartSeries: derivedSeries.slice(0, Math.max(1, resolvedPairCount + 2)),
    chartSummary,
    chartExplanationPairs,
    chartExplanationPairStatus: {
      requestedCount: chartPairUnit?.requestedCount ?? resolvedPairCount,
      resolvedCount: chartPairUnit?.resolvedCount ?? resolvedPairCount,
      filledCount: chartPairUnit?.filledCount ?? 0,
      partialCount: chartPairAssembly?.partialCount ?? 0,
      unfilledCount: chartPairAssembly?.unfilledCount ?? 0,
      fillRule: chartPairAssembly?.fillRule ?? chartPairUnit?.fillRule ?? "all-required-slots",
    },
    tableTitle: shouldKeepTable ? "结构化数据表" : "摘要数据表",
    table: shouldKeepTable
      ? derivedTable
      : {
          columns: derivedTable.columns.slice(0, 2),
          rows: derivedTable.rows.slice(0, 3).map((row) => row.slice(0, 2)),
        },
    sourceNote: `当前 chart source 来自 ${chartBriefs.length} 个 ChartBriefSource，explanation source 来自 ${explanationValues.length} 个文本块。`,
    sourceLines,
    dataTakeaways,
    notes: chartExplanationPairs.map((pair, index) => {
      const chartLabel = getSlotBindingLabel(pair.slotBindings, "chart") || `chart slot ${index + 1}`;
      const explanationLabel = getSlotBindingLabel(pair.slotBindings, "explanation") || `explanation slot ${index + 1}`;
      return `${pair.label}：${chartLabel} -> ${explanationLabel}（${pair.outcome ?? "unfilled"}）`;
    }),
  };
}

function buildCaseBaseTexts(page: Page) {
  const textBlocks = page.userProvidedContentBlocks
    .filter((block): block is Extract<Page["userProvidedContentBlocks"][number], { type: "text" }> => block.type === "text")
    .map((block) => block.text.trim())
    .filter(Boolean);
  const fallbacks = [page.outlineText, page.userConstraints, page.styleText].map((item) => item.trim()).filter(Boolean);
  const combined = [...textBlocks, ...fallbacks];

  return {
    primary: combined[0] || "案例页先交代对象与场景，再进入过程和结果。",
    secondary: combined[1] || page.userConstraints.trim() || "案例页需要把关键动作与结果讲清楚。",
    tertiary: combined[2] || page.styleText.trim() || "图文配对必须帮助读者理解叙事推进。",
  };
}

export function generateCaseContractInput(
  page: Page,
  versionLabel: string,
  pageIntent: PageIntent,
  contentPlan: PageContentPlan | null,
  pageSourceSet?: PageSourceSet | null,
): GeneratedCaseContractInput {
  const imageTextUnit = contentPlan?.units.find((unit) => unit.unitType === "imageTextPair");
  const imageTextAssembly = imageTextUnit?.assembly;
  const pairCount = imageTextUnit?.resolvedCount ?? Math.max(1, pageIntent.preferredImageCount || 1);
  const baseTexts = buildCaseBaseTexts(page);
  const imageTextPairs = Array.from({ length: pairCount }, (_, index) => {
    const binding = imageTextAssembly?.resolvedUnits?.[index];
    return {
      label: `图文单元 ${index + 1}`,
      outcome: binding?.outcome,
      imageSlotLabel: `image slot ${index + 1}`,
      textSlotLabel: `text slot ${index + 1}`,
      slotBindings: binding?.slots ?? [],
    };
  });

  const imageValues = imageTextPairs.map((pair) => getImageAssetByBinding(pageSourceSet, pair.slotBindings)).filter(Boolean) as ImageSourceAsset[];
  const textValues = imageTextPairs.map((pair) => {
    const sourceId = pair.slotBindings.find((binding) => binding.slotType === "text")?.source?.sourceId;
    return getTextBlockValueById(page, sourceId);
  }).filter(Boolean);
  const leadImage = imageValues[0];
  const subject =
    clampText(textValues[0] || pickFirstMeaningful(page.outlineText, page.pageType), 40, page.pageType);
  const scenario =
    textValues[0] ||
    `${pickFirstMeaningful(page.outlineText, page.pageType)}，这一页先交代案例对象、所在场景和为什么值得看。`;
  const challenge =
    textValues[1] ||
    `${pickFirstMeaningful(page.userConstraints, baseTexts.secondary)}，因此案例页不能只罗列素材，而要说明为什么要这样组织做法。`;
  const actionSteps = ensureItems(
    [
      textValues[1] || "先识别案例里最关键的流程问题或组织瓶颈。",
      textValues[2] || "再把图像线索与文字说明一一配对，保证叙事推进不是跳跃发生。",
      `最后把结果收束到明确判断：${pickFirstMeaningful(baseTexts.tertiary, "图文结构需要服务结果理解。")}`,
    ],
    ["图文单元不足时，也要保持案例叙事主线不断裂。"],
    3,
  );
  const resultSummary =
    `${pickFirstMeaningful(baseTexts.secondary, "案例页不只是交代过程，更要让读者知道最终结果为什么成立。")}。`;
  const takeaway =
    `${pickFirstMeaningful(baseTexts.tertiary, "图文配对必须服务叙事推进，而不是把图和文各自摆上去。")}。`;
  const visualCaption =
    leadImage
      ? `${leadImage.caption || leadImage.altText || "案例主视觉"}，当前主视觉已来自 imageTextPair 的正式 image binding。`
      : pageIntent.visualPriority === "high"
        ? `当前页表达倾向为 ${pageIntent.expressionMode}，应明确预留案例视觉区，并至少容纳 ${pairCount} 组图文单元。`
        : "案例页当前仍需保留一个主视觉入口，用于承接对象、场景和阅读起点。";

  return {
    sourceKind: "generated",
    pageType: "case",
    pageId: page.id,
    versionLabel,
    title: page.pageType,
    subject,
    scenario,
    challenge,
    actionSteps: pageIntent.textDensity === "low" ? actionSteps.slice(0, 3) : actionSteps,
    resultSummary,
    takeaway,
    visualCaption,
    imageTextPairs,
    imageTextPairStatus: {
      requestedCount: imageTextUnit?.requestedCount ?? pairCount,
      resolvedCount: imageTextUnit?.resolvedCount ?? pairCount,
      filledCount: imageTextUnit?.filledCount ?? 0,
      partialCount: imageTextAssembly?.partialCount ?? 0,
      unfilledCount: imageTextAssembly?.unfilledCount ?? 0,
      fillRule: imageTextAssembly?.fillRule ?? imageTextUnit?.fillRule ?? "all-required-slots",
    },
    outcomeMetrics: [
      {
        id: "case-metric-1",
        label: "图文单元",
        value: `${pairCount} 组`,
        detail: `当前 assembly：requested ${imageTextUnit?.requestedCount ?? pairCount} / filled ${imageTextUnit?.filledCount ?? 0}`,
      },
      {
        id: "case-metric-2",
        label: "图片来源",
        value: `${imageValues.length} 张`,
        detail: imageValues.length
          ? "主视觉与图文单元图片已来自正式 image binding。"
          : "当前 image source 不足时，会显式暴露 imageTextPair 的供给边界。",
      },
      {
        id: "case-metric-3",
        label: "文本来源",
        value: `${textValues.length} 段`,
        detail: textValues.length
          ? "说明文本已通过正式 text binding 进入案例叙事。"
          : "当前 text source 不足时，案例页会暴露叙事链补位而不是偷偷抹平。",
      },
    ],
  };
}

export function generateCoverContent(task: Task, page: Page, contentPages: Page[], promptNote: string): GeneratedCoverContent {
  const topic = normalizePromptTopic(task.prompt, page.coverMeta?.title || task.title || "PagesCut");
  const overviewPage = contentPages.find((item) => item.pageRole === "overview");
  const leadPage = overviewPage ?? contentPages[0];
  const pageTypes = contentPages.map((item) => item.pageType);
  const structureSummary = clampText(pageTypes.join(" / "), 30, "overview / data / case");
  const outlineLead = leadPage ? pickFirstMeaningful(leadPage.outlineText, leadPage.pageType) : "围绕当前主题建立整期阅读入口。";
  const issueLabel = page.coverMeta?.issueLabel || parseIssueLabel(task.prompt);
  const kicker = page.coverMeta?.kicker || (task.workType === "magazine" ? "Monthly Brief" : "Report Brief");
  const brandLabel = page.coverMeta?.brandLabel || "PagesCut Research";

  return {
    title: task.workType === "magazine" ? `${topic}` : `${topic}报告`,
    subtitle: `${outlineLead}，并串联 ${structureSummary} 等内容页，先完成全局进入。`,
    summary: `封面页当前根据任务主题、overview 判断和已确认内容结构生成；再生成备注：${clampText(promptNote, 24, "初版封面候选")}`,
    footerNote: `${issueLabel} · ${brandLabel}`,
    kicker,
    heroLabel: `本期阅读入口围绕 ${topic} 展开，先建立判断，再进入 ${structureSummary}。`,
    issueLabel,
    brandLabel,
  };
}

function buildTocEntryLabel(label: string, title: string) {
  return `${label}  ${title}`;
}

export function generateTocContent(page: Page, contentPages: Page[], promptNote: string): GeneratedTocContent {
  const orderedPages = contentPages.slice().sort((a, b) => a.index - b.index);
  const tocEntries = orderedPages.map((contentPage) =>
    buildTocEntryLabel(getPageDisplayLabel(contentPage, orderedPages), contentPage.pageType),
  );

  return {
    title: page.pageType,
    subtitle: "目录组织与阅读导航",
    summary: `目录页当前根据已确认内容页顺序生成；再生成备注：${clampText(promptNote, 24, "初版目录候选")}`,
    footerNote: "目录页可在硬编辑阶段继续微调标题和顺序表达。",
    tocEntries,
    guidanceNote: "目录页直接依据当前整期内容顺序建立阅读入口，编号仅作为展示标识，不承载稳定身份。",
  };
}

export function generateTocContentFromComposition(pageType: string, contentCompositionPages: FinalCompositionPage[]): GeneratedTocContent {
  const orderedContentPages = contentCompositionPages.slice().sort((a, b) => a.orderIndex - b.orderIndex);
  const tocEntries = orderedContentPages.map((compositionPage) =>
    buildTocEntryLabel(getPageDisplayLabel(compositionPage, orderedContentPages), compositionPage.pageType),
  );

  return {
    title: pageType,
    subtitle: "目录组织与阅读导航",
    summary: "目录页当前直接依据 Final Composition 中已成立的内容页排序生成。",
    footerNote: "目录页可在硬编辑阶段继续微调标题和顺序表达。",
    tocEntries,
    guidanceNote: "目录项来自 composition page 的最终顺序与展示编号，编号仅用于阅读显示，不等于稳定 page id。",
  };
}
