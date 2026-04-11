import type { Page } from "@/types/domain";
import type { TextSourceFragment } from "@/types/pageModel";

function clampText(value: string, limit: number, fallback = "") {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
}

function normalizeTopic(value: string, fallback: string) {
  return clampText(
    value
      .replace(/^(围绕|关于|总结|建立|生成|制作)/, "")
      .replace(/\s*(建立总览页|先收束主题判断|先建立总体判断|再进入细节页面|再给出后续内容页|给出后续内容页)[\s\S]*$/, "")
      .replace(/[。！？!?\n].*$/, "")
      .trim(),
    34,
    fallback,
  );
}

export function createOverviewGeneratedDraftFragments(page: Page): TextSourceFragment[] {
  if (page.pageRole !== "overview") {
    return [];
  }

  const topic = normalizeTopic(page.outlineText, page.pageType);
  const generatedAt = "offline-realistic-overview-draft-v1";

  const drafts = [
    {
      label: `真实草稿 · ${clampText(topic, 18, page.pageType)}`,
      text: `“${topic}”正在从单点事件转向连续变化：模型能力、产品落地、业务采用和组织节奏互相牵引。读者需要先识别哪些变化已经形成连续信号，哪些仍停留在概念热度和短期讨论中。`,
    },
    {
      label: `判断段落 · ${clampText(topic, 18, "overview tone")}`,
      text: `当前更值得关注的是变化之间的关系：能力提升会推动产品试探，产品试探又会反过来改变组织采用节奏。真正有价值的判断来自这些关系，而不是单个热点词的堆叠。`,
    },
    {
      label: `观察段落 · ${clampText(topic, 18, "overview signal")}`,
      text: `尚未被材料证明的具体公司、金额和指标不宜被写成事实。更稳妥的判断是：人工智能趋势仍处在快速扩散和持续验证之间，读者需要把注意力放在真实采用信号上。`,
    },
  ];

  return drafts.map((draft, index) => ({
    id: `${page.id}-overview-generated-draft-${index + 1}`,
    pageId: page.id,
    origin: "synthetic",
    sourceField: "overviewGeneratedDraft",
    text: draft.text,
    label: draft.label,
    sourceBlockId: generatedAt,
  }));
}
