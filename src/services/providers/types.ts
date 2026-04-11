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

export type GenerationProviderType = "ollama-local" | "remote-placeholder";
export type GenerationProviderConfigSource =
  | "workspace-default"
  | "environment"
  | "page-config-placeholder"
  | "admin-config-placeholder";

export interface GenerationProviderOptions {
  temperature: number;
  topP: number;
  numPredict: number;
}

export interface GenerationTruthfulnessPolicy {
  requireGroundedOutput: boolean;
  allowUngroundedSpecificFacts: boolean;
  forbiddenSpecificFactKinds: string[];
}

export interface GenerationProviderConfig {
  providerType: GenerationProviderType;
  model: string;
  endpoint: string;
  source: GenerationProviderConfigSource;
  options: GenerationProviderOptions;
  truthfulnessPolicy: GenerationTruthfulnessPolicy;
}

export interface OverviewGenerationRequest {
  page: Page;
  promptNote: string;
}

export interface GeneratedTextDraftFragment {
  label: string;
  text: string;
}

export interface GeneratedTextDraftResult {
  providerType: GenerationProviderType;
  model: string;
  sourceId: string;
  prompt: string;
  fragments: GeneratedTextDraftFragment[];
}

export interface OutlineProvider {
  normalizeTaskInput(request: NormalizedTaskRequest, context: ProviderContext): Promise<NormalizedTaskInput>;
  generateInitialOutline(input: NormalizedTaskInput, context: ProviderContext): Promise<OutlineGenerationResult>;
}

export interface PageGenerationProvider {
  generateCandidates(request: PageGenerationRequest, context: ProviderContext): Promise<PageVersion[]>;
}

export interface GenerationProvider {
  generateOverviewDraft(request: OverviewGenerationRequest, context: ProviderContext): Promise<GeneratedTextDraftResult>;
}

export interface SearchProvider {
  search(query: string, limit?: number): Promise<string[]>;
}
