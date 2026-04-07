import { isRenderablePreviewHtml, isValidTaskVersion } from "@/lib/versionValidation";
import type { EditedCompositionPageResult, FinalComposition, FinalCompositionPage, PackagingPageCandidate, Page, PageVersion } from "@/types/domain";

export function canEnterCandidatesStage(contentPages: Page[]) {
  if (!contentPages.length) {
    return false;
  }

  return contentPages.every((page) => page.outlineText.trim().length > 0 && page.isSaved);
}

export function canEnterPackagingStage(contentPages: Page[], versions: PageVersion[]) {
  return versions.some((version) => version.isApproved && isValidTaskVersion(version, contentPages));
}

export function canEnterHardEditStage(
  contentPages: Page[],
  packagingPages: Page[],
  versions: PageVersion[],
  packagingCandidates: PackagingPageCandidate[],
) {
  const approvedVersion = versions.find((version) => version.isApproved);
  if (!approvedVersion || !isValidTaskVersion(approvedVersion, contentPages)) {
    return false;
  }

  if (!packagingPages.length) {
    return false;
  }

  return packagingPages.every((page) => {
    const approvedCandidate = packagingCandidates.find((candidate) => candidate.pageId === page.id && candidate.isApproved);
    return Boolean(approvedCandidate) && isRenderablePreviewHtml(approvedCandidate?.previewHtml);
  });
}

export function canEnterExportStage(
  composition: FinalComposition | undefined,
  compositionPages: FinalCompositionPage[],
  editedResults: EditedCompositionPageResult[],
) {
  if (!composition) {
    return false;
  }

  if (!composition.orderedCompositionPageIds.length || compositionPages.length !== composition.orderedCompositionPageIds.length) {
    return false;
  }

  const compositionPageMap = new Map(compositionPages.map((page) => [page.id, page] as const));
  const editedResultMap = new Map(editedResults.map((result) => [result.compositionPageId, result] as const));

  return composition.orderedCompositionPageIds.every((compositionPageId) => {
    const page = compositionPageMap.get(compositionPageId);
    if (!page) {
      return false;
    }

    return getCompositionPageResultSourceKind(page, editedResultMap.get(compositionPageId)) !== "unavailable";
  });
}

export function getCompositionPageResultSourceKind(
  page: FinalCompositionPage,
  editedResult?: EditedCompositionPageResult,
): "edited-result" | "composition-default" | "unavailable" {
  if (editedResult?.compositionPageId === page.id) {
    if (page.pageKind === "content" && editedResult.editedPageModel) {
      return "edited-result";
    }

    if (page.pageKind === "packaging" && editedResult.editedPackagingPage) {
      return "edited-result";
    }

    if (isRenderablePreviewHtml(editedResult.previewHtml)) {
      return "edited-result";
    }
  }

  if (page.pageKind === "content" && page.sourcePageModel) {
    return "composition-default";
  }

  if (page.pageKind === "packaging" && page.sourcePackagingPage) {
    return "composition-default";
  }

  if (isRenderablePreviewHtml(page.previewHtml)) {
    return "composition-default";
  }

  return "unavailable";
}
