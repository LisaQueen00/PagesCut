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
  const style = page.styleText.trim() || "保持专业、克制、清晰的编辑判断";
  const boundary = page.userConstraints.trim() || "只在总览页完成主题校准，不提前铺开全部细节。";
  const generatedAt = "offline-realistic-overview-draft-v1";

  const drafts = [
    {
      label: `真实草稿 · ${clampText(topic, 18, page.pageType)}`,
      text: `这页的重点不是把“${topic}”拆成一组松散条目，而是先给读者一个可以带着往后读的判断框架。当前主题已经从单点事件转向连续变化：模型能力、产品落地、业务采用和组织节奏正在互相牵引，读者需要先知道哪些变化值得优先关注。`,
    },
    {
      label: `判断段落 · ${clampText(style, 18, "overview tone")}`,
      text: `按照“${style}”的表达方向，overview 应该先用少量高密度段落完成总览判断，再把数据页和案例页留给后续证明。这里的正文不应只是复述大纲，而要把主线、节奏和阅读顺序组织起来，让页面像一段编辑导语，而不是占位文案。`,
    },
    {
      label: `边界段落 · ${clampText(boundary, 18, "overview boundary")}`,
      text: `本页仍要遵守边界：“${boundary}” 因此它只承担入口和判断校准，不替代后面的数据支撑、案例拆解或最终总结。更适合的处理方式是把不确定性说清楚，把读者的注意力导向后续页面，而不是在第一页就把所有材料摊满。`,
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
