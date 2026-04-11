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
      .replace(/\s*(做最终收束|沉淀可带走判断|下一步建议|边界提醒|重新展开综述|明确结论)[\s\S]*$/, "")
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
  const generatedAt = "offline-realistic-summary-draft-v1";

  const drafts = [
    {
      label: `真实收束草稿 · ${clampText(topic, 18, page.pageType)}`,
      text: `围绕“${topic}”，已经出现的变化可以收束为一个克制判断：人工智能仍在从能力展示走向真实采用，但不同场景的验证速度并不一致。读者更需要关注持续信号，而不是被单个热点牵引。`,
    },
    {
      label: `结论段落 · ${clampText(topic, 18, "summary tone")}`,
      text: `值得带走的不是一个确定答案，而是一组判断线索：能力进展、产品落地、业务采用和组织节奏需要放在一起观察。任何单点变化都不足以替代后续验证。`,
    },
    {
      label: `观察余地 · ${clampText(topic, 18, "summary signal")}`,
      text: `尚未被充分证明的部分只适合作为后续追踪方向。更可靠的收束是保留判断弹性：继续看真实使用、成本变化和组织采用节奏是否形成稳定趋势。`,
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
