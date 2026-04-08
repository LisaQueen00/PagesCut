import type { Page } from "@/types/domain";
import type { ChartBriefSource, ImageSourceAsset, PageSourceSet, TextSourceFragment } from "@/types/pageModel";

function clampText(value: string, limit: number, fallback = "") {
  const trimmed = value.trim() || fallback;
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}...` : trimmed;
}

export function createPageSourceSet(page: Page): PageSourceSet {
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

  const textFragments = [...explicitTextFragments];
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

  return {
    id: `${page.id}-source-set`,
    pageId: page.id,
    sourceVersion: "v1-minimal-pair-and-text-sources",
    createdFrom: "userProvidedContentBlocks+pageDefinition",
    textFragments,
    imageAssets,
    chartBriefs,
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
