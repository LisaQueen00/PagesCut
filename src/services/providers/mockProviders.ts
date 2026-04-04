import { createSeedTask } from "@/mocks/data";
import type {
  NormalizedTaskInput,
  NormalizedTaskRequest,
  OutlineGenerationResult,
  OutlineProvider,
  PageGenerationRequest,
  PageGenerationProvider,
  ProviderContext,
  SearchProvider,
} from "@/services/providers/types";
import type { PageVersion } from "@/types/domain";

function delay<T>(value: T, timeout = 600): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), timeout));
}

export class MockOutlineProvider implements OutlineProvider {
  async normalizeTaskInput(request: NormalizedTaskRequest, _context: ProviderContext): Promise<NormalizedTaskInput> {
    const normalizedInstruction = `请为 ${request.workType === "magazine" ? "月刊" : "报告 / PPT"} 任务建立页级大纲，确保结构清晰、支持后续候选页生成。原始任务：${request.rawPrompt}`;
    return delay({
      taskType: request.workType,
      prompt: request.rawPrompt,
      normalizedInstruction,
      desiredPageCount: request.desiredPageCount ?? null,
    });
  }

  async generateInitialOutline(input: NormalizedTaskInput, _context: ProviderContext): Promise<OutlineGenerationResult> {
    const seed = createSeedTask(input.prompt, input.taskType);
    return delay({
      task: seed.task,
      pages: seed.pages,
    }, 900);
  }
}

export class MockPageGenerationProvider implements PageGenerationProvider {
  async generateCandidates(request: PageGenerationRequest, _context: ProviderContext): Promise<PageVersion[]> {
    return delay([
      {
        id: `version-${request.pageId}-mock`,
        taskId: request.taskId,
        versionLabel: "V-next",
        promptNote: request.prompt,
        variantSummary: "服务层 mock 候选版本",
        derivedFromVersionId: null,
        previewsByPageId: {
          [request.pageId]: "<section><h1>Mock Candidate</h1><p>Phase 1 service placeholder.</p></section>",
        },
        isSelected: true,
        isApproved: false,
        createdAt: new Date().toISOString(),
      },
    ]);
  }
}

export class MockSearchProvider implements SearchProvider {
  async search(query: string, limit = 3): Promise<string[]> {
    return delay(Array.from({ length: limit }, (_, index) => `${query} - mock reference ${index + 1}`), 300);
  }
}
