import type {
  GeneratedTextDraftFragment,
  GeneratedTextDraftResult,
  GenerationProvider,
  GenerationProviderConfig,
  OverviewGenerationRequest,
  ProviderContext,
  SummaryGenerationRequest,
} from "@/services/providers/types";

interface OllamaGenerateResponse {
  response?: string;
}

interface GroundingBoundary {
  normalizedSource: string;
  fallbackTopic: string;
  pageRole: "overview" | "summary";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForGrounding(value: string) {
  return normalizeWhitespace(value).replace(/\s+/g, "");
}

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

function splitSentences(value: string) {
  return value
    .split(/(?<=[。！？!?])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getUserTextSources(page: OverviewGenerationRequest["page"]) {
  return page.userProvidedContentBlocks
    .filter((block): block is Extract<OverviewGenerationRequest["page"]["userProvidedContentBlocks"][number], { type: "text" }> => block.type === "text")
    .map((block) => normalizeWhitespace(block.text))
    .filter(Boolean);
}

function getNarrativeTopic(page: OverviewGenerationRequest["page"]) {
  const raw = page.outlineText || page.pageType;
  const normalized = normalizeWhitespace(raw)
    .replace(/^(围绕|关于|总结|建立|生成|制作|收束|提炼)\s*/, "")
    .replace(/\s*(建立总览页|做最终收束|沉淀可带走判断|给出后续内容页|先收束主题判断|先建立总体判断|再进入细节页面|再给出后续内容页|提炼一页|选择一个真实业务场景)[\s\S]*$/, "")
    .replace(/[。！？!?].*$/, "")
    .replace(/(月刊|周报|日报|报告|PPT|幻灯片|作品)$/i, "")
    .trim();

  return normalized || page.pageType;
}

function hasUngroundedSpecificFact(value: string, boundary: GroundingBoundary) {
  const normalized = normalizeForGrounding(value);
  const numberLikeFacts = value.match(/\d+(?:\.\d+)?\s*(?:%|％|亿美元|亿元|万元|万|亿|月|日|年|倍|个|项|家|名|轮|B|M|K)?/g) ?? [];
  const hasUnsupportedNumber = numberLikeFacts.some((fact) => !boundary.normalizedSource.includes(normalizeForGrounding(fact)));
  if (hasUnsupportedNumber) {
    return true;
  }

  const specificEntities = ["Meta", "Google", "OpenAI", "PathAI", "Gemini", "Llama", "微软", "英伟达", "百度", "阿里", "腾讯", "字节", "华为"];
  return specificEntities.some((entity) => normalized.includes(normalizeForGrounding(entity)) && !boundary.normalizedSource.includes(normalizeForGrounding(entity)));
}

function hasSummaryOverreach(value: string, boundary: GroundingBoundary) {
  if (boundary.pageRole !== "summary") {
    return false;
  }

  const normalized = normalizeForGrounding(value);
  const source = boundary.normalizedSource;
  const overreachPatterns = [
    "必须",
    "应立即",
    "应当立即",
    "建议立即",
    "建议直接",
    "确定会",
    "必然",
    "必须转向",
    "必须采用",
    "必须投入",
    "建议采购",
    "建议部署",
    "建议投资",
  ];

  return overreachPatterns.some((pattern) => normalized.includes(normalizeForGrounding(pattern)) && !source.includes(normalizeForGrounding(pattern)));
}

function hasMetaNarration(value: string) {
  const normalized = normalizeForGrounding(value);
  const metaPatterns = [
    "本页",
    "这页",
    "这一页",
    "这里的正文",
    "这里",
    "本页判断",
    "阅读路径",
    "承担",
    "承接",
    "边界",
    "更适合的处理方式",
    "不应只是",
    "重点不是",
    "应该",
    "职责",
    "如何组织",
    "页面策略",
    "编辑策略",
    "像刊首",
    "像刊末",
    "建立总览页",
    "先收束主题判断",
    "先建立总体判断",
    "进入细节页面",
    "后续内容页",
    "这一限制下",
  ];

  return metaPatterns.some((pattern) => normalized.includes(normalizeForGrounding(pattern)));
}

function fallbackGroundedText(label: string, boundary: GroundingBoundary, role?: string) {
  if (boundary.pageRole === "summary") {
    if (role === "summaryNextSignals") {
      return `后续观察应集中在真实采用是否持续、支撑信号是否增多，以及应用节奏能否从短期试探进入稳定验证。`;
    }

    if (role === "summaryUncertainty") {
      return `尚未被材料证明的判断只适合作为观察方向，确定表达应集中在已知变化、后续信号和判断弹性。`;
    }

    if (label.includes("边界")) {
      return `围绕“${boundary.fallbackTopic}”，尚未被材料证明的判断只保留为观察方向；确定表达集中在已知变化、后续信号和判断弹性。`;
    }

    if (label.includes("行动") || label.includes("建议")) {
      return `围绕“${boundary.fallbackTopic}”，后续关注点集中在变化是否持续、支撑信号是否增多、应用节奏是否稳定。`;
    }

    return `围绕“${boundary.fallbackTopic}”，整期结论保持克制：已出现的变化提示读者继续观察模型能力、产品落地与组织采用之间的关系。`;
  }

  if (role === "overviewThemeChange") {
    return `人工智能相关变化正在从单点事件转向连续演进，模型能力、产品落地与业务采用之间的联动比单个热点更值得关注。`;
  }

  if (role === "overviewRelationshipJudgment") {
    return `能力提升会推动产品试探，产品试探又会改变组织采用节奏；真正有价值的判断来自这些关系，而不是热点词堆叠。`;
  }

  if (role === "overviewObservationFocus") {
    return `输入信息有限时，概括判断优先于具体公司、金额和指标断言，读者应把注意力放在可持续的采用信号上。`;
  }

  if (label.includes("边界")) {
    return `围绕“${boundary.fallbackTopic}”，现有输入不足以支撑公司、金额、比例或指标层面的细节判断，读者需要先把注意力放在变化方向和后续信号上。`;
  }

  if (label.includes("判断")) {
    return `围绕“${boundary.fallbackTopic}”，模型能力、产品落地、业务采用和组织节奏正在互相牵引，读者需要先识别哪些变化值得优先关注。`;
  }

  return `围绕“${boundary.fallbackTopic}”，人工智能相关变化从单点事件转向连续演进，概括判断优先于未核验细节。`;
}

function constrainFragment(fragment: GeneratedTextDraftFragment, boundary: GroundingBoundary): GeneratedTextDraftFragment {
  const safeSentences = splitSentences(fragment.text).filter(
    (sentence) => !hasUngroundedSpecificFact(sentence, boundary) && !hasSummaryOverreach(sentence, boundary) && !hasMetaNarration(sentence),
  );
  const text = normalizeWhitespace(safeSentences.join("")) || fallbackGroundedText(fragment.label, boundary, fragment.role);

  return {
    ...fragment,
    text,
  };
}

function constrainFragments(fragments: GeneratedTextDraftFragment[], boundary: GroundingBoundary): GeneratedTextDraftFragment[] {
  const seen = new Set<string>();

  return fragments.map((fragment) => {
    const constrained = constrainFragment(fragment, boundary);
    const normalized = normalizeForGrounding(constrained.text);
    if (normalized && seen.has(normalized)) {
      const fallbackText = fallbackGroundedText(constrained.label, boundary, constrained.role);
      seen.add(normalizeForGrounding(fallbackText));
      return {
        ...constrained,
        text: fallbackText,
      };
    }

    if (normalized) {
      seen.add(normalized);
    }

    return constrained;
  });
}

function parseFragments(raw: string, boundary: GroundingBoundary): GeneratedTextDraftFragment[] {
  const cleaned = stripThinking(raw);

  try {
    const parsed = JSON.parse(extractJsonPayload(cleaned)) as { fragments?: Array<{ role?: unknown; label?: unknown; text?: unknown }> };
    const fragments = Array.isArray(parsed.fragments)
      ? parsed.fragments
          .map((item, index) => ({
            role: typeof item.role === "string" && item.role.trim() ? item.role.trim() : undefined,
            label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : `模型草稿 ${index + 1}`,
            text: typeof item.text === "string" ? normalizeWhitespace(item.text) : "",
          }))
          .filter((item) => item.text)
      : [];

    if (fragments.length) {
      return constrainFragments(fragments.slice(0, boundary.pageRole === "summary" ? 5 : 6), boundary);
    }
  } catch {
    // Fall back to paragraph splitting below. The provider still returns formal
    // fragments, but the output was not valid JSON.
  }

  const fallbackFragments = cleaned
    .split(/\n{2,}|(?<=。)\s*(?=第|同时|因此|最后)/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .slice(0, 3)
    .map((text, index) => ({ label: `模型草稿 ${index + 1}`, text }));

  return constrainFragments(fallbackFragments, boundary);
}

function buildGroundingBoundary({ page }: OverviewGenerationRequest | SummaryGenerationRequest): GroundingBoundary {
  const sourceText = [page.pageType, getNarrativeTopic(page), page.outlineText, ...getUserTextSources(page)].filter(Boolean).join(" ");
  return {
    normalizedSource: normalizeForGrounding(sourceText),
    fallbackTopic: getNarrativeTopic(page),
    pageRole: page.pageRole === "summary" ? "summary" : "overview",
  };
}

function buildAllowedSource({ page }: OverviewGenerationRequest | SummaryGenerationRequest) {
  const userSources = getUserTextSources(page);
  return [
    `页面类型：${page.pageType}`,
    `主题对象：${getNarrativeTopic(page)}`,
    ...(userSources.length ? userSources.map((source, index) => `用户素材 ${index + 1}：${source}`) : ["用户素材：未提供"]),
  ];
}

function buildTruthfulnessPromptLines() {
  return [
    "真实性边界：只能使用下方“允许输入”中出现的信息。",
    "严格禁止编造允许输入中没有出现的公司名、模型名、融资金额、百分比、排名、日期或具体指标。",
    "如果允许输入不足，只能使用“模型能力、产品落地、业务采用、组织节奏、后续支撑页面”等概括表达。",
  ];
}

function buildOverviewOutputConstraintLines() {
  return [
    "overview 输出目标：直接写主题综述，谈当前主题中的变化、关系、风险和读者价值。",
    "overview 不得讲页面如何写、如何组织内容、如何引导阅读；不得输出伪精确数字、未提供实体细节或确定性预测。",
    "overview 的 role 分工：hero 负责总览判断，themeChange 负责变化描述，relationshipJudgment 负责关系判断，observationFocus 负责观察重点，narrative 负责正文展开，readerValue 负责读者价值。",
  ];
}

function buildSummaryOutputConstraintLines() {
  return [
    "summary 输出目标：直接写整期主题的克制收束，谈已经形成的判断、仍需观察的信号和不确定性。",
    "summary 不得讲页面如何收束、如何组织结论、如何提醒读者；不得输出“必须、应立即、建议采购、建议部署、建议投资”等强行动建议。",
    "summary 不得把未被允许输入证明的内容写成确定结论。",
    "summary 的 role 分工：finalJudgment 负责最终判断，nextSignals 负责后续观察，uncertainty 负责判断余地，closingNote 负责结束语，readerTakeaway 负责读者带走信息。",
  ];
}

function buildMetaNarrationPromptLines() {
  return [
    "正文硬禁区：text 必须直接谈主题本身，禁止谈“这页怎么写”。",
    "text 中禁止出现或转述：本页、这页、这一页、这里的正文、阅读路径、承担、承接、边界、更适合的处理方式、不应只是、重点不是、应该、职责、页面策略、编辑策略。",
    "如果想表达限制，只能改写为主题判断本身，例如“输入信息不足以支持具体公司或指标判断”，不要写成页面写法说明。",
  ];
}

function buildOverviewPrompt(request: OverviewGenerationRequest) {
  const { page } = request;
  const allowedSource = buildAllowedSource(request);

  return [
    "你是 PagesCut 的中文刊物编辑。请为一个 overview 内容页生成更接近真实模型输出的编辑草稿。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"fragments\":[{\"role\":\"overviewHero\",\"label\":\"...\",\"text\":\"...\"}]}",
    "必须输出 6 个 fragments，role 只能是：overviewHero、overviewThemeChange、overviewRelationshipJudgment、overviewObservationFocus、overviewNarrative、overviewReaderValue。",
    "每个 role 的 text 必须明显不同；每段 45-90 字中文自然段；只写主题叙述，不写页面策略。",
    ...buildOverviewOutputConstraintLines(),
    ...buildMetaNarrationPromptLines(),
    ...buildTruthfulnessPromptLines(),
    "允许输入：",
    ...allowedSource,
    `页面类型确认：${page.pageType}`,
  ].join("\n");
}

function buildSummaryPrompt(request: SummaryGenerationRequest) {
  const allowedSource = buildAllowedSource(request);

  return [
    "你是 PagesCut 的中文刊物编辑。请为一个 summary 内容页生成更接近真实模型输出的收束草稿。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"fragments\":[{\"role\":\"summaryFinalJudgment\",\"label\":\"...\",\"text\":\"...\"}]}",
    "必须输出 5 个 fragments，role 只能是：summaryFinalJudgment、summaryNextSignals、summaryUncertainty、summaryClosingNote、summaryReaderTakeaway。",
    "每个 role 的 text 必须明显不同；每段 45-85 字中文自然段；只写主题结论，不写收束策略。",
    ...buildSummaryOutputConstraintLines(),
    ...buildMetaNarrationPromptLines(),
    ...buildTruthfulnessPromptLines(),
    "允许输入：",
    ...allowedSource,
  ].join("\n");
}

export class OllamaGenerationProvider implements GenerationProvider {
  constructor(private readonly config: GenerationProviderConfig) {}

  private async generateDraft(
    request: OverviewGenerationRequest | SummaryGenerationRequest,
    prompt: string,
    emptyErrorMessage: string,
  ): Promise<GeneratedTextDraftResult> {
    if (!this.config.endpoint || !this.config.model) {
      throw new Error("Ollama generation provider requires endpoint and model config");
    }

    const boundary = buildGroundingBoundary(request);
    const response = await fetch(`${this.config.endpoint.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature: this.config.options.temperature,
          top_p: this.config.options.topP,
          num_predict: this.config.options.numPredict,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama generation failed with status ${response.status}`);
    }

    const body = (await response.json()) as OllamaGenerateResponse;
    const fragments = parseFragments(body.response ?? "", boundary);
    if (!fragments.length) {
      throw new Error(emptyErrorMessage);
    }

    return {
      providerType: this.config.providerType,
      model: this.config.model,
      sourceId: `${this.config.providerType}:${this.config.model}`,
      prompt,
      fragments,
    };
  }

  async generateOverviewDraft(request: OverviewGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildOverviewPrompt(request), "Ollama generation returned no usable overview fragments");
  }

  async generateSummaryDraft(request: SummaryGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildSummaryPrompt(request), "Ollama generation returned no usable summary fragments");
  }
}
