export type WorkType = "magazine" | "report";
export type StageKey = "outline" | "candidates" | "packaging" | "hard-edit" | "export";
export type ExportFormat = "pdf" | "pptx";
export type SourceMode = "user" | "system";
export type ExpressionMode = "text" | "mixed-media" | "chart" | "hybrid";
export type UserProvidedBlockType = "text" | "image" | "chart_desc" | "table";
export type PageKind = "packaging" | "content";
export type PageRole = "cover" | "toc" | "overview" | "case-study" | "feature" | "summary";
export type PageBucket = "front" | "content" | "rear";
export type CompositionSourceKind = "content-page" | "packaging-page";

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
  preferredExportFormat: ExportFormat;
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

export interface PackagingPageCandidate {
  id: string;
  taskId: string;
  pageId: string;
  pageRole: Extract<PageRole, "cover" | "toc">;
  candidateLabel: string;
  promptNote: string;
  summary: string;
  derivedFromCandidateId: string | null;
  basedOnContentVersionId: string;
  previewHtml: string;
  isSelected: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface FinalComposition {
  id: string;
  taskId: string;
  approvedContentVersionId: string;
  packagingPageIds: string[];
  approvedPackagingCandidateIds: string[];
  frontCompositionPageIds: string[];
  contentCompositionPageIds: string[];
  rearCompositionPageIds: string[];
  orderedCompositionPageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FinalCompositionPage {
  id: string;
  compositionId: string;
  taskId: string;
  sourcePageId: string;
  sourceKind: CompositionSourceKind;
  sourceVersionId: string;
  pageKind: PageKind;
  pageRole: PageRole;
  pageType: string;
  pageBucket: PageBucket;
  orderIndex: number;
  previewHtml: string;
  createdAt: string;
}

export interface HardEditPageDraft {
  id: string;
  taskId: string;
  compositionId: string;
  compositionPageId: string;
  sourcePageId: string;
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
  compositionId: string;
  title: string;
  fileName: string;
  workType: WorkType;
  exportFormat: ExportFormat;
  pageCount: number;
  description: string;
  sourceVersionId: string;
  createdAt: string;
  downloadUrl: string;
  fileMimeType: string;
  fileSizeBytes: number;
  readyAt: string | null;
  errorMessage: string;
  status: "preparing" | "processing" | "completed" | "failed";
}
