import { useEffect, useRef, useState, type CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getContentUnitPolicy, getTextUnitPolicy, resolveTextUnitAssemblyFromSourceSet, resolveUnitAssemblyFromSourceSet } from "@/lib/contentUnitPolicy";
import { createPageSourceSet } from "@/lib/pageSources";
import { generateCaseContractInput, generateDataContractInput, generateOverviewContractInput, generateSummaryContractInput } from "@/lib/realContent";
import type { Page, UserProvidedContentBlock } from "@/types/domain";
import type {
  GeneratedCaseContractInput,
  GeneratedOverviewContractInput,
  GeneratedSummaryContractInput,
  LayoutContract,
  ManualDataContractInput,
  PageContentPlan,
  PageContentPlanUnit,
  PageIntent,
  PageIntentContentArea,
  PageModel,
  PageModelBlock,
  PageSourceSet,
  SupportedPageType,
} from "@/types/pageModel";

export const A4_PORTRAIT_RATIO = 210 / 297;
export const PAGE_MODEL_BASE_WIDTH = 920;
export const PAGE_MODEL_BASE_HEIGHT = Math.round(PAGE_MODEL_BASE_WIDTH / A4_PORTRAIT_RATIO);
type PageRenderDensity = "regular" | "compact";

function createBlockId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`;
}

function clampLines(lines: number): CSSProperties {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
    overflowWrap: "anywhere",
    minWidth: 0,
  };
}

function buildOverviewTheme(seed: number) {
  const palettes = [
    { accent: "#0f172a", soft: "#f5f7fb", border: "#dbe3ef", ink: "#111827" },
    { accent: "#0f4c81", soft: "#eef6fc", border: "#c9ddf1", ink: "#10253a" },
    { accent: "#14532d", soft: "#edf8f0", border: "#cfe8d5", ink: "#16321d" },
  ];
  return palettes[seed % palettes.length];
}

function buildDataTheme(seed: number) {
  const palettes = [
    { accent: "#7c2d12", soft: "#fcf3ef", border: "#efd8cb", ink: "#3b2217" },
    { accent: "#1d4ed8", soft: "#eff4ff", border: "#cfdcfb", ink: "#172554" },
    { accent: "#4338ca", soft: "#f2f1ff", border: "#d8d4ff", ink: "#312e81" },
  ];
  return palettes[seed % palettes.length];
}

function buildCaseTheme(seed: number) {
  const palettes = [
    { accent: "#9a3412", soft: "#fff5ef", border: "#f4d7ca", ink: "#442113" },
    { accent: "#1f6feb", soft: "#eff6ff", border: "#cfe0fb", ink: "#102a43" },
    { accent: "#0f766e", soft: "#edfdf9", border: "#c7eee7", ink: "#123431" },
  ];
  return palettes[seed % palettes.length];
}

function buildSummaryTheme(seed: number) {
  const palettes = [
    { accent: "#334155", soft: "#f8fafc", border: "#dbe4ee", ink: "#17212b" },
    { accent: "#4c1d95", soft: "#f6f2ff", border: "#e1d5ff", ink: "#2e1065" },
    { accent: "#7c2d12", soft: "#fff7ed", border: "#fed7aa", ink: "#431407" },
  ];
  return palettes[seed % palettes.length];
}

export function resolveSupportedPageType(page: Page): SupportedPageType | null {
  if (page.pageRole === "overview" || page.pageType.includes("综述")) {
    return "overview";
  }

  if (page.pageType.includes("数据")) {
    return "data";
  }

  if (page.pageRole === "case-study" || page.pageType.includes("案例")) {
    return "case";
  }

  if (page.pageRole === "summary" || page.pageType.includes("结语") || page.pageType.includes("总结")) {
    return "summary";
  }

  return null;
}

function uniqueContentAreas(items: PageIntentContentArea[]) {
  return [...new Set(items)];
}

function createPlanUnit(input: Omit<PageContentPlanUnit, "id">, index: number): PageContentPlanUnit {
  return {
    id: createBlockId("content-unit", index),
    ...input,
  };
}

function countBlocksByType(blocks: UserProvidedContentBlock[], type: UserProvidedContentBlock["type"]) {
  return blocks.filter((block) => block.type === type).length;
}

// PageIntent is the bridge between Stage 1 page definition and later layout generation.
// It keeps expression preferences structural, without letting Stage 1 define concrete panels.
export function createPageIntent(page: Page): PageIntent | null {
  const pageType = resolveSupportedPageType(page);
  if (!pageType) {
    return null;
  }

  const imageCount = page.userProvidedContentBlocks.filter((block) => block.type === "image").length;
  const chartCount = page.userProvidedContentBlocks.filter((block) => block.type === "chart_desc").length;
  const outlineLength = page.outlineText.trim().length;

  switch (page.expressionMode) {
    case "mixed-media":
      return {
        pageId: page.id,
        pageType,
        expressionMode: "image-text",
        visualPriority: "high",
        textDensity: outlineLength > 80 ? "medium" : "low",
        preferredImageCount: Math.max(imageCount, 2),
        preferredChartCount: Math.max(chartCount, 0),
        requiredContentAreas: uniqueContentAreas(["visual", "narrative", chartCount ? "metrics" : "narrative"]),
        allowDegrade: true,
      };
    case "chart":
      return {
        pageId: page.id,
        pageType,
        expressionMode: "chart-led",
        visualPriority: "medium",
        textDensity: "low",
        preferredImageCount: imageCount,
        preferredChartCount: Math.max(chartCount, 1),
        requiredContentAreas: uniqueContentAreas(["chart", "metrics", "table"]),
        allowDegrade: false,
      };
    case "hybrid":
      return {
        pageId: page.id,
        pageType,
        expressionMode: "mixed",
        visualPriority: "medium",
        textDensity: "medium",
        preferredImageCount: Math.max(imageCount, 1),
        preferredChartCount: Math.max(chartCount, 1),
        requiredContentAreas: uniqueContentAreas(["visual", "chart", "metrics", "narrative"]),
        allowDegrade: true,
      };
    case "text":
    default:
      return {
        pageId: page.id,
        pageType,
        expressionMode: "text-led",
        visualPriority: "low",
        textDensity: outlineLength > 80 ? "high" : "medium",
        preferredImageCount: imageCount,
        preferredChartCount: chartCount,
        requiredContentAreas: uniqueContentAreas(["narrative"]),
        allowDegrade: true,
      };
  }
}

// PageContentPlan answers how many content units the page needs, how they pair,
// and which units are required before layout contract generation decides containers.
export function createPageContentPlan(page: Page, pageIntent: PageIntent, pageSourceSet?: PageSourceSet | null): PageContentPlan {
  const effectiveSourceSet = pageSourceSet ?? createPageSourceSet(page);
  if (pageIntent.pageType === "case") {
    const requestedPairCount = Math.max(1, pageIntent.preferredImageCount || 1);
    const availablePairCount = Math.min(
      effectiveSourceSet.imageAssets.length,
      countBlocksByType(page.userProvidedContentBlocks, "text"),
    );
    const resolvedPairCount = pageIntent.allowDegrade
      ? availablePairCount > 0
        ? Math.min(requestedPairCount, availablePairCount)
        : 1
      : requestedPairCount;
    const pairPolicy = getContentUnitPolicy("imageTextPair");
    const pairAssembly = resolveUnitAssemblyFromSourceSet("imageTextPair", effectiveSourceSet, page.userProvidedContentBlocks, resolvedPairCount);
    return {
      pageId: page.id,
      pageType: pageIntent.pageType,
      units: [
        createPlanUnit(
          {
            unitType: pairPolicy.unitType,
            relation: pairPolicy.relation,
            requestedCount: requestedPairCount,
            resolvedCount: resolvedPairCount,
            filledCount: pairAssembly.resolvedUnits.filter((unit) => unit.outcome === "filled").length,
            required: true,
            allowDegrade: pageIntent.allowDegrade,
            fillRule: pairPolicy.fillRule,
            assembly: pairAssembly,
          },
          0,
        ),
        createPlanUnit(
          {
            unitType: "metric",
            relation: "grouped",
            requestedCount: 2,
            resolvedCount: 2,
            filledCount: 2,
            required: false,
            allowDegrade: true,
            fillRule: "all-required-slots",
          },
          1,
        ),
        createPlanUnit(
          {
            unitType: "text",
            relation: "standalone",
            requestedCount: 1,
            resolvedCount: 1,
            filledCount: Math.min(1, countBlocksByType(page.userProvidedContentBlocks, "text") || 1),
            required: true,
            allowDegrade: false,
            fillRule: "all-required-slots",
          },
          2,
        ),
      ],
    };
  }

  if (pageIntent.pageType === "data") {
    const requestedChartPairCount = Math.max(1, pageIntent.preferredChartCount || 1);
    const availableChartPairCount = effectiveSourceSet.chartBriefs.length;
    const resolvedChartPairCount =
      availableChartPairCount > 0
        ? Math.min(requestedChartPairCount, availableChartPairCount)
        : pageIntent.allowDegrade
          ? 1
          : requestedChartPairCount;
    const hasTable = page.userProvidedContentBlocks.some((block) => block.type === "table");
    const chartPairPolicy = getContentUnitPolicy("chartExplanationPair");
    const chartPairAssembly = resolveUnitAssemblyFromSourceSet("chartExplanationPair", effectiveSourceSet, page.userProvidedContentBlocks, resolvedChartPairCount);
    return {
      pageId: page.id,
      pageType: pageIntent.pageType,
      units: [
        createPlanUnit(
          {
            unitType: chartPairPolicy.unitType,
            relation: chartPairPolicy.relation,
            requestedCount: requestedChartPairCount,
            resolvedCount: resolvedChartPairCount,
            filledCount: chartPairAssembly.resolvedUnits.filter((unit) => unit.outcome === "filled").length,
            required: true,
            allowDegrade: false,
            fillRule: chartPairPolicy.fillRule,
            assembly: chartPairAssembly,
          },
          0,
        ),
        createPlanUnit(
          {
            unitType: "metric",
            relation: "grouped",
            requestedCount: Math.min(3, resolvedChartPairCount + 2),
            resolvedCount: Math.min(3, resolvedChartPairCount + 2),
            filledCount: Math.min(3, resolvedChartPairCount + 2),
            required: true,
            allowDegrade: true,
            fillRule: "all-required-slots",
          },
          1,
        ),
        createPlanUnit(
          {
            unitType: "table",
            relation: "standalone",
            requestedCount: pageIntent.requiredContentAreas.includes("table") ? 1 : 0,
            resolvedCount: pageIntent.requiredContentAreas.includes("table") ? 1 : 0,
            filledCount: hasTable && pageIntent.requiredContentAreas.includes("table") ? 1 : 0,
            required: pageIntent.requiredContentAreas.includes("table"),
            allowDegrade: true,
            fillRule: "all-required-slots",
          },
          2,
        ),
      ],
    };
  }

  if (pageIntent.pageType === "overview") {
    const requestedTextUnits = 3;
    const textPolicy = getTextUnitPolicy();
    const textAssembly = resolveTextUnitAssemblyFromSourceSet(effectiveSourceSet, requestedTextUnits);
    return {
      pageId: page.id,
      pageType: pageIntent.pageType,
      units: [
        createPlanUnit(
          {
            unitType: textPolicy.unitType,
            relation: "grouped",
            requestedCount: requestedTextUnits,
            resolvedCount: requestedTextUnits,
            filledCount: textAssembly.resolvedUnits.filter((unit) => unit.outcome === "filled").length,
            required: true,
            allowDegrade: pageIntent.allowDegrade,
            fillRule: textAssembly.fillRule,
            assembly: textAssembly,
          },
          0,
        ),
      ],
    };
  }

  if (pageIntent.pageType === "summary") {
    const requestedTextUnits = 3;
    const textPolicy = getTextUnitPolicy();
    const textAssembly = resolveTextUnitAssemblyFromSourceSet(effectiveSourceSet, requestedTextUnits);
    return {
      pageId: page.id,
      pageType: pageIntent.pageType,
      units: [
        createPlanUnit(
          {
            unitType: textPolicy.unitType,
            relation: "grouped",
            requestedCount: requestedTextUnits,
            resolvedCount: requestedTextUnits,
            filledCount: textAssembly.resolvedUnits.filter((unit) => unit.outcome === "filled").length,
            required: true,
            allowDegrade: pageIntent.allowDegrade,
            fillRule: textAssembly.fillRule,
            assembly: textAssembly,
          },
          0,
        ),
      ],
    };
  }

  return {
    pageId: page.id,
    pageType: pageIntent.pageType,
    units: [
      createPlanUnit(
        {
          unitType: "text",
          relation: "standalone",
          requestedCount: 1,
          resolvedCount: 1,
          filledCount: Math.min(1, countBlocksByType(page.userProvidedContentBlocks, "text") || 1),
          required: true,
          allowDegrade: pageIntent.allowDegrade,
          fillRule: "all-required-slots",
        },
        0,
      ),
    ],
  };
}

export function createGeneratedOverviewContract(page: Page, versionLabel: string, pageIntent?: PageIntent | null, _contentPlan?: PageContentPlan | null, pageSourceSet?: PageSourceSet | null): GeneratedOverviewContractInput | null {
  if (resolveSupportedPageType(page) !== "overview") {
    return null;
  }
  const effectiveIntent = pageIntent ?? createPageIntent(page);
  const effectiveSourceSet = pageSourceSet ?? createPageSourceSet(page);
  const effectivePlan = _contentPlan ?? (effectiveIntent ? createPageContentPlan(page, effectiveIntent, effectiveSourceSet) : null);
  if (!effectiveIntent) {
    return null;
  }

  return generateOverviewContractInput(page, versionLabel, effectiveIntent, effectivePlan, effectiveSourceSet);
}

export function createManualDataContract(page: Page, versionLabel: string, pageIntent?: PageIntent | null, contentPlan?: PageContentPlan | null, pageSourceSet?: PageSourceSet | null): ManualDataContractInput | null {
  if (resolveSupportedPageType(page) !== "data") {
    return null;
  }
  const effectiveIntent = pageIntent ?? createPageIntent(page);
  const effectiveSourceSet = pageSourceSet ?? createPageSourceSet(page);
  const effectivePlan = contentPlan ?? (effectiveIntent ? createPageContentPlan(page, effectiveIntent, effectiveSourceSet) : null);
  if (!effectiveIntent) {
    return null;
  }

  return generateDataContractInput(page, versionLabel, effectiveIntent, effectivePlan, effectiveSourceSet);
}

export function createGeneratedCaseContract(page: Page, versionLabel: string, pageIntent?: PageIntent | null, contentPlan?: PageContentPlan | null, pageSourceSet?: PageSourceSet | null): GeneratedCaseContractInput | null {
  if (resolveSupportedPageType(page) !== "case") {
    return null;
  }

  const effectiveIntent = pageIntent ?? createPageIntent(page);
  const effectiveSourceSet = pageSourceSet ?? createPageSourceSet(page);
  const effectivePlan = contentPlan ?? (effectiveIntent ? createPageContentPlan(page, effectiveIntent, effectiveSourceSet) : null);
  if (!effectiveIntent) {
    return null;
  }

  return generateCaseContractInput(page, versionLabel, effectiveIntent, effectivePlan, effectiveSourceSet);
}

export function createGeneratedSummaryContract(page: Page, versionLabel: string, pageIntent?: PageIntent | null, _contentPlan?: PageContentPlan | null, pageSourceSet?: PageSourceSet | null): GeneratedSummaryContractInput | null {
  if (resolveSupportedPageType(page) !== "summary") {
    return null;
  }
  const effectiveIntent = pageIntent ?? createPageIntent(page);
  const effectiveSourceSet = pageSourceSet ?? createPageSourceSet(page);
  const effectivePlan = _contentPlan ?? (effectiveIntent ? createPageContentPlan(page, effectiveIntent, effectiveSourceSet) : null);
  if (!effectiveIntent) {
    return null;
  }

  return generateSummaryContractInput(page, versionLabel, effectiveIntent, effectivePlan, effectiveSourceSet);
}

export function fillContractToPageModel(contract: LayoutContract, variant = 0): PageModel {
  if (contract.pageType === "overview") {
    return {
      id: `page-model-${contract.pageId}`,
      pageType: "overview",
      layoutKey: "overview-editorial",
      sourceKind: contract.sourceKind,
      aspectRatio: "a4",
      theme: buildOverviewTheme(variant),
      regions: [
        {
          id: "region-hero",
          name: "hero",
          blocks: [
            {
              id: "hero-1",
              type: "hero",
              eyebrow: `${contract.versionLabel} · Overview`,
              title: contract.title,
              summary: contract.outline,
            },
            {
              id: "callout-1",
              type: "callout",
              title: "主题进入",
              body: contract.openingNote,
            },
          ],
        },
        {
          id: "region-main",
          name: "main",
          blocks: [
            {
              id: "signal-list-1",
              type: "signal-list",
              title: "关键信号",
              items: contract.signalItems.map((item, index) => ({
                id: createBlockId("overview-signal", index),
                heading: item.heading,
                detail: item.detail,
              })),
            },
            {
              id: "slots-1",
              type: "content-slots",
              title: "判断文本单元",
              summary: {
                unitType: "text",
                requestedCount: contract.textUnitStatus.requestedCount,
                resolvedCount: contract.textUnitStatus.resolvedCount,
                filledCount: contract.textUnitStatus.filledCount,
                partialCount: contract.textUnitStatus.partialCount,
                unfilledCount: contract.textUnitStatus.unfilledCount,
                fillRule: contract.textUnitStatus.fillRule,
              },
              items: contract.textUnits.map((item, index) => ({
                id: createBlockId("overview-text-slot", index),
                unitType: "text",
                label: item.label,
                outcome: item.outcome,
                textSlotLabel: item.textSlotLabel,
                slotBindings: item.slotBindings,
              })),
            },
            {
              id: "rich-1",
              type: "rich-text",
              title: `正文解释 · ${contract.tone}`,
              paragraphs: contract.supportPoints,
            },
          ],
        },
        {
          id: "region-aside",
          name: "aside",
          blocks: [
            {
              id: "callout-2",
              type: "callout",
              title: "本页判断",
              body: contract.highlights[0] ?? contract.openingNote,
            },
            {
              id: "metrics-1",
              type: "metrics",
              title: "页内摘要指标",
              items: contract.signalMetrics,
            },
            {
              id: "list-1",
              type: "bullet-list",
              title: "延展观点",
              items: contract.viewpointCards,
            },
          ],
        },
      ],
    };
  }

  if (contract.pageType === "case") {
    return {
      id: `page-model-${contract.pageId}`,
      pageType: "case",
      layoutKey: "case-narrative",
      sourceKind: contract.sourceKind,
      aspectRatio: "a4",
      theme: buildCaseTheme(variant),
      regions: [
        {
          id: "region-hero",
          name: "hero",
          blocks: [
            {
              id: "hero-1",
              type: "hero",
              eyebrow: `${contract.versionLabel} · Case`,
              title: contract.title,
              summary: contract.subject,
            },
            {
              id: "visual-1",
              type: "visual",
              title: "案例场景",
              caption: contract.visualCaption,
              kicker: "Narrative Entry",
            },
          ],
        },
        {
          id: "region-main",
          name: "main",
          blocks: [
            {
              id: "rich-1",
              type: "rich-text",
              title: "背景 / 问题",
              paragraphs: [contract.scenario, contract.challenge],
            },
            {
              id: "slots-1",
              type: "content-slots",
              title: "图文单元槽位",
              summary: {
                unitType: "imageTextPair",
                requestedCount: contract.imageTextPairStatus.requestedCount,
                resolvedCount: contract.imageTextPairStatus.resolvedCount,
                filledCount: contract.imageTextPairStatus.filledCount,
                partialCount: contract.imageTextPairStatus.partialCount,
                unfilledCount: contract.imageTextPairStatus.unfilledCount,
                fillRule: contract.imageTextPairStatus.fillRule,
              },
              items: contract.imageTextPairs.map((item, index) => ({
                id: createBlockId("case-slot", index),
                unitType: "imageTextPair",
                label: item.label,
                outcome: item.outcome,
                imageSlotLabel: item.imageSlotLabel,
                textSlotLabel: item.textSlotLabel,
                slotBindings: item.slotBindings,
              })),
            },
            {
              id: "signal-list-1",
              type: "signal-list",
              title: "关键做法 / 过程",
              items: contract.actionSteps.map((step, index) => ({
                id: createBlockId("case-step", index),
                heading: `步骤 ${index + 1}`,
                detail: step,
              })),
            },
          ],
        },
        {
          id: "region-aside",
          name: "aside",
          blocks: [
            {
              id: "callout-1",
              type: "callout",
              title: "结果 / 成效",
              body: contract.resultSummary,
            },
            {
              id: "metrics-1",
              type: "metrics",
              title: "案例结果指标",
              items: contract.outcomeMetrics,
            },
            {
              id: "list-1",
              type: "bullet-list",
              title: "启示 / Takeaway",
              items: [contract.takeaway, "案例页的价值在于把一条可复用的叙事链讲完整，而不是只展示局部素材。"],
            },
          ],
        },
      ],
    };
  }

  if (contract.pageType === "summary") {
    return {
      id: `page-model-${contract.pageId}`,
      pageType: "summary",
      layoutKey: "summary-closing",
      sourceKind: contract.sourceKind,
      aspectRatio: "a4",
      theme: buildSummaryTheme(variant),
      regions: [
        {
          id: "region-hero",
          name: "hero",
          blocks: [
            {
              id: "hero-1",
              type: "hero",
              eyebrow: `${contract.versionLabel} · Summary`,
              title: contract.title,
              summary: contract.finalJudgment,
            },
            {
              id: "callout-1",
              type: "callout",
              title: "收束判断",
              body: contract.finalJudgment,
            },
          ],
        },
        {
          id: "region-main",
          name: "main",
          blocks: [
            {
              id: "signal-list-1",
              type: "signal-list",
              title: "关键结论",
              items: contract.conclusionPoints.map((item, index) => ({
                id: createBlockId("summary-point", index),
                heading: item.heading,
                detail: item.detail,
              })),
            },
            {
              id: "slots-1",
              type: "content-slots",
              title: "收束文本单元",
              summary: {
                unitType: "text",
                requestedCount: contract.textUnitStatus.requestedCount,
                resolvedCount: contract.textUnitStatus.resolvedCount,
                filledCount: contract.textUnitStatus.filledCount,
                partialCount: contract.textUnitStatus.partialCount,
                unfilledCount: contract.textUnitStatus.unfilledCount,
                fillRule: contract.textUnitStatus.fillRule,
              },
              items: contract.textUnits.map((item, index) => ({
                id: createBlockId("summary-text-slot", index),
                unitType: "text",
                label: item.label,
                outcome: item.outcome,
                textSlotLabel: item.textSlotLabel,
                slotBindings: item.slotBindings,
              })),
            },
            {
              id: "list-1",
              type: "bullet-list",
              title: "后续建议 / Action Items",
              items: contract.recommendations,
            },
          ],
        },
        {
          id: "region-aside",
          name: "aside",
          blocks: [
            {
              id: "metrics-1",
              type: "metrics",
              title: "收束摘要",
              items: contract.evidenceMetrics,
            },
            {
              id: "list-2",
              type: "bullet-list",
              title: "风险提醒 / 注意事项",
              items: contract.cautions,
            },
            {
              id: "rich-1",
              type: "rich-text",
              title: "结束语",
              paragraphs: [contract.closingNote],
            },
          ],
        },
      ],
    };
  }

  return {
    id: `page-model-${contract.pageId}`,
    pageType: "data",
    layoutKey: "data-dashboard",
    sourceKind: contract.sourceKind,
    aspectRatio: "a4",
    theme: buildDataTheme(variant),
    regions: [
      {
        id: "region-hero",
        name: "hero",
        blocks: [
          {
            id: "hero-1",
            type: "hero",
            eyebrow: `${contract.versionLabel} · Data`,
            title: contract.title,
            summary: contract.summary,
          },
        ],
      },
      {
        id: "region-main",
        name: "main",
        blocks: [
          {
            id: "chart-1",
            type: "chart",
            title: contract.chartTitle,
            series: contract.chartSeries,
          },
          {
            id: "slots-1",
            type: "content-slots",
            title: "图表说明复合单元",
            summary: {
              unitType: "chartExplanationPair",
              requestedCount: contract.chartExplanationPairStatus.requestedCount,
              resolvedCount: contract.chartExplanationPairStatus.resolvedCount,
              filledCount: contract.chartExplanationPairStatus.filledCount,
              partialCount: contract.chartExplanationPairStatus.partialCount,
              unfilledCount: contract.chartExplanationPairStatus.unfilledCount,
              fillRule: contract.chartExplanationPairStatus.fillRule,
            },
            items: contract.chartExplanationPairs.map((item, index) => ({
              id: createBlockId("data-slot", index),
              unitType: "chartExplanationPair",
              label: item.label,
              outcome: item.outcome,
              chartSlotLabel: item.chartSlotLabel,
              explanationSlotLabel: item.explanationSlotLabel,
              slotBindings: item.slotBindings,
            })),
          },
          {
            id: "callout-1",
            type: "callout",
            title: "图表说明",
            body: contract.chartSummary,
          },
          {
            id: "table-1",
            type: "table",
            title: contract.tableTitle,
            data: contract.table,
          },
        ],
      },
      {
        id: "region-aside",
        name: "aside",
        blocks: [
          {
            id: "metrics-1",
            type: "metrics",
            title: "关键指标",
            items: contract.metrics,
          },
          {
            id: "list-1",
            type: "bullet-list",
            title: "读图提示",
            items: contract.dataTakeaways,
          },
          {
            id: "rich-1",
            type: "rich-text",
            title: "来源 / 备注",
            paragraphs: contract.sourceLines,
          },
        ],
      },
    ],
  };
}

function HeroBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "hero" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.summary.length > 42;
  return (
    <section
      style={{
        width: "100%",
        minWidth: 0,
        borderRadius: 24,
        background: theme.soft,
        padding: isCompact ? 20 : 24,
        border: `1px solid ${theme.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.eyebrow}</div>
      <h1 style={{ margin: "12px 0 0", fontSize: isCompact ? 28 : 32, lineHeight: isCompact ? 1.15 : 1.2, fontWeight: 700, color: theme.accent, ...clampLines(2) }}>{block.title}</h1>
      <p style={{ margin: "14px 0 0", fontSize: isCompact ? 15 : 16, lineHeight: isCompact ? 1.72 : 1.9, color: theme.ink, ...clampLines(isCompact ? 3 : 4) }}>{block.summary}</p>
    </section>
  );
}

function MetricsBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "metrics" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.title === "关键指标" || block.items.length >= 3;
  return (
    <section
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        borderRadius: 24,
        background: "white",
        padding: isCompact ? 16 : 20,
        border: `1px solid ${theme.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <div
        style={{
          display: "grid",
          gap: isCompact ? 8 : 12,
          marginTop: isCompact ? 10 : 14,
          minHeight: 0,
          height: "100%",
          gridTemplateRows: `repeat(${block.items.length}, minmax(0, 1fr))`,
        }}
      >
        {block.items.map((item) => (
          <div
            key={item.id}
            style={{
              minWidth: 0,
              minHeight: 0,
              height: "100%",
              borderRadius: 18,
              background: theme.soft,
              padding: isCompact ? 10 : 14,
              overflow: "hidden",
              display: "grid",
              gridTemplateRows: "auto auto minmax(0, 1fr)",
              gap: isCompact ? 4 : 8,
            }}
          >
            <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6b7280", ...clampLines(1) }}>{item.label}</div>
            <div style={{ fontSize: isCompact ? 15 : 18, fontWeight: 700, color: theme.accent, ...clampLines(1) }}>{item.value}</div>
            <p style={{ margin: 0, fontSize: isCompact ? 11 : 13, lineHeight: isCompact ? 1.45 : 1.7, color: "#4b5563", ...clampLines(isCompact ? 2 : 3) }}>{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RichTextBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "rich-text" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.title === "来源 / 备注";
  return (
    <section
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        borderRadius: 24,
        background: "white",
        padding: isCompact ? 16 : 22,
        border: `1px solid ${theme.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <div style={{ display: "grid", gap: isCompact ? 8 : 12, marginTop: isCompact ? 10 : 14, minHeight: 0, height: "100%" }}>
        {block.paragraphs.map((paragraph, index) => (
          <p key={createBlockId(block.id, index)} style={{ margin: 0, fontSize: isCompact ? 14 : 15, lineHeight: isCompact ? 1.75 : 1.9, color: "#374151", ...clampLines(isCompact ? 3 : 4) }}>
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

function BulletListBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "bullet-list" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.title === "读图提示";
  return (
    <section
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        borderRadius: 24,
        background: theme.soft,
        padding: isCompact ? 14 : 20,
        border: `1px solid ${theme.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr)",
      }}
    >
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <ul style={{ margin: `${isCompact ? 10 : 14}px 0 0`, padding: 0, listStyle: "none", display: "grid", gap: isCompact ? 8 : 10, minHeight: 0, height: "100%" }}>
        {block.items.map((item, index) => (
          <li key={createBlockId(block.id, index)} style={{ display: "grid", gridTemplateColumns: `${isCompact ? 16 : 18}px minmax(0,1fr)`, gap: isCompact ? 8 : 10, alignItems: "start", minWidth: 0 }}>
            <span style={{ display: "inline-flex", width: isCompact ? 16 : 18, height: isCompact ? 16 : 18, alignItems: "center", justifyContent: "center", borderRadius: 999, background: "white", color: theme.accent, fontSize: isCompact ? 10 : 11, fontWeight: 700 }}>
              {index + 1}
            </span>
            <span style={{ fontSize: isCompact ? 13 : 14, lineHeight: isCompact ? 1.65 : 1.8, color: "#4b5563", ...clampLines(isCompact ? 2 : 3) }}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChartBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "chart" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const maxValue = Math.max(...block.series.map((item) => item.value), 1);
  const isCompact = density === "compact" || block.series.length <= 3;
  return (
    <section style={{ width: "100%", minWidth: 0, height: "100%", minHeight: 0, borderRadius: 24, background: "white", padding: isCompact ? 18 : 22, border: `1px solid ${theme.border}`, boxSizing: "border-box", overflow: "hidden", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" }}>
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <div style={{ marginTop: isCompact ? 14 : 18, display: "flex", alignItems: "end", gap: isCompact ? 10 : 14, minHeight: 0, height: "100%", minWidth: 0, overflow: "hidden" }}>
        {block.series.map((item) => (
          <div key={item.id} style={{ flex: "1 1 0", minWidth: 0, minHeight: 0, height: "100%", display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", gap: isCompact ? 8 : 10, justifyItems: "center", overflow: "hidden" }}>
            <span style={{ fontSize: isCompact ? 11 : 12, color: "#6b7280", ...clampLines(1) }}>{item.value}</span>
            <div
              style={{
                width: "100%",
                minHeight: 28,
                height: `${Math.max(18, (item.value / maxValue) * 100)}%`,
                maxHeight: "100%",
                borderRadius: 16,
                background: theme.accent,
                opacity: 0.9,
              }}
            />
            <span style={{ fontSize: isCompact ? 11 : 12, color: "#374151", textAlign: "center", ...clampLines(1) }}>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TableBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "table" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.data.rows.length >= 3 || block.data.columns.length >= 4;
  return (
    <section style={{ width: "100%", minWidth: 0, height: "100%", minHeight: 0, borderRadius: 24, background: "white", padding: isCompact ? 14 : 20, border: `1px solid ${theme.border}`, boxSizing: "border-box", overflow: "hidden", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" }}>
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <div style={{ marginTop: isCompact ? 10 : 14, overflow: "hidden", borderRadius: 18, border: `1px solid ${theme.border}`, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${block.data.columns.length}, minmax(0, 1fr))`, background: theme.soft }}>
          {block.data.columns.map((column, index) => (
            <div key={createBlockId(block.id, index)} style={{ minWidth: 0, padding: isCompact ? "10px 12px" : "12px 14px", fontSize: isCompact ? 11 : 12, fontWeight: 600, color: theme.ink, ...clampLines(1) }}>
              {column}
            </div>
          ))}
        </div>
        {block.data.rows.map((row, rowIndex) => (
          <div key={createBlockId(`${block.id}-row`, rowIndex)} style={{ display: "grid", gridTemplateColumns: `repeat(${block.data.columns.length}, minmax(0, 1fr))`, borderTop: rowIndex === 0 ? "none" : `1px solid ${theme.border}` }}>
            {row.map((cell, cellIndex) => (
              <div key={createBlockId(`${block.id}-${rowIndex}`, cellIndex)} style={{ minWidth: 0, padding: isCompact ? "10px 12px" : "12px 14px", fontSize: isCompact ? 11 : 12, lineHeight: isCompact ? 1.5 : 1.6, color: "#374151", ...clampLines(isCompact ? 1 : 2) }}>
                {cell}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function CalloutBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "callout" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.body.length > 88 || block.title === "图表说明" || block.title === "结果 / 成效";
  return (
    <section style={{ width: "100%", minWidth: 0, height: "100%", minHeight: 0, borderRadius: 24, background: `linear-gradient(145deg, ${theme.soft} 0%, white 100%)`, padding: isCompact ? 16 : 20, border: `1px solid ${theme.border}`, boxSizing: "border-box", overflow: "hidden", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" }}>
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <p style={{ margin: `${isCompact ? 10 : 12}px 0 0`, fontSize: isCompact ? 14 : 15, lineHeight: isCompact ? 1.72 : 1.85, color: theme.ink, ...clampLines(isCompact ? 4 : 5) }}>{block.body}</p>
    </section>
  );
}

function SignalListBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "signal-list" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.items.length >= 3;
  return (
    <section style={{ width: "100%", minWidth: 0, height: "100%", minHeight: 0, borderRadius: 24, background: "white", padding: isCompact ? 16 : 20, border: `1px solid ${theme.border}`, boxSizing: "border-box", overflow: "hidden", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)" }}>
      <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      <div style={{ display: "grid", gap: isCompact ? 8 : 12, marginTop: isCompact ? 10 : 14, minHeight: 0, height: "100%" }}>
        {block.items.map((item, index) => (
          <div key={item.id} style={{ display: "grid", gridTemplateColumns: `${isCompact ? 24 : 28}px minmax(0,1fr)`, gap: isCompact ? 10 : 12, alignItems: "start", borderTop: index === 0 ? "none" : `1px solid ${theme.border}`, paddingTop: index === 0 ? 0 : isCompact ? 10 : 12, minWidth: 0 }}>
            <div style={{ display: "inline-flex", width: isCompact ? 24 : 28, height: isCompact ? 24 : 28, alignItems: "center", justifyContent: "center", borderRadius: 999, background: theme.soft, color: theme.accent, fontSize: isCompact ? 11 : 12, fontWeight: 700 }}>
              {index + 1}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isCompact ? 11 : 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6b7280", ...clampLines(1) }}>{item.heading}</div>
              <p style={{ margin: "7px 0 0", fontSize: isCompact ? 13 : 14, lineHeight: isCompact ? 1.65 : 1.8, color: "#374151", ...clampLines(isCompact ? 2 : 3) }}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VisualBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "visual" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isCompact = density === "compact" || block.caption.length > 72;
  return (
    <section
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        borderRadius: 24,
        padding: isCompact ? 18 : 20,
        border: `1px solid ${theme.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
        background: `linear-gradient(155deg, ${theme.soft} 0%, white 100%)`,
        display: "grid",
        gridTemplateRows: "auto minmax(0, 1fr) auto",
        gap: isCompact ? 12 : 14,
      }}
    >
      <div>
        <div style={{ fontSize: isCompact ? 10 : 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
        <div style={{ marginTop: 8, fontSize: isCompact ? 11 : 12, letterSpacing: "0.14em", textTransform: "uppercase", color: theme.accent }}>{block.kicker}</div>
      </div>
      <div
        style={{
          borderRadius: 20,
          background: `linear-gradient(135deg, ${theme.accent} 0%, rgba(255,255,255,0.96) 100%)`,
          minHeight: 0,
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: isCompact ? 14 : 18,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.4)",
            background: "rgba(255,255,255,0.28)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: isCompact ? 22 : 26,
            right: isCompact ? 22 : 26,
            bottom: isCompact ? 18 : 22,
            height: isCompact ? 38 : 46,
            borderRadius: 14,
            background: "rgba(255,255,255,0.75)",
          }}
        />
      </div>
      <p style={{ margin: 0, fontSize: isCompact ? 13 : 14, lineHeight: isCompact ? 1.68 : 1.8, color: theme.ink, ...clampLines(isCompact ? 2 : 3) }}>{block.caption}</p>
    </section>
  );
}

function ContentSlotsBlock({
  block,
  theme,
  density,
}: {
  block: Extract<PageModelBlock, { type: "content-slots" }>;
  theme: PageModel["theme"];
  density: PageRenderDensity;
}) {
  const isDense = density === "compact" || block.items.length >= 3;
  const isTextOnly = block.items.every((item) => item.unitType === "text");
  const textSlotColumns = isTextOnly ? Math.max(1, Math.min(block.items.length, 3)) : 1;
  const textSlotRows = Math.max(1, isTextOnly ? Math.ceil(block.items.length / textSlotColumns) : block.items.length);
  const getSlotBinding = (item: typeof block.items[number], slotType: "image" | "text" | "chart" | "explanation") =>
    item.slotBindings?.find((binding) => binding.slotType === slotType);
  const formatBoolean = (value: boolean) => (value ? "yes" : "no");
  const formatOutcome = (outcome?: "filled" | "partial" | "unfilled") => {
    switch (outcome) {
      case "filled":
        return "filled";
      case "partial":
        return "partial";
      case "unfilled":
        return "unfilled";
      default:
        return "unknown";
    }
  };
  const formatMissingReason = (reason?: string) => {
    switch (reason) {
      case "missing-image-source":
        return "缺 image source";
      case "missing-text-source":
        return "缺 text source";
      case "missing-chart-source":
        return "缺 chart source";
      case "missing-explanation-source":
        return "缺 explanation source";
      default:
        return "未绑定来源";
    }
  };
  return (
    <section
      style={{
        width: "100%",
        minWidth: 0,
        height: "100%",
        minHeight: 0,
        borderRadius: 24,
        background: "white",
        padding: isDense ? 14 : 16,
        border: `1px solid ${theme.border}`,
        boxSizing: "border-box",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: block.summary ? "auto auto minmax(0, 1fr)" : "auto minmax(0, 1fr)",
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6b7280" }}>{block.title}</div>
      {block.summary ? (
        <div style={{ marginTop: 6, fontSize: isDense ? 10 : 11, lineHeight: 1.5, color: "#4b5563", ...clampLines(isDense ? 1 : 2) }}>
          <span style={{ textTransform: "uppercase", letterSpacing: "0.12em", color: theme.accent }}>{block.summary.unitType}</span>
          <span>{` · requested ${block.summary.requestedCount} / resolved ${block.summary.resolvedCount} / filled ${block.summary.filledCount}`}</span>
          <span>{` · partial ${block.summary.partialCount} / unfilled ${block.summary.unfilledCount}`}</span>
          <span>{` · fill rule ${block.summary.fillRule}`}</span>
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isTextOnly ? `repeat(${textSlotColumns}, minmax(0, 1fr))` : undefined,
          gridTemplateRows: `repeat(${textSlotRows}, minmax(0, 1fr))`,
          gap: isDense ? 8 : 10,
          marginTop: 10,
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {block.items.map((item) => {
          if (item.unitType === "text") {
            const textBinding = getSlotBinding(item, "text");
            return (
              <div
                key={item.id}
                style={{
                  minWidth: 0,
                  borderRadius: 18,
                  background: theme.soft,
                  padding: isDense ? 8 : 10,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    borderRadius: 14,
                    minHeight: 0,
                    height: "100%",
                    background: "white",
                    border: `1px dashed ${theme.border}`,
                    padding: isDense ? 8 : 10,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: isDense ? 5 : 6,
                    overflow: "hidden",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isDense ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.accent, ...clampLines(1) }}>{item.unitType}</div>
                    <div style={{ marginTop: 4, fontSize: isDense ? 10 : 11, lineHeight: isDense ? 1.35 : 1.45, color: "#374151", ...clampLines(2) }}>
                      {item.label}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: item.outcome === "filled" ? theme.accent : item.outcome === "partial" ? "#b45309" : "#6b7280", ...clampLines(1) }}>
                      {`outcome · ${formatOutcome(item.outcome)}`}
                    </div>
                    <div style={{ marginTop: 4, fontSize: isDense ? 9 : 10, lineHeight: 1.35, color: textBinding?.source ? "#4b5563" : "#b45309", ...clampLines(1) }}>
                      {textBinding?.source?.label ?? formatMissingReason(textBinding?.missingReason)}
                    </div>
                  </div>
                  <div style={{ fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: "#6b7280", borderTop: `1px solid ${theme.border}`, paddingTop: 5, ...clampLines(1) }}>
                    {`required ${formatBoolean(textBinding?.required ?? false)} · bound ${formatBoolean(textBinding?.bound ?? false)} · filled ${formatBoolean(textBinding?.filled ?? false)}`}
                  </div>
                </div>
              </div>
            );
          }

          const leftBinding = getSlotBinding(item, item.unitType === "chartExplanationPair" ? "chart" : "image");
          const rightBinding = getSlotBinding(item, item.unitType === "chartExplanationPair" ? "explanation" : "text");
          return (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns:
                  item.unitType === "chartExplanationPair"
                    ? "minmax(0, 1.08fr) minmax(0, 0.92fr)"
                    : "minmax(0, 0.92fr) minmax(0, 1.08fr)",
                gap: isDense ? 8 : 10,
                minWidth: 0,
                minHeight: 0,
                height: "100%",
                borderRadius: 18,
                background: theme.soft,
                padding: isDense ? 8 : 10,
                overflow: "hidden",
              }}
            >
            <div
              style={{
                minWidth: 0,
                borderRadius: 14,
                minHeight: 0,
                height: "100%",
                background: "linear-gradient(140deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.65) 100%)",
                border: `1px dashed ${theme.border}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                padding: isDense ? 8 : 10,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <div style={{ fontSize: isDense ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.accent, textAlign: "center", ...clampLines(1) }}>
                {item.chartSlotLabel ?? item.imageSlotLabel ?? "image slot"}
              </div>
              <div style={{ marginTop: 6, fontSize: isDense ? 9 : 10, lineHeight: 1.4, color: leftBinding?.source ? "#4b5563" : "#b45309", textAlign: "center", ...clampLines(1) }}>
                {leftBinding?.source?.label ?? formatMissingReason(leftBinding?.missingReason)}
              </div>
              <div style={{ marginTop: 4, fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: "#94a3b8", textAlign: "center", ...clampLines(1) }}>
                {leftBinding?.slotId ?? "missing-slot-id"}
              </div>
              <div style={{ marginTop: 4, fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: "#6b7280", textAlign: "center", ...clampLines(1) }}>
                {`required ${formatBoolean(leftBinding?.required ?? false)} · bound ${formatBoolean(leftBinding?.bound ?? false)} · filled ${formatBoolean(leftBinding?.filled ?? false)}`}
              </div>
            </div>
            <div
              style={{
                minWidth: 0,
                borderRadius: 14,
                minHeight: 0,
                height: "100%",
                background: "white",
                border: `1px dashed ${theme.border}`,
                padding: isDense ? 8 : 10,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: isDense ? 4 : 5,
                overflow: "hidden",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isDense ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", ...clampLines(1) }}>{item.label}</div>
                <div style={{ marginTop: 3, fontSize: isDense ? 9 : 10, letterSpacing: "0.12em", textTransform: "uppercase", color: theme.accent, ...clampLines(1) }}>{item.unitType}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: item.outcome === "filled" ? theme.accent : item.outcome === "partial" ? "#b45309" : "#6b7280", ...clampLines(1) }}>
                  {`unit outcome · ${formatOutcome(item.outcome)}`}
                </div>
                <div style={{ marginTop: 3, fontSize: isDense ? 10 : 11, lineHeight: isDense ? 1.45 : 1.55, color: "#4b5563", ...clampLines(1) }}>
                  {item.explanationSlotLabel ?? item.textSlotLabel ?? "text slot"}
                </div>
              </div>
              <div style={{ fontSize: isDense ? 9 : 10, lineHeight: 1.4, color: rightBinding?.source ? "#4b5563" : "#b45309", ...clampLines(1) }}>
                {rightBinding?.source?.label ?? formatMissingReason(rightBinding?.missingReason)}
              </div>
              <div style={{ fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: "#94a3b8", ...clampLines(1) }}>
                {rightBinding?.slotId ?? "missing-slot-id"}
              </div>
              <div style={{ fontSize: isDense ? 8 : 9, lineHeight: 1.35, color: "#6b7280", ...clampLines(1) }}>
                {`required ${formatBoolean(rightBinding?.required ?? false)} · bound ${formatBoolean(rightBinding?.bound ?? false)} · filled ${formatBoolean(rightBinding?.filled ?? false)}`}
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function renderBlock(block: PageModelBlock, theme: PageModel["theme"], density: PageRenderDensity) {
  switch (block.type) {
    case "hero":
      return <HeroBlock key={block.id} block={block} theme={theme} density={density} />;
    case "metrics":
      return <MetricsBlock key={block.id} block={block} theme={theme} density={density} />;
    case "rich-text":
      return <RichTextBlock key={block.id} block={block} theme={theme} density={density} />;
    case "bullet-list":
      return <BulletListBlock key={block.id} block={block} theme={theme} density={density} />;
    case "chart":
      return <ChartBlock key={block.id} block={block} theme={theme} density={density} />;
    case "table":
      return <TableBlock key={block.id} block={block} theme={theme} density={density} />;
    case "callout":
      return <CalloutBlock key={block.id} block={block} theme={theme} density={density} />;
    case "signal-list":
      return <SignalListBlock key={block.id} block={block} theme={theme} density={density} />;
    case "visual":
      return <VisualBlock key={block.id} block={block} theme={theme} density={density} />;
    case "content-slots":
      return <ContentSlotsBlock key={block.id} block={block} theme={theme} density={density} />;
    default:
      return null;
  }
}

function getPageRenderDensity(pageModel: PageModel, mainBlocks: PageModelBlock[], asideBlocks: PageModelBlock[]): PageRenderDensity {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;
  const asideTextLoad = asideBlocks.reduce((sum, block) => {
    if (block.type === "bullet-list") {
      return sum + block.items.length;
    }
    if (block.type === "rich-text") {
      return sum + block.paragraphs.length;
    }
    if (block.type === "metrics") {
      return sum + block.items.length;
    }
    return sum;
  }, 0);

  if (pageModel.pageType === "case" && slotCount >= 3) {
    return "compact";
  }

  if (pageModel.pageType === "data" && (slotCount >= 1 || asideTextLoad >= 7)) {
    return "compact";
  }

  if ((pageModel.pageType === "overview" || pageModel.pageType === "summary") && slotCount >= 3) {
    return "compact";
  }

  return "regular";
}

function getOverviewMainColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 3) {
    return "minmax(0, 0.72fr) minmax(0, 0.52fr) minmax(0, 0.86fr)";
  }

  return "minmax(0, 0.84fr) minmax(0, 0.42fr) minmax(0, 0.74fr)";
}

function getOverviewAsideColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 3) {
    return "minmax(0, 0.56fr) minmax(0, 0.62fr) minmax(0, 0.82fr)";
  }

  return "minmax(0, 0.62fr) minmax(0, 0.68fr) minmax(0, 0.74fr)";
}

function getHeroLayout(pageType: PageModel["pageType"]): CSSProperties {
  if (pageType === "overview") {
    return {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.36fr) minmax(0, 0.64fr)",
      gap: 16,
      alignItems: "stretch",
      minHeight: 246,
    };
  }

  if (pageType === "summary") {
    return {
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.42fr) minmax(0, 0.58fr)",
      gap: 16,
      alignItems: "stretch",
      minHeight: 216,
    };
  }

  return {
    display: pageType === "case" ? "grid" : "block",
    gridTemplateColumns: pageType === "case" ? "minmax(0, 1.08fr) minmax(0, 0.92fr)" : undefined,
    gap: pageType === "case" ? 16 : undefined,
    minHeight: 158,
  };
}

function getBodyLayout(pageType: PageModel["pageType"]): CSSProperties {
  if (pageType === "overview") {
    return {
      marginTop: 18,
      flex: 1,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.28fr) minmax(0, 0.72fr)",
      gap: 16,
      alignItems: "stretch",
      minHeight: 0,
    };
  }

  if (pageType === "case") {
    return {
      marginTop: 18,
      flex: 1,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.24fr) minmax(0, 0.76fr)",
      gap: 16,
      alignItems: "stretch",
      minHeight: 0,
    };
  }

  if (pageType === "summary") {
    return {
      marginTop: 18,
      flex: 1,
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.22fr) minmax(0, 0.78fr)",
      gap: 16,
      alignItems: "stretch",
      minHeight: 0,
    };
  }

  return {
    marginTop: 18,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.46fr) minmax(0, 0.54fr)",
    gap: 16,
    alignItems: "stretch",
    minHeight: 0,
  };
}

function getCaseMainColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 3) {
    return "minmax(0, 0.42fr) minmax(0, 1.18fr) minmax(0, 0.4fr)";
  }

  if (slotCount === 2) {
    return "minmax(0, 0.46fr) minmax(0, 1.02fr) minmax(0, 0.46fr)";
  }

  return "minmax(0, 0.5fr) minmax(0, 0.9fr) minmax(0, 0.5fr)";
}

function getCaseAsideColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 3) {
    return "minmax(0, 0.56fr) minmax(0, 0.7fr) minmax(0, 0.56fr)";
  }

  return "minmax(0, 0.6fr) minmax(0, 0.76fr) minmax(0, 0.64fr)";
}

function getDataMainColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 1) {
    return "minmax(0, 0.98fr) minmax(0, 0.42fr) minmax(0, 0.32fr) minmax(0, 0.48fr)";
  }

  return "minmax(0, 1.08fr) minmax(0, 0.48fr) minmax(0, 0.36fr) minmax(0, 0.56fr)";
}

function getDataAsideColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 1) {
    return "minmax(0, 0.72fr) minmax(0, 0.56fr) minmax(0, 0.94fr)";
  }

  return "minmax(0, 0.8fr) minmax(0, 0.62fr) minmax(0, 0.78fr)";
}

function getSummaryMainColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 3) {
    return "minmax(0, 0.82fr) minmax(0, 0.5fr) minmax(0, 0.68fr)";
  }

  return "minmax(0, 0.96fr) minmax(0, 0.4fr) minmax(0, 0.64fr)";
}

function getSummaryAsideColumnRows(mainBlocks: PageModelBlock[]) {
  const slotsBlock = mainBlocks.find((block) => block.type === "content-slots");
  const slotCount = slotsBlock?.type === "content-slots" ? slotsBlock.items.length : 0;

  if (slotCount >= 3) {
    return "minmax(0, 0.72fr) minmax(0, 0.56fr) minmax(0, 0.52fr)";
  }

  return "minmax(0, 0.8fr) minmax(0, 0.62fr) minmax(0, 0.58fr)";
}

export function PageModelRenderer({ pageModel }: { pageModel: PageModel }) {
  const heroRegion = pageModel.regions.find((region) => region.name === "hero");
  const mainRegion = pageModel.regions.find((region) => region.name === "main");
  const asideRegion = pageModel.regions.find((region) => region.name === "aside");
  const heroBlocks = heroRegion?.blocks ?? [];
  const mainBlocks = mainRegion?.blocks ?? [];
  const asideBlocks = asideRegion?.blocks ?? [];
  const density = getPageRenderDensity(pageModel, mainBlocks, asideBlocks);

  return (
    <article
      style={{
        width: PAGE_MODEL_BASE_WIDTH,
        height: PAGE_MODEL_BASE_HEIGHT,
        border: `1px solid ${pageModel.theme.border}`,
        borderRadius: 28,
        background: "white",
        padding: density === "compact" ? 24 : 28,
        boxShadow: "0 18px 34px rgba(15,23,42,0.06)",
        fontFamily: "'Avenir Next','PingFang SC','Noto Sans SC',sans-serif",
        color: pageModel.theme.ink,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      data-page-model-type={pageModel.pageType}
      data-layout-key={pageModel.layoutKey}
    >
      {pageModel.pageType === "overview" ? (
        <>
          {heroBlocks.length ? <div style={{ ...getHeroLayout(pageModel.pageType), minWidth: 0 }}>{heroBlocks.map((block) => renderBlock(block, pageModel.theme, density))}</div> : null}
          <section style={getBodyLayout(pageModel.pageType)}>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getOverviewMainColumnRows(mainBlocks),
              }}
            >
              {mainBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getOverviewAsideColumnRows(mainBlocks),
              }}
            >
              {asideBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
          </section>
        </>
      ) : pageModel.pageType === "case" ? (
        <>
          {heroBlocks.length ? <div style={{ ...getHeroLayout(pageModel.pageType), minWidth: 0 }}>{heroBlocks.map((block) => renderBlock(block, pageModel.theme, density))}</div> : null}
          <section style={getBodyLayout(pageModel.pageType)}>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getCaseMainColumnRows(mainBlocks),
              }}
            >
              {mainBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getCaseAsideColumnRows(mainBlocks),
              }}
            >
              {asideBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
          </section>
        </>
      ) : pageModel.pageType === "summary" ? (
        <>
          {heroBlocks.length ? <div style={{ ...getHeroLayout(pageModel.pageType), minWidth: 0 }}>{heroBlocks.map((block) => renderBlock(block, pageModel.theme, density))}</div> : null}
          <section style={getBodyLayout(pageModel.pageType)}>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getSummaryMainColumnRows(mainBlocks),
              }}
            >
              {mainBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getSummaryAsideColumnRows(mainBlocks),
              }}
            >
              {asideBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
          </section>
        </>
      ) : (
        <>
          {heroBlocks[0] ? <div>{renderBlock(heroBlocks[0], pageModel.theme, density)}</div> : null}
          <section style={getBodyLayout(pageModel.pageType)}>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getDataMainColumnRows(mainBlocks),
              }}
            >
              {mainBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
            <div
              style={{
                display: "grid",
                gap: 16,
                minHeight: 0,
                minWidth: 0,
                height: "100%",
                gridTemplateRows: getDataAsideColumnRows(mainBlocks),
              }}
            >
              {asideBlocks.map((block) => renderBlock(block, pageModel.theme, density))}
            </div>
          </section>
        </>
      )}
    </article>
  );
}

export function PageModelPreview({
  pageModel,
  maxWidth,
}: {
  pageModel: PageModel;
  maxWidth: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(maxWidth);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextWidth = Math.min(maxWidth, entry.contentRect.width);
      setPreviewWidth(nextWidth > 0 ? nextWidth : maxWidth);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [maxWidth]);

  const safeWidth = Math.max(1, previewWidth);
  const scale = safeWidth / PAGE_MODEL_BASE_WIDTH;
  const previewHeight = Math.round(PAGE_MODEL_BASE_HEIGHT * scale);

  return (
    <div
      ref={hostRef}
      style={{
        width: "100%",
        maxWidth,
        height: previewHeight,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: PAGE_MODEL_BASE_WIDTH,
          height: PAGE_MODEL_BASE_HEIGHT,
          position: "absolute",
          inset: 0,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <PageModelRenderer pageModel={pageModel} />
      </div>
    </div>
  );
}

export function renderPageModelToHtml(pageModel: PageModel) {
  return renderToStaticMarkup(<PageModelRenderer pageModel={pageModel} />);
}
