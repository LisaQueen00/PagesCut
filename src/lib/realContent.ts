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

function getPreferredTextValues(
  page: Page,
  pageSourceSet: PageSourceSet | null | undefined,
  preferredSyntheticOrder: Array<NonNullable<TextSourceFragment["sourceField"]>>,
) {
  const sourceTexts = pageSourceSet
    ? [
        ...preferredSyntheticOrder.flatMap((field) =>
          pageSourceSet.textFragments.filter((item) => item.origin === "synthetic" && item.sourceField === field),
        ),
        ...pageSourceSet.textFragments.filter((item) => item.origin === "user-block"),
      ]
        .map((item) => item.text.trim())
        .filter(Boolean)
    : [];
  if (sourceTexts.length) {
    return sourceTexts;
  }

  const textBlocks = page.userProvidedContentBlocks
    .filter((block): block is Extract<Page["userProvidedContentBlocks"][number], { type: "text" }> => block.type === "text")
    .map((block) => block.text.trim())
    .filter(Boolean);
  const fallbacks = [page.outlineText, page.styleText, page.userConstraints].map((item) => item.trim()).filter(Boolean);
  return [...textBlocks, ...fallbacks];
}

function buildOverviewBaseTexts(page: Page, pageSourceSet?: PageSourceSet | null) {
  const combined = getPreferredTextValues(page, pageSourceSet, ["overviewOllamaDraft", "overviewGeneratedDraft", "outlineText", "styleText", "userConstraints"]);

  return {
    primary: combined[0] || "本页需要先完成主题进入和总体判断。",
    secondary: combined[1] || page.styleText.trim() || "整体表达应保持清晰、克制和连续阅读节奏。",
    tertiary: combined[2] || page.userConstraints.trim() || "控制信息层级，避免在总览页过早堆叠细节。",
  };
}

function buildSummaryBaseTexts(page: Page, pageSourceSet?: PageSourceSet | null) {
  const combined = getPreferredTextValues(page, pageSourceSet, ["summaryGeneratedDraft", "outlineText", "userConstraints", "styleText"]);

  return {
    primary: combined[0] || "本页需要把整期内容收束成最终判断，而不是继续展开。",
    secondary: combined[1] || page.userConstraints.trim() || "结论应控制在少量可带走判断内。",
    tertiary: combined[2] || page.styleText.trim() || "收束页应保持克制、清楚和可执行。",
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
  const topic = clampText(pickFirstMeaningful(page.outlineText, page.pageType), 30, page.pageType);
  const tone = page.styleText.trim() || "结构清晰、克制专业";
  const constraint = page.userConstraints.trim() || "保持总览页的判断优先级。";
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
    `核心主题：${topic}`,
    `表达倾向：${clampText(baseTexts.secondary, 26, tone)}`,
    `页面边界：${clampText(baseTexts.tertiary, 26, constraint)}`,
  ];

  const signalItems = [
    {
      heading: "主题判断",
      detail: `${pickFirstMeaningful(baseTexts.primary, topic)}，本页先承担进入整期内容前的判断校准。`,
    },
    {
      heading: "阅读组织",
      detail: `${pickFirstMeaningful(baseTexts.secondary, tone)}，因此当前 overview 应优先组织摘要、信号与正文解释的顺序。`,
    },
    {
      heading: "页面边界",
      detail: `${pickFirstMeaningful(baseTexts.tertiary, constraint)}，避免让总览页退回到松散堆料。`,
    },
  ];

  const supportPoints = [
    `${pickFirstMeaningful(baseTexts.primary, topic)}。这决定了 overview 的第一职责不是补完所有细节，而是把读者带到正确的主题判断上。`,
    `${pickFirstMeaningful(baseTexts.secondary, tone)}。因此正文解释应围绕判断展开，而不是重新平铺一份素材清单。`,
    `${pickFirstMeaningful(baseTexts.tertiary, constraint)}。这意味着后续案例页、数据页和总结页需要继续承接，而不是让 overview 独自完成整期表达。`,
    pageIntent.textDensity === "high"
      ? "当前 PageIntent 允许更高的文本密度，所以正文区需要保留足够解释层，而不是只剩下口号式摘要。"
      : "当前 PageIntent 更偏向中低文本密度，因此正文解释应收束到少量关键段落，保持整体进入感。",
  ];

  const viewpointCards = [
    `本页先回答“这期最重要的变化是什么”，再引导读者进入后续页面。`,
    `真实内容接入后，overview 的价值在于组织判断，而不是代替 case 或 data 页。`,
    `PageContentPlan 当前只承接 text unit，因此 contract 必须显式把这些文本单元组织成可阅读的判断链。`,
    `Renderer 只负责消费已经成立的 contract，不再重新决定哪些内容应该出现。`,
  ];

  return {
    sourceKind: "generated",
    pageType: "overview",
    pageId: page.id,
    versionLabel,
    title: page.pageType,
    outline: baseTexts.primary,
    tone,
    openingNote: `本页围绕“${topic}”建立主题进入，并先完成整体判断，再把读者送往后续支撑页面。`,
    highlights,
    signalItems,
    signalMetrics: [
      {
        id: "overview-metric-1",
        label: "表达模式",
        value: pageIntent.expressionMode,
        detail: "当前 overview 仍是判断驱动，不向图表或案例叙事让位。",
      },
      {
        id: "overview-metric-2",
        label: "文本密度",
        value: pageIntent.textDensity,
        detail: "该密度直接影响正文解释层需要保留多少段落。",
      },
      {
        id: "overview-metric-3",
        label: "内容区域",
        value: String(pageIntent.requiredContentAreas.length),
        detail: `当前需要承接：${pageIntent.requiredContentAreas.join(" / ")}`,
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
  const topic = clampText(pickFirstMeaningful(page.outlineText, page.pageType), 30, page.pageType);
  const boundary = page.userConstraints.trim() || "收束页不重新展开整期内容。";
  const tone = page.styleText.trim() || "克制、收束、可带走";
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
      heading: "最终判断",
      detail: `${pickFirstMeaningful(baseTexts.primary, topic)}，summary 的第一职责是把整期阅读折叠成可带走的判断。`,
    },
    {
      heading: "行动落点",
      detail: `${pickFirstMeaningful(baseTexts.tertiary, tone)}，因此建议区应直接服务下一步行动，而不是回到背景铺陈。`,
    },
    {
      heading: "边界提醒",
      detail: `${pickFirstMeaningful(baseTexts.secondary, boundary)}，这决定了 summary 不能退回 overview 式主题进入页。`,
    },
  ];

  const recommendations = [
    `先把“${topic}”压缩为两到三个后续观察点，再进入下一轮追踪。`,
    "只保留最能指导下一步判断的结论，不把收束页重新做成完整综述。",
    pageIntent.textDensity === "high"
      ? "当前允许稍高文本密度，但仍应围绕结论、建议和边界提醒组织，不继续发散。"
      : "当前文本密度应保持节制，建议区需要短而可执行。",
  ];

  const cautions = [
    `${pickFirstMeaningful(baseTexts.secondary, boundary)}，不要把收束页重新扩成问题清单。`,
    "不要把单页结论伪装成全量论证，summary 负责收束，不负责重新证明整期内容。",
  ];

  return {
    sourceKind: "generated",
    pageType: "summary",
    pageId: page.id,
    versionLabel,
    title: page.pageType,
    finalJudgment: `${pickFirstMeaningful(baseTexts.primary, topic)}，当前页面应以“可带走的最终判断”结束阅读。`,
    conclusionPoints,
    recommendations,
    cautions,
    closingNote:
      `${pickFirstMeaningful(baseTexts.tertiary, tone)}。因此这一页的结束语应把读者留在明确判断和下一步行动上，而不是再次打开新的讨论支线。`,
    evidenceMetrics: [
      {
        id: "summary-metric-1",
        label: "表达模式",
        value: pageIntent.expressionMode,
        detail: "summary 仍是 text-led，但它的职责是收束，不是主题进入。",
      },
      {
        id: "summary-metric-2",
        label: "文本密度",
        value: pageIntent.textDensity,
        detail: "该密度决定收束页能保留多少解释层，而不是决定是否继续扩材料。",
      },
      {
        id: "summary-metric-3",
        label: "收束单元",
        value: `${textUnit?.resolvedCount ?? 0}`,
        detail: `当前 assembly：requested ${textUnit?.requestedCount ?? 0} / filled ${textUnit?.filledCount ?? 0}`,
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
