export type WorkType = "magazine" | "report";
export type StageKey = "outline" | "candidates" | "packaging" | "hard-edit" | "export";
export type SourceMode = "user" | "system";
export type ExpressionMode = "text" | "mixed-media" | "chart" | "hybrid";
export type UserProvidedBlockType = "text" | "image" | "chart_desc" | "table";
export type PageKind = "packaging" | "content";
export type PageRole = "cover" | "toc" | "overview" | "case-study" | "feature" | "summary";

export interface Project {
  id: string;
  name: string;
  taskIds: string[];
  isDefault?: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  prompt: string;
  workType: WorkType;
  plannedPageCount: number;
  hasGeneratedCoverPage: boolean;
  hasDerivedTocPage: boolean;
  packagingStageStatus: "pending" | "ready" | "approved";
  currentStage: StageKey;
  selectedPageId: string;
  pageIds: string[];
  status: "draft" | "in_progress" | "ready_for_export";
  createdAt: string;
}

interface UserProvidedContentBlockBase {
  id: string;
  type: UserProvidedBlockType;
}

export interface TextContentBlock extends UserProvidedContentBlockBase {
  type: "text";
  text: string;
}

export interface ImageContentBlock extends UserProvidedContentBlockBase {
  type: "image";
  imageUrl: string;
  altText: string;
  caption: string;
}

export interface ChartDescContentBlock extends UserProvidedContentBlockBase {
  type: "chart_desc";
  description: string;
  chartTypeHint: string;
}

export interface TableContentBlock extends UserProvidedContentBlockBase {
  type: "table";
  rawInput: string;
  columns: string[];
  rows: string[][];
}

export type UserProvidedContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | ChartDescContentBlock
  | TableContentBlock;

export interface CoverPageMeta {
  title: string;
  subtitle: string;
  issueLabel: string;
  heroLabel: string;
  brandLabel: string;
  kicker: string;
}

export interface Page {
  id: string;
  taskId: string;
  index: number;
  renderSeed: number;
  pageKind: PageKind;
  pageRole: PageRole;
  pageType: string;
  outlineText: string;
  sourceMode: SourceMode;
  expressionMode: ExpressionMode;
  styleText: string;
  userConstraints: string;
  isConfirmed: boolean;
  isSaved: boolean;
  userProvidedContentBlocks: UserProvidedContentBlock[];
  coverMeta: CoverPageMeta | null;
}

export interface PageVersion {
  id: string;
  taskId: string;
  versionLabel: string;
  promptNote: string;
  variantSummary: string;
  derivedFromVersionId: string | null;
  previewsByPageId: Record<string, string>;
  isSelected: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface HardEditPageDraft {
  id: string;
  taskId: string;
  pageId: string;
  sourceVersionId: string;
  sourcePreviewHtml: string;
  title: string;
  subtitle: string;
  bodyText: string;
  imageCaption: string;
  chartCaption: string;
  footerNote: string;
  isDirty: boolean;
  lastSavedAt: string;
}

export interface Asset {
  id: string;
  taskId: string;
  fileName: string;
  workType: WorkType;
  createdAt: string;
  downloadUrl: string;
  status: "processing" | "completed" | "failed";
}
