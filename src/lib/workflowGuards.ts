import { isRenderablePreviewHtml, isValidTaskVersion } from "@/lib/versionValidation";
import type { FinalComposition, FinalCompositionPage, HardEditPageDraft, PackagingPageCandidate, Page, PageVersion } from "@/types/domain";

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
  hardEditDrafts: HardEditPageDraft[],
) {
  if (!composition) {
    return false;
  }

  if (!composition.orderedCompositionPageIds.length || compositionPages.length !== composition.orderedCompositionPageIds.length) {
    return false;
  }

  return composition.orderedCompositionPageIds.every((compositionPageId) => {
    const draft = hardEditDrafts.find((item) => item.compositionPageId === compositionPageId);
    return Boolean(draft) && !draft?.isDirty;
  });
}
