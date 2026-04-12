import type { Page } from "@/types/domain";
import type { ChartBriefSource, ImageSourceAsset, PageSourceSet, TextSourceFragment } from "@/types/pageModel";
import type { GeneratedTextDraftResult } from "@/services/providers/types";

function clampText(value: string, limit: number, fallback = "") {
  const trimmed = value.trim() || fallback;
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}

function createRemoteImageSearchUrl(query: string) {
  const normalizedQuery = query
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safeQuery = normalizedQuery || "editorial magazine visual";

  return `https://source.unsplash.com/1200x800/?${encodeURIComponent(safeQuery)}`;
}

export interface CreatePageSourceSetOptions {
  generatedTextFragments?: TextSourceFragment[];
}

export function createOverviewOllamaTextFragments(page: Page, draft: GeneratedTextDraftResult): TextSourceFragment[] {
  return draft.fragments.map((fragment, index) => ({
    id: `${page.id}-overview-ollama-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "overviewOllamaDraft",
    sourceBlockId: draft.sourceId,
    label: clampText(fragment.label, 26, `ollama ${draft.model} draft ${index + 1}`),
    sourceRole: fragment.role,
    text: fragment.text,
  }));
}

export function createSummaryOllamaTextFragments(page: Page, draft: GeneratedTextDraftResult): TextSourceFragment[] {
  return draft.fragments.map((fragment, index) => ({
    id: `${page.id}-summary-ollama-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "summaryOllamaDraft",
    sourceBlockId: draft.sourceId,
    label: clampText(fragment.label, 26, `ollama ${draft.model} summary ${index + 1}`),
    sourceRole: fragment.role,
    text: fragment.text,
  }));
}

export function createDataOllamaTextFragments(page: Page, draft: GeneratedTextDraftResult): TextSourceFragment[] {
  return draft.fragments.map((fragment, index) => ({
    id: `${page.id}-data-ollama-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "dataOllamaDraft",
    sourceBlockId: draft.sourceId,
    label: clampText(fragment.label, 26, `ollama ${draft.model} data ${index + 1}`),
    sourceRole: fragment.role,
    text: fragment.text,
  }));
}

export function createCaseOllamaTextFragments(page: Page, draft: GeneratedTextDraftResult): TextSourceFragment[] {
  return draft.fragments.map((fragment, index) => ({
    id: `${page.id}-case-ollama-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "caseOllamaDraft",
    sourceBlockId: draft.sourceId,
    label: clampText(fragment.label, 26, `ollama ${draft.model} case ${index + 1}`),
    sourceRole: fragment.role,
    text: fragment.text,
  }));
}

export function createFeatureOllamaTextFragments(page: Page, draft: GeneratedTextDraftResult): TextSourceFragment[] {
  return draft.fragments.map((fragment, index) => ({
    id: `${page.id}-feature-ollama-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "featureOllamaDraft",
    sourceBlockId: draft.sourceId,
    label: clampText(fragment.label, 26, `ollama ${draft.model} feature ${index + 1}`),
    sourceRole: fragment.role,
    text: fragment.text,
  }));
}

export function createPageSourceSet(page: Page, options: CreatePageSourceSetOptions = {}): PageSourceSet {
  const explicitTextFragments: TextSourceFragment[] = page.userProvidedContentBlocks
    .filter((block): block is Extract<Page["userProvidedContentBlocks"][number], { type: "text" }> => block.type === "text")
    .map((block, index) => ({
      id: `${page.id}-text-fragment-${index + 1}`,
      pageId: page.id,
      origin: "user-block" as const,
      text: block.text.trim(),
      label: clampText(block.text, 26, `text source ${index + 1}`),
      sourceBlockId: block.id,
    }))
    .filter((item) => item.text);

  const syntheticTextFragments = [
    { field: "outlineText" as const, value: page.outlineText },
    { field: "styleText" as const, value: page.styleText },
    { field: "userConstraints" as const, value: page.userConstraints },
  ]
    .map((item, index) => {
      const text = item.value.trim();
      if (!text) {
        return null;
      }

      return {
        id: `${page.id}-synthetic-text-${index + 1}`,
        pageId: page.id,
        origin: "synthetic" as const,
        text,
        label: clampText(text, 26, `text source ${index + 1}`),
        sourceField: item.field,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const textFragments = [
    ...(options.generatedTextFragments ?? []),
    ...explicitTextFragments,
  ];
  syntheticTextFragments.forEach((item) => {
    if (!textFragments.some((existing) => existing.text === item.text)) {
      textFragments.push(item);
    }
  });

  const imageAssets: ImageSourceAsset[] = page.userProvidedContentBlocks
    .filter((block): block is Extract<Page["userProvidedContentBlocks"][number], { type: "image" }> => block.type === "image")
    .map((block, index) => ({
      id: `${page.id}-image-asset-${index + 1}`,
      pageId: page.id,
      origin: "user-block",
      sourceBlockId: block.id,
      imageUrl: block.imageUrl,
      altText: block.altText,
      caption: block.caption,
      label: block.caption || block.altText || `image source ${index + 1}`,
    }));
  const generatedImageAssets: ImageSourceAsset[] = textFragments
    .filter((fragment) => fragment.sourceField === "caseOllamaDraft" && fragment.sourceRole === "caseVisualBrief")
    .map((fragment, index) => ({
      id: `${page.id}-generated-image-asset-${index + 1}`,
      pageId: page.id,
      origin: "synthetic",
      sourceBlockId: fragment.sourceBlockId,
      sourceRole: fragment.sourceRole,
      imageUrl: createRemoteImageSearchUrl(fragment.text),
      altText: fragment.text,
      caption: fragment.text,
      label: clampText(fragment.label, 26, `generated visual intent ${index + 1}`),
    }));

  const chartBriefs: ChartBriefSource[] = page.userProvidedContentBlocks
    .filter((block): block is Extract<Page["userProvidedContentBlocks"][number], { type: "chart_desc" }> => block.type === "chart_desc")
    .map((block, index) => ({
      id: `${page.id}-chart-brief-${index + 1}`,
      pageId: page.id,
      origin: "user-block",
      sourceBlockId: block.id,
      description: block.description,
      chartTypeHint: block.chartTypeHint,
      label: clampText(block.description, 26, `chart source ${index + 1}`),
    }));
  const generatedChartBriefs: ChartBriefSource[] = textFragments
    .filter((fragment) => fragment.sourceField === "dataOllamaDraft" && fragment.sourceRole === "dataChartBrief")
    .map((fragment, index) => ({
      id: `${page.id}-generated-chart-brief-${index + 1}`,
      pageId: page.id,
      origin: "synthetic",
      sourceBlockId: fragment.sourceBlockId,
      sourceRole: fragment.sourceRole,
      description: fragment.text,
      chartTypeHint: "bar",
      label: clampText(fragment.label, 26, `generated chart brief ${index + 1}`),
    }));

  return {
    id: `${page.id}-source-set`,
    pageId: page.id,
    sourceVersion: "v1-minimal-pair-and-text-sources",
    createdFrom: options.generatedTextFragments?.length
      ? "userProvidedContentBlocks+pageDefinition+generatedTextFragments"
      : "userProvidedContentBlocks+pageDefinition",
    textFragments,
    imageAssets: [...imageAssets, ...generatedImageAssets],
    chartBriefs: [...chartBriefs, ...generatedChartBriefs],
  };
}

export function getTextSourceFragmentById(pageSourceSet: PageSourceSet | null | undefined, sourceId: string | undefined) {
  if (!pageSourceSet || !sourceId) {
    return undefined;
  }

  return pageSourceSet.textFragments.find((item) => item.id === sourceId);
}

export function getImageSourceAssetById(pageSourceSet: PageSourceSet | null | undefined, sourceId: string | undefined) {
  if (!pageSourceSet || !sourceId) {
    return undefined;
  }

  return pageSourceSet.imageAssets.find((item) => item.id === sourceId);
}

export function getChartBriefSourceById(pageSourceSet: PageSourceSet | null | undefined, sourceId: string | undefined) {
  if (!pageSourceSet || !sourceId) {
    return undefined;
  }

  return pageSourceSet.chartBriefs.find((item) => item.id === sourceId);
}
