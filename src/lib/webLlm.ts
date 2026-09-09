import type {
  ContentPageGenerationRequest,
  GeneratedOutlinePlanResult,
  GeneratedTextDraftFragment,
  GeneratedTextDraftResult,
  GenerationProvider,
  GenerationProviderConfig,
  NormalizedTaskInput,
  OverviewGenerationRequest,
  ProviderContext,
  SummaryGenerationRequest,
} from "@/services/providers/types";
import { describePageForPrompt, DeterministicGenerationProvider, getExpectedDraftRoles } from "@/lib/deterministic";
import type { Page } from "@/types/domain";

/**
 * WebLLM 增强 provider：在浏览器内用 WebGPU 本地运行一个小型开源模型，
 * 给确定性引擎补「深度 / 自然度」。无服务器、无 API key、数据不出本地。
 *
 * 关键设计：
 *  - 默认「未启用」，只有用户显式调用 enableWebLlm() 且 WebGPU 可用时才加载模型。
 *  - 模型权重首次使用会从 CDN 下载（约数百 MB ~ 1GB），之后由浏览器缓存。
 *  - 大纲仍走确定性引擎（快、可靠、结构一致）；WebLLM 只负责逐页正文。
 *  - 所有推理串行化（WebGPU 引擎不支持并发满载），失败时抛错 → 上层自动回退确定性引擎。
 *
 * ⚠️ 该 provider 依赖浏览器 WebGPU；本仓库的 Node 沙箱无法端到端验证推理，
 * 请在支持 WebGPU 的浏览器（Chrome / Edge 113+）中验证。
 */

export type WebLlmStatus = "idle" | "checking" | "loading" | "ready" | "error" | "unsupported";

/** 兼顾中文质量与体积的默认模型；可在 enableWebLlm(modelId) 覆盖。 */
export const WEBLLM_MODEL_DEFAULT = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

const MODEL_VRAM: Record<string, string> = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": "约 0.5B · 更小更快",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC": "约 1.5B · 质量更好",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC": "约 1B · 英文为主",
};

type StatusListener = (status: WebLlmStatus, detail: string) => void;

const listeners = new Set<StatusListener>();
let status: WebLlmStatus = "idle";
let statusDetail = "";
let enginePromise: Promise<unknown> | null = null;
// 串行化队列，避免并发推理压垮 WebGPU 引擎
let runQueue: Promise<unknown> = Promise.resolve();

function setStatus(next: WebLlmStatus, detail = "") {
  status = next;
  statusDetail = detail;
  listeners.forEach((listener) => listener(next, detail));
}

export function getWebLlmStatus(): WebLlmStatus {
  return status;
}

export function getWebLlmStatusDetail(): string {
  return statusDetail;
}

export function subscribeWebLlmStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  listener(status, statusDetail);
  return () => {
    listeners.delete(listener);
  };
}

function webgpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator && Boolean((navigator as { gpu?: unknown }).gpu);
}

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = runQueue.then(task, task);
  runQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** 启用 WebLLM：检查 WebGPU、下载并加载模型。返回是否成功。 */
export async function enableWebLlm(modelId = WEBLLM_MODEL_DEFAULT): Promise<boolean> {
  if (enginePromise) {
    return status === "ready";
  }
  if (!webgpuAvailable()) {
    setStatus("unsupported", "当前浏览器不支持 WebGPU（请使用 Chrome / Edge 113+）");
    return false;
  }
  setStatus("checking", "检测 WebGPU 环境");
  enginePromise = (async () => {
    try {
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: (progress: { text?: string; progress?: number }) => {
          const pct = progress.progress != null ? Math.round(progress.progress * 100) : null;
          const label = progress.text ?? "";
          setStatus("loading", pct != null ? `${label}（${pct}%）` : label || "加载模型中");
        },
      });
      setStatus("ready", `${modelId} 已就绪${MODEL_VRAM[modelId] ? ` · ${MODEL_VRAM[modelId]}` : ""}`);
      return engine;
    } catch (error) {
      enginePromise = null;
      const message = error instanceof Error ? error.message : String(error);
      setStatus("error", `模型加载失败：${message}`);
      throw error;
    }
  })();
  try {
    await enginePromise;
    return true;
  } catch {
    return false;
  }
}

export function resetWebLlm() {
  enginePromise = null;
  runQueue = Promise.resolve();
  setStatus("idle", "");
}

/* ------------------------------------------------------------------ *
 * 提示词构建 + JSON 解析
 * ------------------------------------------------------------------ */

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractJsonPayload(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return value.slice(first, last + 1);
  }
  return value;
}

function buildGroundedPrompt(page: Page, roleLabel: string, roles: string[]) {
  const context = describePageForPrompt(page);
  const metricText = context.metrics
    .map((metric) => `${metric.label}：前值 ${metric.previous}，现值 ${metric.current}，变化 ${metric.change}`)
    .join("；");
  const system = [
    "你是 PagesCut 的中文刊物/报告正文作者，为单个页面撰写给读者看的作品正文。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    `JSON 格式：{"fragments":[{"role":"...","text":"..."}]}`,
    `role 必须且只能依次覆盖：${roles.join("、")}。`,
    "每个 role 的 text 必须是不同内容，35-80 字中文，直接可读。",
    "不得写页面策略、编辑说明、contract、intent 或开发描述。",
    "只能使用下方给定的指标数字，不得编造公司名、金额、百分比、排名、日期。",
  ].join("\n");
  const user = [
    `页面角色：${roleLabel}`,
    `主题：${context.subject}`,
    `时间：${context.period}`,
    `可用指标（必须与此一致）：${metricText}`,
    `请为这些 role 各写一段正文：${roles.join("、")}`,
  ].join("\n");
  return { system, user };
}

function parseFragments(raw: string, roles: string[]): GeneratedTextDraftFragment[] {
  const cleaned = stripThinking(raw);
  try {
    const parsed = JSON.parse(extractJsonPayload(cleaned)) as { fragments?: Array<{ role?: unknown; text?: unknown }> };
    const items = Array.isArray(parsed.fragments)
      ? parsed.fragments
          .map((item, index) => ({
            role: typeof item.role === "string" ? item.role.trim() : roles[index] ?? `fragment-${index + 1}`,
            text: typeof item.text === "string" ? item.text.replace(/\s+/g, " ").trim() : "",
          }))
          .filter((item) => item.text)
      : [];
    if (!items.length) {
      throw new Error("WebLLM 返回空 fragments");
    }
    const byRole = new Map(items.map((item) => [item.role, item.text]));
    return roles.map((role, index) => ({
      role,
      label: `WebLLM 片段 ${index + 1}`,
      text: byRole.get(role) ?? items[index]?.text ?? "",
    }));
  } catch {
    throw new Error("WebLLM 返回了无法解析的 JSON");
  }
}

function toDraftResult(page: Page, fragments: GeneratedTextDraftFragment[]): GeneratedTextDraftResult {
  return {
    providerType: "deterministic",
    model: WEBLLM_MODEL_DEFAULT,
    sourceId: `webllm:${WEBLLM_MODEL_DEFAULT}`,
    prompt: `WebLLM 正文生成：${describePageForPrompt(page).subject}`,
    fragments,
  };
}

/* ------------------------------------------------------------------ *
 * Provider
 * ------------------------------------------------------------------ */

function roleLabelFor(page: Page): string {
  if (page.pageRole === "summary") {
    return "总结页";
  }
  if (page.pageType.includes("数据")) {
    return "数据页";
  }
  if (page.pageRole === "case-study" || page.pageType.includes("案例")) {
    return "案例页";
  }
  if (page.pageRole === "feature") {
    return "专题页";
  }
  return "综述页";
}

export class WebLlmGenerationProvider implements GenerationProvider {
  readonly config: GenerationProviderConfig = {
    providerType: "deterministic",
    model: WEBLLM_MODEL_DEFAULT,
    endpoint: "",
    source: "workspace-default",
    options: { temperature: 0.5, topP: 0.9, numPredict: 1200 },
    truthfulnessPolicy: {
      requireGroundedOutput: true,
      allowUngroundedSpecificFacts: false,
      forbiddenSpecificFactKinds: ["company", "model", "money", "percentage", "ranking", "date", "metric"],
    },
  };

  // 大纲始终走确定性引擎：快、可靠、结构一致；WebLLM 只负责正文深度。
  async generateOutlinePlan(input: NormalizedTaskInput, context: ProviderContext): Promise<GeneratedOutlinePlanResult> {
    return new DeterministicGenerationProvider().generateOutlinePlan(input, context);
  }

  async generateOverviewDraft(request: OverviewGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request.page);
  }

  async generateSummaryDraft(request: SummaryGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request.page);
  }

  async generateDataDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request.page);
  }

  async generateCaseDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request.page);
  }

  async generateFeatureDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request.page);
  }

  private async generateDraft(page: Page): Promise<GeneratedTextDraftResult> {
    if (!enginePromise || status !== "ready") {
      throw new Error("WebLLM 尚未就绪，请先启用并等待模型加载完成");
    }
    const roles = getExpectedDraftRoles(page);
    const { system, user } = buildGroundedPrompt(page, roleLabelFor(page), roles);
    const raw = await serialize(async () => {
      const engine = (await enginePromise) as {
        chat: { completions: { create: (req: { messages: Array<{ role: string; content: string }>; max_tokens: number; temperature: number }) => Promise<{ choices: Array<{ message: { content?: string } }> }> } };
      };
      const reply = await engine.chat.completions.create({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: 1200,
        temperature: 0.5,
      });
      return reply.choices[0]?.message?.content ?? "";
    });
    const fragments = parseFragments(raw, roles);
    if (fragments.some((fragment) => !fragment.text)) {
      throw new Error("WebLLM 输出缺少部分 role 正文");
    }
    return toDraftResult(page, fragments);
  }
}
