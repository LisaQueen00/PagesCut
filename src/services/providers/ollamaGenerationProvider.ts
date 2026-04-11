import type {
  GeneratedTextDraftFragment,
  GeneratedTextDraftResult,
  GenerationProvider,
  GenerationProviderConfig,
  OverviewGenerationRequest,
  ProviderContext,
} from "@/services/providers/types";

interface OllamaGenerateResponse {
  response?: string;
}

interface GroundingBoundary {
  normalizedSource: string;
  fallbackTopic: string;
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

function fallbackGroundedText(label: string, boundary: GroundingBoundary) {
  if (label.includes("边界")) {
    return `本页只基于已提供的页面大纲、风格要求和用户约束进行概括，不补充未给出的公司、金额、比例或指标。它应把读者的注意力导向后续支撑页面，而不是在 overview 中提前制造未经来源支持的定论。`;
  }

  if (label.includes("判断")) {
    return `围绕“${boundary.fallbackTopic}”，本页应把模型能力、产品落地、业务采用和组织节奏组织成一条可阅读的判断线。当前信息不足以支撑具体事实列举，因此正文应保持概括表达，等待后续数据页和案例页承接证明。`;
  }

  return `本页围绕“${boundary.fallbackTopic}”建立 overview 的主题进入，先帮助读者理解这一期的阅读方向。当前输入没有提供可核验的具体公司、金额、比例或指标，因此这里使用概括性编辑导语，而不主动补充外部事实。`;
}

function constrainFragment(fragment: GeneratedTextDraftFragment, boundary: GroundingBoundary): GeneratedTextDraftFragment {
  const safeSentences = splitSentences(fragment.text).filter((sentence) => !hasUngroundedSpecificFact(sentence, boundary));
  const text = normalizeWhitespace(safeSentences.join("")) || fallbackGroundedText(fragment.label, boundary);

  return {
    ...fragment,
    text,
  };
}

function parseFragments(raw: string, boundary: GroundingBoundary): GeneratedTextDraftFragment[] {
  const cleaned = stripThinking(raw);

  try {
    const parsed = JSON.parse(extractJsonPayload(cleaned)) as { fragments?: Array<{ label?: unknown; text?: unknown }> };
    const fragments = Array.isArray(parsed.fragments)
      ? parsed.fragments
          .map((item, index) => ({
            label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : `模型草稿 ${index + 1}`,
            text: typeof item.text === "string" ? normalizeWhitespace(item.text) : "",
          }))
          .filter((item) => item.text)
      : [];

    if (fragments.length) {
      return fragments.slice(0, 3).map((fragment) => constrainFragment(fragment, boundary));
    }
  } catch {
    // Fall back to paragraph splitting below. The provider still returns formal
    // fragments, but the output was not valid JSON.
  }

  return cleaned
    .split(/\n{2,}|(?<=。)\s*(?=第|同时|因此|最后|本页)/)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean)
    .slice(0, 3)
    .map((text, index) => constrainFragment({ label: `模型草稿 ${index + 1}`, text }, boundary));
}

function buildGroundingBoundary({ page, promptNote }: OverviewGenerationRequest): GroundingBoundary {
  const sourceText = [page.pageType, page.outlineText, page.styleText, page.userConstraints, promptNote].filter(Boolean).join(" ");
  return {
    normalizedSource: normalizeForGrounding(sourceText),
    fallbackTopic: page.outlineText || page.pageType,
  };
}

function buildOverviewPrompt({ page, promptNote }: OverviewGenerationRequest) {
  const allowedSource = [
    `页面类型：${page.pageType}`,
    `页面大纲：${page.outlineText || "未提供"}`,
    `风格要求：${page.styleText || "专业、克制、清晰"}`,
    `用户约束：${page.userConstraints || "保持 overview 的主题进入职责，不提前展开所有细节"}`,
    `本次再生成提示：${promptNote || "生成 overview 的真实编辑草稿"}`,
  ];

  return [
    "你是 PagesCut 的中文刊物编辑。请为一个 overview 内容页生成更接近真实模型输出的编辑草稿。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"fragments\":[{\"label\":\"...\",\"text\":\"...\"},{\"label\":\"...\",\"text\":\"...\"},{\"label\":\"...\",\"text\":\"...\"}]}",
    "要求：输出 3 个 fragments；每个 text 是 80-140 字中文自然段；分别承担主题进入、判断组织、页面边界。",
    "真实性边界：只能使用下方“允许输入”中出现的信息。",
    "严格禁止编造允许输入中没有出现的公司名、模型名、融资金额、百分比、排名、日期或具体指标。",
    "如果允许输入不足，只能使用“模型能力、产品落地、业务采用、组织节奏、后续支撑页面”等概括表达。",
    "允许输入：",
    ...allowedSource,
  ].join("\n");
}

export class OllamaGenerationProvider implements GenerationProvider {
  constructor(private readonly config: GenerationProviderConfig) {}

  async generateOverviewDraft(request: OverviewGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    if (!this.config.endpoint || !this.config.model) {
      throw new Error("Ollama generation provider requires endpoint and model config");
    }

    const prompt = buildOverviewPrompt(request);
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
      throw new Error("Ollama generation returned no usable overview fragments");
    }

    return {
      providerType: this.config.providerType,
      model: this.config.model,
      sourceId: `${this.config.providerType}:${this.config.model}`,
      prompt,
      fragments,
    };
  }
}
