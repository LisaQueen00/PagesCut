import type { EditedCompositionPageResult, FinalCompositionPage, HardEditSourceAlignmentStatus } from "@/types/domain";

export interface PageSourceAlignmentSummary {
  status: HardEditSourceAlignmentStatus;
  aligned: number;
  edited: number;
  unknown: number;
  sourceAware: number;
  total: number;
  note: string;
}

export interface CompositionSourceAlignmentSummary {
  aligned: number;
  edited: number;
  unknown: number;
  total: number;
}

export interface CompositionSourceAlignmentInsight {
  title: string;
  detail: string;
  recommendation: string;
  tone: "aligned" | "edited" | "unknown" | "mixed";
}

export interface PageSourceAlignmentMarker {
  page: FinalCompositionPage;
  summary: PageSourceAlignmentSummary;
}

export function getPageSourceAlignmentSummary(editedResult: EditedCompositionPageResult | undefined): PageSourceAlignmentSummary {
  const elements = editedResult?.editableElements ?? [];
  const sourceAwareElements = elements.filter((element) => element.sourceReferences?.length);
  const aligned = sourceAwareElements.filter((element) => element.sourceAlignmentStatus === "aligned").length;
  const edited = sourceAwareElements.filter((element) => element.sourceAlignmentStatus === "edited").length;
  const unknown = sourceAwareElements.filter((element) => element.sourceAlignmentStatus === "unknown" || !element.sourceAlignmentStatus).length;

  if (!editedResult) {
    return {
      status: "unknown",
      aligned,
      edited,
      unknown,
      sourceAware: sourceAwareElements.length,
      total: elements.length,
      note: "当前页尚未形成 edited result，结果层暂无法读取来源关系状态。",
    };
  }

  if (!sourceAwareElements.length) {
    return {
      status: "unknown",
      aligned,
      edited,
      unknown,
      sourceAware: 0,
      total: elements.length,
      note: "当前页没有可汇总的来源感知元素。",
    };
  }

  if (edited > 0) {
    return {
      status: "edited",
      aligned,
      edited,
      unknown,
      sourceAware: sourceAwareElements.length,
      total: elements.length,
      note: `${edited} 个来源感知元素已偏离来源链初始结果。`,
    };
  }

  if (unknown > 0) {
    return {
      status: "unknown",
      aligned,
      edited,
      unknown,
      sourceAware: sourceAwareElements.length,
      total: elements.length,
      note: `${unknown} 个来源感知元素缺少稳定对齐状态。`,
    };
  }

  return {
    status: "aligned",
    aligned,
    edited,
    unknown,
    sourceAware: sourceAwareElements.length,
    total: elements.length,
    note: "当前来源感知元素仍与来源链初始结果保持对齐。",
  };
}

export function getCompositionSourceAlignmentSummary(
  pages: FinalCompositionPage[],
  editedResultMap: Map<string, EditedCompositionPageResult>,
): CompositionSourceAlignmentSummary {
  return pages.reduce(
    (summary, page) => {
      const pageSummary = getPageSourceAlignmentSummary(editedResultMap.get(page.id));
      summary[pageSummary.status] += 1;
      summary.total += 1;
      return summary;
    },
    { aligned: 0, edited: 0, unknown: 0, total: 0 },
  );
}

export function getCompositionSourceAlignmentInsight(summary: CompositionSourceAlignmentSummary): CompositionSourceAlignmentInsight {
  if (summary.total === 0) {
    return {
      title: "暂无可判断页面",
      detail: "当前 Final Composition 尚未形成可汇总的页面结果。",
      recommendation: "请先完成页面确认与硬编辑保存，再查看来源关系提示。",
      tone: "unknown",
    };
  }

  if (summary.edited > 0 && summary.unknown > 0) {
    return {
      title: "存在人工编辑与未知来源页面",
      detail: `${summary.edited} 页已偏离来源链初始结果，${summary.unknown} 页暂缺稳定来源关系。`,
      recommendation: "导出不会被拦截；建议重点回看 edited 与 unknown 页面，确认这些变化符合最终交付意图。",
      tone: "mixed",
    };
  }

  if (summary.edited > 0) {
    return {
      title: "存在人工编辑页面",
      detail: `${summary.edited} 页已偏离来源链初始结果，${summary.aligned} 页仍保持来源对齐。`,
      recommendation: "导出不会被拦截；建议在导出前确认这些人工编辑是预期修改。",
      tone: "edited",
    };
  }

  if (summary.unknown > 0) {
    return {
      title: "存在来源关系未知页面",
      detail: `${summary.unknown} 页暂缺稳定来源关系，通常来自未保存 edited result、无来源感知元素或包装页。`,
      recommendation: "导出不会被拦截；如果需要更明确的来源判断，可回到 Hard Edit 保存相关内容页后再导出。",
      tone: "unknown",
    };
  }

  return {
    title: "来源关系保持对齐",
    detail: `${summary.aligned} 页的来源感知元素仍与来源链初始结果保持对齐。`,
    recommendation: "当前来源关系提示未发现人工偏离；仍可按需继续导出。",
    tone: "aligned",
  };
}

export function getPagesBySourceAlignmentStatus(
  pages: FinalCompositionPage[],
  editedResultMap: Map<string, EditedCompositionPageResult>,
  status: HardEditSourceAlignmentStatus,
): PageSourceAlignmentMarker[] {
  return pages
    .map((page) => ({
      page,
      summary: getPageSourceAlignmentSummary(editedResultMap.get(page.id)),
    }))
    .filter((item) => item.summary.status === status);
}

export function getSourceAlignmentStatusLabel(status: HardEditSourceAlignmentStatus) {
  if (status === "aligned") {
    return "来源对齐";
  }

  if (status === "edited") {
    return "已人工编辑";
  }

  return "来源未知";
}

export function getSourceAlignmentStatusTone(status: HardEditSourceAlignmentStatus) {
  if (status === "aligned") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "edited") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-[#eef2f7] text-muted";
}
