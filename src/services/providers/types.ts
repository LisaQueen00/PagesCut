import type { Page, PageVersion, Task, WorkType } from "@/types/domain";

export interface NormalizedTaskRequest {
  rawPrompt: string;
  workType: WorkType;
  desiredPageCount?: number | null;
}

export interface NormalizedTaskInput {
  taskType: WorkType;
  prompt: string;
  normalizedInstruction: string;
  desiredPageCount?: number | null;
}

export interface OutlineGenerationResult {
  task: Task;
  pages: Page[];
}

export interface PageGenerationRequest {
  taskId: string;
  pageId: string;
  prompt: string;
}

export interface ProviderContext {
  stage: "outline" | "page-generation";
}

export interface OutlineProvider {
  normalizeTaskInput(request: NormalizedTaskRequest, context: ProviderContext): Promise<NormalizedTaskInput>;
  generateInitialOutline(input: NormalizedTaskInput, context: ProviderContext): Promise<OutlineGenerationResult>;
}

export interface PageGenerationProvider {
  generateCandidates(request: PageGenerationRequest, context: ProviderContext): Promise<PageVersion[]>;
}

export interface SearchProvider {
  search(query: string, limit?: number): Promise<string[]>;
}
