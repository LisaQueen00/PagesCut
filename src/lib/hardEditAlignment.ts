import type { HardEditEditableElement, HardEditSourceAlignmentStatus, HardEditSourceReference } from "@/types/domain";

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function createSourceAlignmentSnapshot(value: string, sourceReferences?: HardEditSourceReference[]) {
  if (!sourceReferences?.length) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

export function resolveHardEditSourceAlignment(element: Pick<HardEditEditableElement, "value" | "sourceReferences" | "sourceAlignmentSnapshot">): {
  status: HardEditSourceAlignmentStatus;
  note: string;
} {
  if (!element.sourceReferences?.length) {
    return {
      status: "unknown",
      note: "当前元素尚未挂接 formal source object。",
    };
  }

  if (!element.sourceAlignmentSnapshot?.trim()) {
    return {
      status: "unknown",
      note: "当前缺少来源对齐快照，暂时无法稳定判断。",
    };
  }

  if (normalizeComparableText(element.value) === normalizeComparableText(element.sourceAlignmentSnapshot)) {
    return {
      status: "aligned",
      note: "当前值仍与来源链生成时的初始快照一致。",
    };
  }

  return {
    status: "edited",
    note: "当前值已偏离来源链生成时的初始快照。",
  };
}

export function hydrateHardEditEditableElementAlignment(element: HardEditEditableElement): HardEditEditableElement {
  const resolved = resolveHardEditSourceAlignment(element);

  return {
    ...element,
    sourceAlignmentStatus: resolved.status,
    sourceAlignmentNote: resolved.note,
  };
}
