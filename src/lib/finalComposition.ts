import type { EditedCompositionPageResult, FinalComposition, FinalCompositionPage } from "@/types/domain";

function orderByIdList(pages: FinalCompositionPage[], ids: string[]) {
  const pageMap = new Map(pages.map((page) => [page.id, page] as const));
  return ids.map((id) => pageMap.get(id)).filter((page): page is FinalCompositionPage => Boolean(page));
}

export function getOrderedCompositionPages(composition: FinalComposition | undefined, pages: FinalCompositionPage[]) {
  if (!composition) {
    return pages.slice().sort((a, b) => a.orderIndex - b.orderIndex);
  }

  const ordered = orderByIdList(pages, composition.orderedCompositionPageIds);
  if (ordered.length === pages.length) {
    return ordered;
  }

  const orderedIds = new Set(ordered.map((page) => page.id));
  const remaining = pages.filter((page) => !orderedIds.has(page.id)).sort((a, b) => a.orderIndex - b.orderIndex);
  return [...ordered, ...remaining];
}

export function getGroupedCompositionPages(composition: FinalComposition | undefined, pages: FinalCompositionPage[]) {
  if (!composition) {
    const ordered = getOrderedCompositionPages(undefined, pages);
    return {
      front: ordered.filter((page) => page.pageBucket === "front"),
      content: ordered.filter((page) => page.pageBucket === "content"),
      rear: ordered.filter((page) => page.pageBucket === "rear"),
    };
  }

  return {
    front: orderByIdList(pages, composition.frontCompositionPageIds),
    content: orderByIdList(pages, composition.contentCompositionPageIds),
    rear: orderByIdList(pages, composition.rearCompositionPageIds),
  };
}

export function mergeCompositionPageWithEditedResult(
  page: FinalCompositionPage,
  editedResult:
    | Pick<
        EditedCompositionPageResult,
        "compositionPageId" | "previewHtml" | "title" | "subtitle" | "bodyText" | "imageCaption" | "chartCaption" | "footerNote"
      >
    | undefined,
) {
  if (!editedResult || editedResult.compositionPageId !== page.id) {
    return page;
  }

  return {
    ...page,
    previewHtml: editedResult.previewHtml || page.previewHtml,
  };
}
