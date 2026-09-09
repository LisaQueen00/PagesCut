// 冒烟测试：确认 WebLLM 模块可导入、状态初始为 idle、unsupported 分支正确
import { getExpectedDraftRoles, describePageForPrompt } from "../src/lib/deterministic";
import { WebLlmGenerationProvider, getWebLlmStatus as wlStatus, resetWebLlm, WEBLLM_MODEL_DEFAULT, enableWebLlm } from "../src/lib/webLlm";
import type { Page } from "../src/types/domain";

// 注意：Node 无 navigator.gpu，因此 enableWebLlm 会走到 unsupported
console.log("WebLLM 默认模型:", WEBLLM_MODEL_DEFAULT);
console.log("初始状态:", wlStatus());

const page: Page = {
  id: "p1", taskId: "t1", index: 1, renderSeed: 0, pageKind: "content", pageRole: "overview",
  pageType: "AI 大模型落地综述", outlineText: "2024 年 AI 大模型落地：本页建立总体判断。",
  sourceMode: "system", expressionMode: "text", styleText: "", userConstraints: "",
  isConfirmed: false, isSaved: false, userProvidedContentBlocks: [], coverMeta: null,
};
console.log("overview 期望 roles:", getExpectedDraftRoles(page).join(", "));
const ctx = describePageForPrompt(page);
console.log("grounding:", ctx.subject, "|", ctx.period, "|", ctx.metrics.map(m => `${m.label} ${m.current} (${m.change})`).join(" / "));

// 未启用时调用应抛错（上层会回退确定性引擎）
const provider = new WebLlmGenerationProvider();
try {
  await provider.generateOverviewDraft({ page, promptNote: "" }, { stage: "page-generation" });
  console.log("❌ 未启用却成功生成了（异常）");
} catch (e) {
  console.log("✓ 未启用时正确抛错（将回退确定性）:", e instanceof Error ? e.message : e);
}

// unsupported 分支
const ok = await enableWebLlm();
console.log("Node 环境 enableWebLlm 返回:", ok, "| 状态:", wlStatus());
resetWebLlm();
