import type {
  ExpressionMode,
  Page,
} from "@/types/domain";
import type {
  ContentPageGenerationRequest,
  GeneratedOutlinePagePlan,
  GeneratedOutlinePageRole,
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

interface OllamaGenerateResponse {
  response?: string;
}

interface GroundingBoundary {
  normalizedSource: string;
  fallbackTopic: string;
  pageRole: "overview" | "summary" | "data" | "case" | "feature";
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
    .replace(/^(请|帮我|我想|希望|准备|需要)\s*/, "")
    .replace(/^(生成|做|制作|产出)\s*/, "")
    .replace(/^(一期|一份|一个)\s*/, "")
    .replace(/^(围绕|关于|总结|建立|生成|制作|收束|提炼)\s*/, "")
    .replace(/\s*(建立总览页|做最终收束|沉淀可带走判断|给出后续内容页|先收束主题判断|先建立总体判断|再进入细节页面|再给出后续内容页|提炼一页|选择一个真实业务场景)[\s\S]*$/, "")
    .replace(/[。！？!?].*$/, "")
    .replace(/相关内容的?/g, "")
    .replace(/相关的?/g, "")
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
  const roleLabel = role || label || boundary.pageRole;

  return `模型正文片段 ${roleLabel} 未通过结构或真实性约束，请重新生成。`;
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

function getExpectedDraftRoles(pageRole: GroundingBoundary["pageRole"]) {
  switch (pageRole) {
    case "summary":
      return ["summaryFinalJudgment", "summaryNextSignals", "summaryUncertainty", "summaryClosingNote", "summaryReaderTakeaway"];
    case "data":
      return ["dataSummary", "dataChartBrief", "dataChartExplanation", "dataTakeaway", "dataSourceNote"];
    case "case":
      return ["caseSubject", "caseVisualBrief", "caseScenario", "caseChallenge", "caseAction", "caseResult", "caseTakeaway"];
    case "feature":
      return ["featureHero", "featureAngle", "featureDetail", "featureEvidence", "featureTakeaway"];
    case "overview":
    default:
      return [
        "overviewHero",
        "overviewThemeChange",
        "overviewRelationshipJudgment",
        "overviewObservationFocus",
        "overviewNarrative",
        "overviewReaderValue",
      ];
  }
}

function normalizeDraftRoles(fragments: GeneratedTextDraftFragment[], boundary: GroundingBoundary): GeneratedTextDraftFragment[] {
  const expectedRoles = getExpectedDraftRoles(boundary.pageRole);
  const byRole = new Map<string, GeneratedTextDraftFragment>();

  fragments.forEach((fragment, index) => {
    const role = fragment.role && expectedRoles.includes(fragment.role) ? fragment.role : expectedRoles[index];
    if (role && !byRole.has(role)) {
      byRole.set(role, {
        ...fragment,
        role,
      });
    }
  });

  return expectedRoles.map((role) => {
    const fragment = byRole.get(role);
    return {
      role,
      label: fragment?.label || role,
      text: fragment?.text || fallbackGroundedText(role, boundary, role),
    };
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
      return normalizeDraftRoles(constrainFragments(fragments.slice(0, boundary.pageRole === "summary" ? 5 : 6), boundary), boundary);
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

  return normalizeDraftRoles(constrainFragments(fallbackFragments, boundary), boundary);
}

function normalizeOutlineRole(value: unknown): GeneratedOutlinePageRole {
  if (value === "overview" || value === "data" || value === "case-study" || value === "summary" || value === "feature") {
    return value;
  }

  return "feature";
}

function normalizeExpressionMode(value: unknown, role: GeneratedOutlinePageRole): ExpressionMode {
  if (value === "text" || value === "mixed-media" || value === "chart" || value === "hybrid") {
    return value;
  }

  if (role === "data") {
    return "chart";
  }

  if (role === "case-study") {
    return "mixed-media";
  }

  return "text";
}

function stripOutlineMeta(value: string) {
  return normalizeWhitespace(value)
    .replace(/^(本页|这页|这一页|页面)\s*/, "")
    .replace(/^(封面|封面页|目录|目录页|封底|封底页|包装页|前置包装页|后置包装页)\s*[：:·\-—、]?\s*/g, "")
    .replace(/(应该|需要|负责|用于|承担)\s*(说明|承接|组织|展示)?/g, "")
    .trim();
}

function containsPackagingPageIntent(value: string) {
  return /(封面页?|目录页?|封底页?|包装页|前置包装|后置包装|刊名|封面主视觉|目录导航)/.test(value);
}

function parseOutlinePlan(raw: string, expectedPageCount?: number | null): GeneratedOutlinePagePlan[] {
  const cleaned = stripThinking(raw);
  const payload = JSON.parse(extractJsonPayload(cleaned)) as {
    pages?: Array<{
      title?: unknown;
      outlineText?: unknown;
      suggestedPageRole?: unknown;
      expressionMode?: unknown;
      styleText?: unknown;
      userConstraints?: unknown;
      sourceNeeds?: unknown;
      layoutIntent?: unknown;
    }>;
  };

  const pages = Array.isArray(payload.pages) ? payload.pages : [];
  const limit = Math.max(1, Math.min(expectedPageCount ?? pages.length, 12));

  return pages
    .slice(0, limit)
    .map((item, index) => {
      const role = normalizeOutlineRole(item.suggestedPageRole);
      const title = stripOutlineMeta(typeof item.title === "string" ? item.title : `内容页 ${index + 1}`) || `内容页 ${index + 1}`;
      const rawOutlineText = typeof item.outlineText === "string" ? item.outlineText : "";
      const outlineText = stripOutlineMeta(rawOutlineText);
      const safeOutlineText =
        containsPackagingPageIntent(rawOutlineText) && !outlineText
          ? `${title}：围绕当前主题展开读者真正需要阅读的正文内容，不生成封面、目录或其他包装页。`
          : outlineText;

      return {
        title,
        outlineText: safeOutlineText || `${title}：围绕当前主题展开一个独立内容侧面。`,
        suggestedPageRole: role,
        expressionMode: normalizeExpressionMode(item.expressionMode, role),
        styleText: stripOutlineMeta(typeof item.styleText === "string" ? item.styleText : "") || "克制、清晰、适合页级阅读",
        userConstraints:
          stripOutlineMeta(typeof item.userConstraints === "string" ? item.userConstraints : "") ||
          "保持内容聚焦，避免重复其他页面的判断。",
        sourceNeeds: typeof item.sourceNeeds === "string" ? stripOutlineMeta(item.sourceNeeds) : undefined,
        layoutIntent: typeof item.layoutIntent === "string" ? stripOutlineMeta(item.layoutIntent) : undefined,
      };
    })
    .filter((item) => item.title && item.outlineText);
}

function getBoundaryPageRole(page: Page): GroundingBoundary["pageRole"] {
  if (page.pageRole === "summary") {
    return "summary";
  }
  if (page.pageType.includes("数据")) {
    return "data";
  }
  if (page.pageRole === "case-study" || page.pageType.includes("案例")) {
    return "case";
  }
  if (page.pageRole === "feature") {
    return "feature";
  }
  return "overview";
}

function buildGroundingBoundary({ page }: OverviewGenerationRequest | SummaryGenerationRequest | ContentPageGenerationRequest): GroundingBoundary {
  const sourceText = [page.pageType, getNarrativeTopic(page), page.outlineText, ...getUserTextSources(page)].filter(Boolean).join(" ");
  return {
    normalizedSource: normalizeForGrounding(sourceText),
    fallbackTopic: getNarrativeTopic(page),
    pageRole: getBoundaryPageRole(page),
  };
}

function buildAllowedSource({ page }: OverviewGenerationRequest | SummaryGenerationRequest | ContentPageGenerationRequest) {
  const userSources = getUserTextSources(page);
  return [
    `页面类型：${page.pageType}`,
    `主题对象：${getNarrativeTopic(page)}`,
    ...(userSources.length ? userSources.map((source, index) => `用户素材 ${index + 1}：${source}`) : ["用户素材：未提供"]),
  ];
}

function buildDataPrompt(request: ContentPageGenerationRequest) {
  const allowedSource = buildAllowedSource(request);

  return [
    "你是 PagesCut 的中文刊物编辑。请为一个 data 内容页生成图表支撑型草稿。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"fragments\":[{\"role\":\"dataSummary\",\"label\":\"...\",\"text\":\"...\"}]}",
    "必须输出 5 个 fragments，role 只能是：dataSummary、dataChartBrief、dataChartExplanation、dataTakeaway、dataSourceNote。",
    "每个 role 的 text 必须明显不同；每段 35-75 字中文；只写当前主题的数据页内容，不写页面策略。",
    "dataChartBrief 写成图表应表达的内容简述，不要编造具体数值；dataChartExplanation 写成图表解释正文。",
    ...buildMetaNarrationPromptLines(),
    ...buildTruthfulnessPromptLines(),
    "允许输入：",
    ...allowedSource,
  ].join("\n");
}

function buildCasePrompt(request: ContentPageGenerationRequest) {
  const allowedSource = buildAllowedSource(request);

  return [
    "你是 PagesCut 的中文刊物编辑。请为一个 case 内容页生成案例叙事型草稿。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"fragments\":[{\"role\":\"caseSubject\",\"label\":\"...\",\"text\":\"...\"}]}",
    "必须输出 7 个 fragments，role 只能是：caseSubject、caseVisualBrief、caseScenario、caseChallenge、caseAction、caseResult、caseTakeaway。",
    "每个 role 的 text 必须明显不同；每段 35-80 字中文；只写当前主题的案例内容，不写页面策略。",
    "caseVisualBrief 写成可用于图片搜索或图片生成的视觉需求描述，不要声称已经有真实图片。",
    ...buildMetaNarrationPromptLines(),
    ...buildTruthfulnessPromptLines(),
    "允许输入：",
    ...allowedSource,
  ].join("\n");
}

function buildFeaturePrompt(request: ContentPageGenerationRequest) {
  const allowedSource = buildAllowedSource(request);

  return [
    "你是 PagesCut 的中文刊物编辑。请为一个 feature 中段内容页生成专题展开草稿。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"fragments\":[{\"role\":\"featureHero\",\"label\":\"...\",\"text\":\"...\"}]}",
    "必须输出 5 个 fragments，role 只能是：featureHero、featureAngle、featureDetail、featureEvidence、featureTakeaway。",
    "每个 role 的 text 必须明显不同；每段 40-85 字中文；直接展开当前主题的一个独立侧面，不写页面策略。",
    ...buildMetaNarrationPromptLines(),
    ...buildTruthfulnessPromptLines(),
    "允许输入：",
    ...allowedSource,
  ].join("\n");
}

function buildTruthfulnessPromptLines() {
  return [
    "真实性边界：只能使用下方“允许输入”中出现的信息。",
    "严格禁止编造允许输入中没有出现的公司名、模型名、融资金额、百分比、排名、日期或具体指标。",
    "如果允许输入不足，只能围绕主题对象、趋势关系、读者价值、后续观察和未核验细节保持概括表达。",
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

function buildOutlinePlanPrompt(input: NormalizedTaskInput) {
  const desiredPageCount = Math.max(1, Math.min(input.desiredPageCount ?? 4, 12));

  return [
    "你是 PagesCut 的刊物/报告页级策划模型。请根据用户任务生成 Stage 1 的内容页大纲计划。",
    "只输出 JSON，不要输出 Markdown，不要解释。",
    "JSON 格式：{\"pages\":[{\"title\":\"...\",\"outlineText\":\"...\",\"suggestedPageRole\":\"overview|data|case-study|summary|feature\",\"expressionMode\":\"text|mixed-media|chart|hybrid\",\"styleText\":\"...\",\"userConstraints\":\"...\",\"sourceNeeds\":\"...\",\"layoutIntent\":\"...\"}]}",
    `必须输出 ${desiredPageCount} 个内容页；不要默认固定为 overview/data/case/summary 四页，也不要强制四种页型都出现。`,
    "PagesCut 阶段边界：Stage 1 只生成内容页大纲；封面、目录、封底、前置包装页、后置包装页会在后续 packaging 阶段生成，绝不能出现在 pages[] 中。",
    "内容页计数不包含封面、目录、封底；如果用户要求至少 7 页内容页，pages[] 就必须是 7 个正文内容页。",
    "title 禁止以“封面、目录、封底、包装页、刊名、封面主视觉、目录导航”开头或命名。",
    "suggestedPageRole 必须从以下值选择：overview、data、case-study、summary、feature。",
    "页型选择规则：overview 适合开场综述；data 只在需要数据/图表支撑时使用；case-study 只在适合案例叙事时使用；summary 适合最后收束；feature 用于专题拆解、观察、影响、风险等中段内容。",
    "expressionMode 必须结合页型和素材需求选择：text、mixed-media、chart、hybrid。",
    "layoutIntent 只写轻量布局意图，例如 hero+text、chartExplanationPair、imageTextPair、text panels；不要输出具体 HTML/CSS。",
    "outlineText 必须直接描述这一页要讲的作品内容，不要写页面职责说明、contract、调试信息或开发计划。",
    "请让相邻页面主题不同，避免复读同一段主题判断。",
    `作品类型：${input.taskType === "magazine" ? "月刊" : "报告 / PPT"}`,
    `用户任务：${input.prompt}`,
    `标准化指令：${input.normalizedInstruction}`,
  ].join("\n");
}

export class OllamaGenerationProvider implements GenerationProvider {
  constructor(private readonly config: GenerationProviderConfig) {}

  private async generateRaw(prompt: string) {
    if (!this.config.endpoint || !this.config.model) {
      throw new Error("Ollama generation provider requires endpoint and model config");
    }

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
    return body.response ?? "";
  }

  private async generateDraft(
    request: OverviewGenerationRequest | SummaryGenerationRequest,
    prompt: string,
    emptyErrorMessage: string,
  ): Promise<GeneratedTextDraftResult> {
    const boundary = buildGroundingBoundary(request);
    const raw = await this.generateRaw(prompt);
    const fragments = parseFragments(raw, boundary);
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

  async generateOutlinePlan(input: NormalizedTaskInput, _context: ProviderContext): Promise<GeneratedOutlinePlanResult> {
    const prompt = buildOutlinePlanPrompt(input);
    const raw = await this.generateRaw(prompt);
    const pages = parseOutlinePlan(raw, input.desiredPageCount);

    if (!pages.length) {
      throw new Error("Ollama generation returned no usable outline pages");
    }

    return {
      providerType: this.config.providerType,
      model: this.config.model,
      sourceId: `${this.config.providerType}:${this.config.model}`,
      prompt,
      pages,
    };
  }

  async generateOverviewDraft(request: OverviewGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildOverviewPrompt(request), "Ollama generation returned no usable overview fragments");
  }

  async generateSummaryDraft(request: SummaryGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildSummaryPrompt(request), "Ollama generation returned no usable summary fragments");
  }

  async generateDataDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildDataPrompt(request), "Ollama generation returned no usable data fragments");
  }

  async generateCaseDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildCasePrompt(request), "Ollama generation returned no usable case fragments");
  }

  async generateFeatureDraft(request: ContentPageGenerationRequest, _context: ProviderContext): Promise<GeneratedTextDraftResult> {
    return this.generateDraft(request, buildFeaturePrompt(request), "Ollama generation returned no usable feature fragments");
  }
}
