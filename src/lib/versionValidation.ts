import type { Page, PageVersion } from "@/types/domain";

function hasRenderablePreview(value: unknown) {
  return typeof value === "string" && value.trim().length > 120 && value.includes("<article");
}

export function isRenderablePreviewHtml(value: unknown) {
  return hasRenderablePreview(value);
}

export function isValidTaskVersion(version: PageVersion, contentPages: Page[]) {
  if (!version.versionLabel.trim() || !version.variantSummary.trim()) {
    return false;
  }

  if (!contentPages.length) {
    return false;
  }

  return contentPages.every((page) => hasRenderablePreview(version.previewsByPageId[page.id]));
}

export function hasValidApprovedTaskVersion(versions: PageVersion[], contentPages: Page[]) {
  return versions.some((version) => version.isApproved && isValidTaskVersion(version, contentPages));
}
