import { MockOutlineProvider, MockPageGenerationProvider, MockSearchProvider } from "@/services/providers/mockProviders";
import { generationProviderConfig } from "@/services/generationSettings";
import { OllamaGenerationProvider } from "@/services/providers/ollamaGenerationProvider";
import type { GeneratedOutlinePagePlan, NormalizedTaskInput } from "@/services/providers/types";
import type { ExpressionMode, Page, PageRole, Task, UserProvidedContentBlock, WorkType } from "@/types/domain";

const outlineProvider = new MockOutlineProvider();
const generationProvider = new OllamaGenerationProvider(generationProviderConfig);

function parseDesiredPageCount(prompt: string) {
  const normalized = prompt.replace(/\s+/g, "");
  const digitMatch = normalized.match(/(?:至少|不少于|不低于|>=|≥)?(\d{1,2})(?:个)?(?:内容)?页/);
  if (digitMatch?.[1]) {
    return Number.parseInt(digitMatch[1], 10);
  }

  const chineseDigits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  const chineseMatch = normalized.match(/(?:至少|不少于|不低于)?([一二两三四五六七八九十])(?:个)?(?:内容)?页/);
  return chineseMatch?.[1] ? chineseDigits[chineseMatch[1]] ?? null : null;
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampText(value: string, limit: number, fallback: string) {
  const normalized = value.replace(/\s+/g, " ").trim() || fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit).trim()}...` : normalized;
}

function mapOutlineRoleToPageRole(role: GeneratedOutlinePagePlan["suggestedPageRole"]): PageRole {
  if (role === "data") {
    return "feature";
  }

  return role;
}

function stripPackagingPageLabel(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(封面|封面页|目录|目录页|封底|封底页|包装页|前置包装页|后置包装页)\s*[：:·\-—、]?\s*/g, "")
    .replace(/^(刊名|封面主视觉|目录导航)\s*[：:·\-—、]?\s*/g, "")
    .trim();
}

function normalizePageType(title: string, role: GeneratedOutlinePagePlan["suggestedPageRole"]) {
  const normalized = stripPackagingPageLabel(title);
  if (role === "data" && !normalized.includes("数据")) {
    return `${normalized}数据页`;
  }

  if (role === "case-study" && !normalized.includes("案例")) {
    return `${normalized}案例`;
  }

  if (role === "overview" && !normalized.includes("综述")) {
    return `${normalized}综述`;
  }

  if (role === "summary" && !normalized.includes("总结") && !normalized.includes("结语")) {
    return `${normalized}总结`;
  }

  return normalized || "内容页";
}

function normalizeOutlineText(plan: GeneratedOutlinePagePlan) {
  const sanitized = stripPackagingPageLabel(plan.outlineText);
  if (/(封面页?|目录页?|封底页?|包装页|前置包装|后置包装|刊名|封面主视觉|目录导航)/.test(plan.outlineText) && !sanitized) {
    return `${stripPackagingPageLabel(plan.title) || "内容页"}：围绕当前主题展开正文内容，不生成封面、目录或其他包装页。`;
  }

  return sanitized || `${stripPackagingPageLabel(plan.title) || "内容页"}：围绕当前主题展开一个独立内容侧面。`;
}

function createOutlinePlanSourceBlocks(plan: GeneratedOutlinePagePlan): UserProvidedContentBlock[] {
  if (plan.suggestedPageRole === "data") {
    return [
      {
        id: createId("block"),
        type: "text",
        text: plan.sourceNeeds || `${plan.title} 需要一段数据解释素材，用于说明关键指标和趋势关系。`,
      },
      {
        id: createId("block"),
        type: "chart_desc",
        description: plan.sourceNeeds || `${plan.title} 的图表需要突出关键变化、对比关系和判断落点。`,
        chartTypeHint: "bar",
      },
      {
        id: createId("block"),
        type: "table",
        rawInput: "指标,观察项,说明\n核心变化,待补充,由后续 source formalization 承接\n支撑信号,待补充,由后续 source formalization 承接",
        columns: ["指标", "观察项", "说明"],
        rows: [
          ["核心变化", "待补充", "由后续 source formalization 承接"],
          ["支撑信号", "待补充", "由后续 source formalization 承接"],
        ],
      },
    ];
  }

  if (plan.suggestedPageRole === "case-study") {
    return [
      {
        id: createId("block"),
        type: "image",
        imageUrl: "mock://outline-case-1",
        altText: `${plan.title} 场景图`,
        caption: plan.sourceNeeds || `${plan.title} 的案例场景占位，需要后续绑定真实图片来源。`,
      },
      {
        id: createId("block"),
        type: "text",
        text: plan.sourceNeeds || `${plan.title} 需要说明案例对象、关键动作和结果关系。`,
      },
    ];
  }

  return [];
}

function buildTaskFromOutlinePlan(input: NormalizedTaskInput, pages: GeneratedOutlinePagePlan[]) {
  const projectId = "project-default";
  const taskId = createId("task");
  const now = new Date().toISOString();
  const contentPages: Page[] = pages.map((plan, index) => {
    const expressionMode: ExpressionMode = plan.expressionMode;

    return {
      id: createId("page"),
      taskId,
      index: index + 1,
      renderSeed: 0,
      pageKind: "content",
      pageRole: mapOutlineRoleToPageRole(plan.suggestedPageRole),
      pageType: normalizePageType(plan.title, plan.suggestedPageRole),
      outlineText: normalizeOutlineText(plan),
      sourceMode: plan.suggestedPageRole === "data" || plan.suggestedPageRole === "case-study" ? "user" : "system",
      expressionMode,
      styleText: plan.styleText,
      userConstraints: [plan.userConstraints, plan.sourceNeeds ? `来源需求：${plan.sourceNeeds}` : "", plan.layoutIntent ? `布局意图：${plan.layoutIntent}` : ""]
        .filter(Boolean)
        .join("；"),
      isConfirmed: false,
      isSaved: index === 0,
      userProvidedContentBlocks: createOutlinePlanSourceBlocks(plan),
      coverMeta: null,
    };
  });

  const task: Task = {
    id: taskId,
    projectId,
    title: clampText(input.prompt, 18, input.taskType === "magazine" ? "月刊任务" : "报告任务"),
    prompt: input.prompt,
    workType: input.taskType,
    plannedPageCount: contentPages.length,
    hasGeneratedCoverPage: false,
    hasDerivedTocPage: false,
    packagingStageStatus: "pending",
    currentStage: "outline",
    preferredExportFormat: input.taskType === "magazine" ? "pdf" : "pptx",
    selectedPageId: contentPages[0]?.id ?? "",
    pageIds: contentPages.map((page) => page.id),
    status: "in_progress",
    createdAt: now,
  };

  return {
    task,
    pages: contentPages,
  };
}

export const services = {
  outlineProvider,
  pageGenerationProvider: new MockPageGenerationProvider(),
  generationProvider,
  generationProviderConfig,
  searchProvider: new MockSearchProvider(),
  async createTaskFromPrompt(prompt: string, workType: WorkType) {
    const normalized = await outlineProvider.normalizeTaskInput(
      {
        rawPrompt: prompt,
        workType,
        desiredPageCount: parseDesiredPageCount(prompt),
      },
      { stage: "outline" },
    );

    try {
      const outlinePlan = await generationProvider.generateOutlinePlan(normalized, { stage: "outline" });
      if (normalized.desiredPageCount && outlinePlan.pages.length < normalized.desiredPageCount) {
        throw new Error(`Outline provider returned ${outlinePlan.pages.length} pages, expected ${normalized.desiredPageCount}`);
      }

      return buildTaskFromOutlinePlan(normalized, outlinePlan.pages);
    } catch (error) {
      console.warn("Outline provider generation failed; falling back to mock outline.", error);
      return outlineProvider.generateInitialOutline(normalized, { stage: "outline" });
    }
  },
};
