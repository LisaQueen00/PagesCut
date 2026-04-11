import type { Page } from "@/types/domain";
import type { TextSourceFragment } from "@/types/pageModel";

function clampText(value: string, limit: number, fallback = "") {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
}

function normalizeTopic(value: string, fallback: string) {
  return clampText(
    value
      .replace(/^(围绕|关于|总结|建立|生成|制作|收束)/, "")
      .replace(/[。！？!?\n].*$/, "")
      .trim(),
    34,
    fallback,
  );
}

export function createSummaryGeneratedDraftFragments(page: Page): TextSourceFragment[] {
  if (page.pageRole !== "summary" && !page.pageType.includes("总结")) {
    return [];
  }

  const topic = normalizeTopic(page.outlineText, page.pageType);
  const style = page.styleText.trim() || "保持克制、清楚、可带走的结论表达";
  const boundary = page.userConstraints.trim() || "不重新展开全部材料，只把整期判断收束为下一步可用的结论。";
  const generatedAt = "offline-realistic-summary-draft-v1";

  const drafts = [
    {
      label: `真实收束草稿 · ${clampText(topic, 18, page.pageType)}`,
      text: `这一页不再承担“${topic}”的主题进入，也不应该重新展开数据和案例。它更像整期阅读结束前的编辑收口：先把已经出现的变化压缩成少量可带走判断，再提醒读者哪些趋势值得继续观察。`,
    },
    {
      label: `结论段落 · ${clampText(style, 18, "summary tone")}`,
      text: `按照“${style}”的方向，summary 应该把前文的分散信息折叠成明确结论，而不是再铺一遍背景。它需要直接回答“读完这一期以后应该记住什么”，并把建议控制在能够指导下一步判断的范围内。`,
    },
    {
      label: `行动边界 · ${clampText(boundary, 18, "summary boundary")}`,
      text: `本页仍要遵守边界：“${boundary}” 因此结束语应该把读者留在清楚的判断和行动落点上，而不是开启新的讨论支线。尚未被充分证明的部分，可以作为后续追踪方向，而不应在总结页伪装成定论。`,
    },
  ];

  return drafts.map((draft, index) => ({
    id: `${page.id}-summary-generated-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "summaryGeneratedDraft",
    text: draft.text,
    label: draft.label,
    sourceBlockId: generatedAt,
  }));
}
