import type { PageModel } from "@/types/pageModel";

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

export interface PackagingCompositionSource {
  candidateId: string;
  pageId: string;
  pageRole: Extract<PageRole, "cover" | "toc">;
  candidateLabel: string;
  promptNote: string;
  summary: string;
  basedOnContentVersionId: string;
}

export interface GeneratedCoverContent {
  title: string;
  subtitle: string;
  summary: string;
  footerNote: string;
  kicker?: string;
  heroLabel?: string;
  issueLabel?: string;
  brandLabel?: string;
}

export interface GeneratedTocContent {
  title: string;
  subtitle: string;
  summary: string;
  footerNote: string;
  tocEntries: string[];
  guidanceNote?: string;
}

export type HardEditElementKind =
  | "hero-title"
  | "hero-summary"
  | "rich-text"
  | "callout-body"
  | "bullet-list"
  | "visual-caption"
  | "visual-kicker"
  | "chart-title"
  | "packaging-title"
  | "packaging-subtitle"
  | "packaging-kicker"
  | "packaging-hero"
  | "packaging-guidance"
  | "packaging-footer";

export type HardEditFormalSourceKind = "TextSourceFragment" | "ImageSourceAsset" | "ChartBriefSource";
export type HardEditSourceAlignmentStatus = "aligned" | "edited" | "unknown";

export interface HardEditSourceReference {
  id: string;
  kind: HardEditFormalSourceKind;
  label: string;
  detail: string;
}

export interface HardEditEditableElement {
  id: string;
  label: string;
  kind: HardEditElementKind;
  sourcePath: string;
  value: string;
  multiline: boolean;
  sourceReferences?: HardEditSourceReference[];
  sourceAlignmentSnapshot?: string;
  sourceAlignmentStatus?: HardEditSourceAlignmentStatus;
  sourceAlignmentNote?: string;
}

export interface PackagingPageFormal {
  id: string;
  taskId: string;
  pageId: string;
  pageRole: Extract<PageRole, "cover" | "toc">;
  pageType: string;
  pageBucket: Extract<PageBucket, "front" | "rear">;
  sourceCandidateId: string;
  basedOnContentVersionId: string;
  candidateLabel: string;
  promptNote: string;
  summary: string;
  title: string;
  subtitle: string;
  footerNote: string;
  kicker?: string;
  heroLabel?: string;
  issueLabel?: string;
  brandLabel?: string;
  tocEntries?: string[];
  guidanceNote?: string;
}

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
  pageModelsByPageId?: Record<string, PageModel>;
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
  generatedCoverContent?: GeneratedCoverContent;
  generatedTocContent?: GeneratedTocContent;
  isSelected: boolean;
  isApproved: boolean;
  createdAt: string;
}

export interface FinalComposition {
  id: string;
  taskId: string;
  approvedContentVersionId: string;
  contentPageIds: string[];
  packagingPageIds: string[];
  frontSourcePageIds: string[];
  contentSourcePageIds: string[];
  rearSourcePageIds: string[];
  orderedSourcePageIds: string[];
  approvedPackagingCandidateIds: string[];
  frontApprovedPackagingCandidateIds: string[];
  rearApprovedPackagingCandidateIds: string[];
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
  sourcePackagingCandidateId?: string;
  sourcePackaging?: PackagingCompositionSource;
  sourcePackagingPageId?: string;
  sourcePackagingPage?: PackagingPageFormal;
  pageKind: PageKind;
  pageRole: PageRole;
  pageType: string;
  pageBucket: PageBucket;
  orderIndex: number;
  sourcePageModel?: PageModel;
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
  sourceObjectKind: "content-page-model" | "packaging-formal-page" | "legacy-source-page";
  sourcePreviewHtml: string;
  editableElements: HardEditEditableElement[];
  title: string;
  subtitle: string;
  bodyText: string;
  imageCaption: string;
  chartCaption: string;
  footerNote: string;
  isDirty: boolean;
  lastSavedAt: string;
}

export interface EditedCompositionPageResult {
  id: string;
  taskId: string;
  compositionId: string;
  compositionPageId: string;
  sourcePageId: string;
  sourceVersionId: string;
  sourceObjectKind: "content-page-model" | "packaging-formal-page" | "legacy-source-page";
  editableElements: HardEditEditableElement[];
  title: string;
  subtitle: string;
  bodyText: string;
  imageCaption: string;
  chartCaption: string;
  footerNote: string;
  editedPageModel?: PageModel;
  editedPackagingPage?: PackagingPageFormal;
  previewHtml: string;
  updatedAt: string;
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
  resultSourceKind: "edited-result" | "composition-default" | "legacy-fallback";
  editedPageCount: number;
  status: "preparing" | "processing" | "completed" | "failed";
}
