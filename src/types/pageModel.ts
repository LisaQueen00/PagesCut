export const PAGE_MODEL_PRIMARY_PAGE_TYPES = ["overview", "data", "case", "summary"] as const;
export type SupportedPageType = (typeof PAGE_MODEL_PRIMARY_PAGE_TYPES)[number];
export type PageModelSourceKind = "generated" | "manual";
export type PageModelAspectRatio = "a4";
export type PageIntentExpressionMode = "text-led" | "image-text" | "chart-led" | "mixed";
export type PageIntentPriority = "low" | "medium" | "high";
export type PageIntentContentArea = "visual" | "chart" | "table" | "metrics" | "narrative";
export type PageContentUnitType =
  | "image"
  | "text"
  | "chart"
  | "metric"
  | "table"
  | "imageTextPair"
  | "chartExplanationPair";
export type PageContentUnitRelation = "standalone" | "paired" | "grouped";
export type PageContentSlotType = "image" | "text" | "chart" | "explanation";
export type PageContentSourceKind = "image-source" | "text-source" | "chart-source" | "explanation-source";
export type PageContentMissingReason =
  | "missing-image-source"
  | "missing-text-source"
  | "missing-chart-source"
  | "missing-explanation-source";

export interface PageModelTheme {
  accent: string;
  soft: string;
  border: string;
  ink: string;
}

export interface PageIntent {
  pageId: string;
  pageType: SupportedPageType;
  expressionMode: PageIntentExpressionMode;
  visualPriority: PageIntentPriority;
  textDensity: PageIntentPriority;
  preferredImageCount: number;
  preferredChartCount: number;
  requiredContentAreas: PageIntentContentArea[];
  allowDegrade: boolean;
}

export interface PageContentSourceRef {
  sourceId: string;
  sourceKind: PageContentSourceKind;
  label: string;
}

export interface PageContentSlotBinding {
  slotType: PageContentSlotType;
  source?: PageContentSourceRef;
  missingReason?: PageContentMissingReason;
}

export interface PageContentUnitBinding {
  unitId: string;
  unitType: PageContentUnitType;
  bindings: PageContentSlotBinding[];
}

export interface PageContentPlanUnit {
  id: string;
  unitType: PageContentUnitType;
  relation: PageContentUnitRelation;
  requestedCount: number;
  resolvedCount: number;
  filledCount: number;
  required: boolean;
  allowDegrade: boolean;
  bindings?: PageContentUnitBinding[];
}

export interface PageContentPlan {
  pageId: string;
  pageType: SupportedPageType;
  units: PageContentPlanUnit[];
}

export interface PageModelMetricItem {
  id: string;
  label: string;
  value: string;
  detail: string;
}

export interface PageModelChartDatum {
  id: string;
  label: string;
  value: number;
}

export interface PageModelTableData {
  columns: string[];
  rows: string[][];
}

export type PageModelBlock =
  | {
      id: string;
      type: "hero";
      eyebrow: string;
      title: string;
      summary: string;
    }
  | {
      id: string;
      type: "metrics";
      title: string;
      items: PageModelMetricItem[];
    }
  | {
      id: string;
      type: "rich-text";
      title: string;
      paragraphs: string[];
    }
  | {
      id: string;
      type: "bullet-list";
      title: string;
      items: string[];
    }
  | {
      id: string;
      type: "chart";
      title: string;
      series: PageModelChartDatum[];
    }
  | {
      id: string;
      type: "table";
      title: string;
      data: PageModelTableData;
    }
  | {
      id: string;
      type: "callout";
      title: string;
      body: string;
    }
  | {
      id: string;
      type: "signal-list";
      title: string;
      items: {
        id: string;
        heading: string;
        detail: string;
      }[];
    }
  | {
      id: string;
      type: "visual";
      title: string;
      caption: string;
      kicker: string;
    }
  | {
      id: string;
      type: "content-slots";
      title: string;
      summary?: {
        unitType: PageContentUnitType;
        requestedCount: number;
        resolvedCount: number;
        filledCount: number;
      };
      items: {
        id: string;
        unitType: PageContentUnitType;
        label: string;
        imageSlotLabel?: string;
        textSlotLabel?: string;
        chartSlotLabel?: string;
        explanationSlotLabel?: string;
        slotBindings?: PageContentSlotBinding[];
      }[];
    };

export interface PageModelRegion {
  id: string;
  name: "hero" | "main" | "aside";
  blocks: PageModelBlock[];
}

export interface PageModel {
  id: string;
  pageType: SupportedPageType;
  // layoutKey currently identifies the page's composition rhythm inside the
  // shared PageModel system. It is not just a visual skin token.
  layoutKey: string;
  sourceKind: PageModelSourceKind;
  aspectRatio: PageModelAspectRatio;
  theme: PageModelTheme;
  regions: PageModelRegion[];
}

export interface GeneratedOverviewContractInput {
  sourceKind: "generated";
  pageType: "overview";
  pageId: string;
  versionLabel: string;
  title: string;
  outline: string;
  tone: string;
  openingNote: string;
  highlights: string[];
  signalItems: {
    heading: string;
    detail: string;
  }[];
  signalMetrics: PageModelMetricItem[];
  viewpointCards: string[];
  supportPoints: string[];
}

export interface ManualDataContractInput {
  sourceKind: "manual";
  pageType: "data";
  pageId: string;
  versionLabel: string;
  title: string;
  summary: string;
  metrics: PageModelMetricItem[];
  chartTitle: string;
  chartSeries: PageModelChartDatum[];
  chartSummary: string;
  chartExplanationPairs: {
    label: string;
    chartSlotLabel: string;
    explanationSlotLabel: string;
    slotBindings: PageContentSlotBinding[];
  }[];
  chartExplanationPairStatus: {
    requestedCount: number;
    resolvedCount: number;
    filledCount: number;
  };
  tableTitle: string;
  table: PageModelTableData;
  sourceNote: string;
  sourceLines: string[];
  dataTakeaways: string[];
  notes: string[];
}

export interface GeneratedCaseContractInput {
  sourceKind: "generated";
  pageType: "case";
  pageId: string;
  versionLabel: string;
  title: string;
  subject: string;
  scenario: string;
  challenge: string;
  actionSteps: string[];
  resultSummary: string;
  takeaway: string;
  visualCaption: string;
  imageTextPairs: {
    label: string;
    imageSlotLabel: string;
    textSlotLabel: string;
    slotBindings: PageContentSlotBinding[];
  }[];
  imageTextPairStatus: {
    requestedCount: number;
    resolvedCount: number;
    filledCount: number;
  };
  outcomeMetrics: PageModelMetricItem[];
}

export interface GeneratedSummaryContractInput {
  sourceKind: "generated";
  pageType: "summary";
  pageId: string;
  versionLabel: string;
  title: string;
  finalJudgment: string;
  conclusionPoints: {
    heading: string;
    detail: string;
  }[];
  recommendations: string[];
  cautions: string[];
  closingNote: string;
  evidenceMetrics: PageModelMetricItem[];
}

export type LayoutContract =
  | GeneratedOverviewContractInput
  | ManualDataContractInput
  | GeneratedCaseContractInput
  | GeneratedSummaryContractInput;

// `visual` is currently a coarse-grained narrative block for case pages.
// It is intentionally kept broad in V1.1 so the chain can validate narrative
// pages without prematurely splitting image / collage / scene blocks.
