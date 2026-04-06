import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generatePdfFromFinalComposition } from "@/lib/pdfExport";
import { isValidTaskVersion } from "@/lib/versionValidation";
import { canEnterCandidatesStage, canEnterExportStage, canEnterHardEditStage, canEnterPackagingStage } from "@/lib/workflowGuards";
import {
  buildMockPreviewHtml,
  buildMockPageModel,
  buildPackagingPreviewHtml,
  createDeferredPackagingPages,
  createInitialPageVersions,
  createSeedTask,
  getMockVersionStrategySummary,
} from "@/mocks/data";
import { services } from "@/services";
import type {
  Asset,
  FinalComposition,
  FinalCompositionPage,
  HardEditPageDraft,
  PackagingPageCandidate,
  Page,
  PageVersion,
  Project,
  StageKey,
  Task,
  UserProvidedBlockType,
  UserProvidedContentBlock,
  WorkType,
} from "@/types/domain";

interface AppState {
  projects: Project[];
  tasks: Task[];
  pages: Page[];
  packagingPages: Page[];
  packagingCandidates: PackagingPageCandidate[];
  pageVersions: PageVersion[];
  finalCompositions: FinalComposition[];
  finalCompositionPages: FinalCompositionPage[];
  hardEditDrafts: HardEditPageDraft[];
  assets: Asset[];
  activeTaskId: string | null;
  isBootstrapped: boolean;
  isGenerating: boolean;
  bootstrap: () => void;
  createTask: (prompt: string, workType: WorkType) => Promise<Task>;
  setActiveTask: (taskId: string) => void;
  setTaskStage: (taskId: string, stage: StageKey) => void;
  setTaskWorkType: (taskId: string, workType: WorkType) => void;
  setTaskPreferredExportFormat: (taskId: string, format: "pdf" | "pptx") => void;
  setTaskSelectedPage: (taskId: string, pageId: string) => void;
  canEnterCandidatesStage: (taskId: string) => boolean;
  canEnterPackagingStage: (taskId: string) => boolean;
  canEnterHardEditStage: (taskId: string) => boolean;
  canEnterExportStage: (taskId: string) => boolean;
  getTaskFinalComposition: (taskId: string) => FinalComposition | undefined;
  enterCandidatesStage: (taskId: string) => void;
  enterPackagingStage: (taskId: string) => void;
  regeneratePackagingPage: (taskId: string, pageId: string) => void;
  selectPackagingCandidate: (taskId: string, pageId: string, candidateId: string) => void;
  approvePackagingCandidate: (taskId: string, pageId: string, candidateId: string) => void;
  enterHardEditStage: (taskId: string) => void;
  enterExportStage: (taskId: string) => void;
  createAssetFromFinalComposition: (taskId: string) => Promise<Asset | null>;
  updateHardEditDraft: (draftId: string, patch: Partial<HardEditPageDraft>) => void;
  saveHardEditDraft: (draftId: string) => void;
  updatePage: (pageId: string, patch: Partial<Page>) => void;
  savePage: (pageId: string) => void;
  addUserProvidedBlock: (pageId: string, blockType: UserProvidedBlockType) => void;
  updateUserProvidedBlock: (pageId: string, blockId: string, patch: Partial<UserProvidedContentBlock>) => void;
  removeUserProvidedBlock: (pageId: string, blockId: string) => void;
  selectTaskVersion: (taskId: string, versionId: string) => void;
  approveTaskVersion: (taskId: string, versionId: string) => void;
  regenerateTaskVersion: (taskId: string, pageId: string, promptNote: string) => void;
}

function replaceById<T extends { id: string }>(items: T[], next: T) {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) {
    return [...items, next];
  }

  const copy = [...items];
  copy[index] = next;
  return copy;
}

function createBlockId() {
  return `block-${Math.random().toString(36).slice(2, 8)}`;
}

function createVersionId() {
  return `version-${Math.random().toString(36).slice(2, 8)}`;
}

function createPackagingCandidateId() {
  return `packaging-candidate-${Math.random().toString(36).slice(2, 8)}`;
}

function createDraftId() {
  return `draft-${Math.random().toString(36).slice(2, 8)}`;
}

function createCompositionId() {
  return `composition-${Math.random().toString(36).slice(2, 8)}`;
}

function createCompositionPageId() {
  return `composition-page-${Math.random().toString(36).slice(2, 8)}`;
}

function createAssetId() {
  return `asset-${Math.random().toString(36).slice(2, 8)}`;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseTableRawInput(rawInput: string) {
  const rows = rawInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((cell) => cell.trim()));

  if (!rows.length) {
    return {
      columns: [],
      dataRows: [],
    };
  }

  return {
    columns: rows[0],
    dataRows: rows.slice(1),
  };
}

function normalizeUserProvidedBlock(input: unknown): UserProvidedContentBlock {
  const block = (input ?? {}) as Record<string, unknown>;
  const id = asString(block.id, createBlockId());
  const rawType = asString(block.type, "text");

  if (rawType === "image") {
    return {
      id,
      type: "image",
      imageUrl: asString(block.imageUrl),
      altText: asString(block.altText),
      caption: asString(block.caption || block.value),
    };
  }

  if (rawType === "chart_desc" || rawType === "chart-note") {
    return {
      id,
      type: "chart_desc",
      description: asString(block.description || block.value),
      chartTypeHint: asString(block.chartTypeHint, "bar"),
    };
  }

  if (rawType === "table") {
    const rawInput = asString(block.rawInput || block.value);
    const parsed = parseTableRawInput(rawInput);
    return {
      id,
      type: "table",
      rawInput,
      columns: Array.isArray(block.columns) ? (block.columns as string[]) : parsed.columns,
      rows: Array.isArray(block.rows) ? (block.rows as string[][]) : parsed.dataRows,
    };
  }

  return {
    id,
    type: "text",
    text: asString(block.text || block.value),
  };
}

function normalizePage(page: Page): Page {
  const inferredRole =
    page.pageRole ??
    (page.pageType === "封面页"
      ? "cover"
      : page.pageType === "趋势综述"
        ? "overview"
        : page.pageType === "案例页"
          ? "case-study"
          : page.pageType === "结语页"
            ? "summary"
            : "feature");
  const inferredKind = page.pageKind ?? (inferredRole === "cover" || inferredRole === "toc" ? "packaging" : "content");

  return {
    ...page,
    renderSeed: typeof page.renderSeed === "number" ? page.renderSeed : 0,
    pageRole: inferredRole,
    pageKind: inferredKind,
    userProvidedContentBlocks: Array.isArray(page.userProvidedContentBlocks)
      ? page.userProvidedContentBlocks.map((block) => normalizeUserProvidedBlock(block))
      : [],
    coverMeta:
      inferredRole === "cover"
        ? page.coverMeta ?? {
            title: "AI 产业趋势月刊",
            subtitle: "聚焦模型发布、应用落地与商业化信号",
            issueLabel: "2026 / 04",
            heroLabel: "本期主题：生成式产品进入结构化落地阶段",
            brandLabel: "PagesCut Research",
            kicker: "Monthly Brief",
          }
        : null,
  };
}

function normalizePageVersion(version: PageVersion): PageVersion {
  return {
    ...version,
    isApproved: Boolean(version.isApproved),
    variantSummary: version.variantSummary || "初版候选结果",
    derivedFromVersionId: version.derivedFromVersionId ?? null,
    previewsByPageId:
      version.previewsByPageId && typeof version.previewsByPageId === "object" ? version.previewsByPageId : {},
    pageModelsByPageId:
      version.pageModelsByPageId && typeof version.pageModelsByPageId === "object" ? version.pageModelsByPageId : {},
  };
}

function normalizePackagingPageCandidate(candidate: PackagingPageCandidate): PackagingPageCandidate {
  return {
    ...candidate,
    derivedFromCandidateId: candidate.derivedFromCandidateId ?? null,
    promptNote: candidate.promptNote || "初版包装页候选",
    summary: candidate.summary || "包装页候选结果",
    previewHtml: typeof candidate.previewHtml === "string" ? candidate.previewHtml : "",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
  };
}

function normalizeFinalComposition(composition: FinalComposition): FinalComposition {
  return {
    ...composition,
    packagingPageIds: Array.isArray(composition.packagingPageIds) ? composition.packagingPageIds : [],
    approvedPackagingCandidateIds: Array.isArray(composition.approvedPackagingCandidateIds) ? composition.approvedPackagingCandidateIds : [],
    frontCompositionPageIds: Array.isArray(composition.frontCompositionPageIds) ? composition.frontCompositionPageIds : [],
    contentCompositionPageIds: Array.isArray(composition.contentCompositionPageIds) ? composition.contentCompositionPageIds : [],
    rearCompositionPageIds: Array.isArray(composition.rearCompositionPageIds) ? composition.rearCompositionPageIds : [],
    orderedCompositionPageIds: Array.isArray(composition.orderedCompositionPageIds) ? composition.orderedCompositionPageIds : [],
    createdAt: typeof composition.createdAt === "string" ? composition.createdAt : new Date().toISOString(),
    updatedAt: typeof composition.updatedAt === "string" ? composition.updatedAt : new Date().toISOString(),
  };
}

function normalizeFinalCompositionPage(page: FinalCompositionPage): FinalCompositionPage {
  return {
    ...page,
    createdAt: typeof page.createdAt === "string" ? page.createdAt : new Date().toISOString(),
    previewHtml: typeof page.previewHtml === "string" ? page.previewHtml : "",
  };
}

function normalizeHardEditDraft(draft: HardEditPageDraft): HardEditPageDraft {
  return {
    ...draft,
    lastSavedAt: typeof draft.lastSavedAt === "string" ? draft.lastSavedAt : new Date().toISOString(),
  };
}

function normalizeAsset(asset: Asset): Asset {
  return {
    ...asset,
    compositionId: typeof asset.compositionId === "string" ? asset.compositionId : "unknown-composition",
    title: typeof asset.title === "string" ? asset.title : asset.fileName,
    exportFormat: asset.exportFormat ?? (asset.workType === "magazine" ? "pdf" : "pptx"),
    pageCount: typeof asset.pageCount === "number" ? asset.pageCount : 0,
    description: typeof asset.description === "string" ? asset.description : "",
    sourceVersionId: typeof asset.sourceVersionId === "string" ? asset.sourceVersionId : "",
    downloadUrl: typeof asset.downloadUrl === "string" ? asset.downloadUrl : "",
    fileMimeType: typeof asset.fileMimeType === "string" ? asset.fileMimeType : "",
    fileSizeBytes: typeof asset.fileSizeBytes === "number" ? asset.fileSizeBytes : 0,
    readyAt: typeof asset.readyAt === "string" ? asset.readyAt : null,
    errorMessage: typeof asset.errorMessage === "string" ? asset.errorMessage : "",
    status: asset.status ?? "completed",
  };
}

function createDefaultBlock(type: UserProvidedBlockType): UserProvidedContentBlock {
  if (type === "chart_desc") {
    return {
      id: createBlockId(),
      type,
      description: "请输入图表说明，例如：对比近三个月投放转化率变化。",
      chartTypeHint: "bar",
    };
  }

  if (type === "table") {
    const rawInput = "指标,数值\n样本A,120\n样本B,160";
    const parsed = parseTableRawInput(rawInput);
    return {
      id: createBlockId(),
      type,
      rawInput,
      columns: parsed.columns,
      rows: parsed.dataRows,
    };
  }

  if (type === "image") {
    return {
      id: createBlockId(),
      type,
      imageUrl: "",
      altText: "",
      caption: "图片说明 / 图片链接占位",
    };
  }

  return { id: createBlockId(), type, text: "" };
}

function getNextVersionNumber(versions: PageVersion[]) {
  return versions.length + 1;
}

function getVersionFamilyFromLabel(versionLabel: string) {
  const numeric = Number.parseInt(versionLabel.replace(/^V/i, ""), 10);
  if (Number.isNaN(numeric) || numeric <= 0) {
    return 0;
  }

  return (numeric - 1) % 3;
}

function createMockGeneratedVersion(
  taskId: string,
  pages: Page[],
  focusPage: Page,
  existingVersions: PageVersion[],
  selectedVersion: PageVersion | undefined,
  promptNote: string,
): PageVersion {
  const versionNumber = getNextVersionNumber(existingVersions);
  const versionLabel = `V${versionNumber}`;
  const variant = versionNumber - 1 + existingVersions.length;
  const promptText = promptNote.trim() || "基于当前版本再生成";
  const family = selectedVersion ? getVersionFamilyFromLabel(selectedVersion.versionLabel) : 0;
  const variantSummary = `延续${getMockVersionStrategySummary(family)}，并调整：${promptText.length > 18 ? `${promptText.slice(0, 18)}...` : promptText}`;
  const previewsByPageId = Object.fromEntries(
    pages.map((page, index) => [
      page.id,
      buildMockPreviewHtml(
        page,
        versionLabel,
        page.id === focusPage.id ? promptText : `${getMockVersionStrategySummary(family)} · ${page.pageType}`,
        variant + index,
        family,
      ),
    ]),
  );
  const pageModelsByPageId = Object.fromEntries(
    pages
      .map((page, index) => [page.id, buildMockPageModel(page, versionLabel, variant + index, family)] as const)
      .filter((entry): entry is readonly [string, NonNullable<ReturnType<typeof buildMockPageModel>>] => Boolean(entry[1])),
  );

  return {
    id: createVersionId(),
    taskId,
    versionLabel,
    promptNote: promptText,
    variantSummary,
    derivedFromVersionId: selectedVersion?.id ?? null,
    previewsByPageId,
    pageModelsByPageId,
    isSelected: true,
    isApproved: false,
    createdAt: new Date().toISOString(),
  };
}

function appendPackagingPreviewsToVersions(versions: PageVersion[], packagingPages: Page[], contentPages: Page[]) {
  return versions.map((version) => {
    const family = getVersionFamilyFromLabel(version.versionLabel);
    const packagingEntries = Object.fromEntries(
      packagingPages.map((page, index) => [
        page.id,
        buildPackagingPreviewHtml(page, contentPages, version.versionLabel, page.renderSeed + index, family),
      ]),
    );

    return normalizePageVersion({
      ...version,
      previewsByPageId: {
        ...version.previewsByPageId,
        ...packagingEntries,
      },
    });
  });
}

function getNextPackagingCandidateNumber(candidates: PackagingPageCandidate[], pageId: string) {
  return candidates.filter((candidate) => candidate.pageId === pageId).length + 1;
}

function createPackagingCandidate(
  page: Page,
  contentPages: Page[],
  approvedVersion: PageVersion,
  allCandidates: PackagingPageCandidate[],
  variantSeed: number,
  promptNote: string,
  derivedFromCandidateId: string | null,
) {
  const candidateNumber = getNextPackagingCandidateNumber(allCandidates, page.id);
  const roleLabel = page.pageRole === "cover" ? "封面方案" : "目录方案";
  const candidateLabel = `${roleLabel} ${candidateNumber}`;
  const summary =
    page.pageRole === "cover"
      ? `围绕刊名、主标题与主视觉节奏生成的${candidateLabel}`
      : `基于已确认内容结构、顺序与标题生成的${candidateLabel}`;

  return normalizePackagingPageCandidate({
    id: createPackagingCandidateId(),
    taskId: page.taskId,
    pageId: page.id,
    pageRole: page.pageRole === "cover" ? "cover" : "toc",
    candidateLabel,
    promptNote,
    summary,
    derivedFromCandidateId,
    basedOnContentVersionId: approvedVersion.id,
    previewHtml: buildPackagingPreviewHtml(page, contentPages, approvedVersion.versionLabel, variantSeed),
    isSelected: true,
    isApproved: false,
    createdAt: new Date().toISOString(),
  });
}

function createInitialPackagingCandidates(pages: Page[], contentPages: Page[], approvedVersion: PageVersion) {
  const candidates: PackagingPageCandidate[] = [];

  pages.forEach((page, index) => {
    const first = createPackagingCandidate(page, contentPages, approvedVersion, candidates, page.renderSeed + index, "初版包装页候选", null);
    candidates.push(first);
    const second = createPackagingCandidate(page, contentPages, approvedVersion, candidates, page.renderSeed + index + 1, "候选偏向：加强信息层级与版式区分", null);
    candidates.push(second);
  });

  return candidates.map((candidate, _index, items) => ({
    ...candidate,
    isSelected:
      [...items]
        .reverse()
        .find((item: PackagingPageCandidate) => item.pageId === candidate.pageId)?.id === candidate.id,
  }));
}

function createFinalComposition(
  taskId: string,
  contentPages: Page[],
  packagingPages: Page[],
  approvedVersion: PageVersion,
  packagingCandidates: PackagingPageCandidate[],
) {
  const compositionId = createCompositionId();
  const now = new Date().toISOString();
  const frontPages = packagingPages
    .filter((page) => page.pageRole === "cover" || page.pageRole === "toc")
    .sort((a, b) => {
      const aRank = a.pageRole === "cover" ? 0 : 1;
      const bRank = b.pageRole === "cover" ? 0 : 1;
      return aRank - bRank || a.index - b.index;
    });
  const rearPages = packagingPages
    .filter((page) => page.pageRole !== "cover" && page.pageRole !== "toc")
    .sort((a, b) => a.index - b.index);
  const orderedSourcePages = [...frontPages, ...contentPages.slice().sort((a, b) => a.index - b.index), ...rearPages];
  const approvedPackagingCandidateMap = new Map(
    packagingCandidates
      .filter((candidate) => candidate.isApproved)
      .map((candidate) => [candidate.pageId, candidate] as const),
  );

  const compositionPages = orderedSourcePages.map((page, index) => ({
    id: createCompositionPageId(),
    compositionId,
    taskId,
    sourcePageId: page.id,
    sourceKind: page.pageKind === "content" ? "content-page" : "packaging-page",
    sourceVersionId: page.pageKind === "content" ? approvedVersion.id : approvedPackagingCandidateMap.get(page.id)?.id ?? approvedVersion.id,
    pageKind: page.pageKind,
    pageRole: page.pageRole,
    pageType: page.pageType,
    pageBucket: page.pageKind === "content" ? "content" : page.pageRole === "cover" || page.pageRole === "toc" ? "front" : "rear",
    orderIndex: index + 1,
    previewHtml: page.pageKind === "content" ? approvedVersion.previewsByPageId[page.id] ?? "" : approvedPackagingCandidateMap.get(page.id)?.previewHtml ?? "",
    createdAt: now,
  } satisfies FinalCompositionPage));

  const frontCompositionPageIds = compositionPages.filter((page) => page.pageBucket === "front").map((page) => page.id);
  const contentCompositionPageIds = compositionPages.filter((page) => page.pageBucket === "content").map((page) => page.id);
  const rearCompositionPageIds = compositionPages.filter((page) => page.pageBucket === "rear").map((page) => page.id);

  const composition: FinalComposition = {
    id: compositionId,
    taskId,
    approvedContentVersionId: approvedVersion.id,
    packagingPageIds: packagingPages.map((page) => page.id),
    approvedPackagingCandidateIds: packagingCandidates.filter((candidate) => candidate.isApproved).map((candidate) => candidate.id),
    frontCompositionPageIds,
    contentCompositionPageIds,
    rearCompositionPageIds,
    orderedCompositionPageIds: compositionPages.map((page) => page.id),
    createdAt: now,
    updatedAt: now,
  };

  return {
    composition,
    compositionPages,
  };
}

function createHardEditDraft(
  compositionPage: FinalCompositionPage,
  sourcePage: Page | undefined,
  allContentPages: Page[],
): HardEditPageDraft {
  const now = new Date().toISOString();

  if (compositionPage.pageRole === "cover") {
    return {
      id: createDraftId(),
      taskId: compositionPage.taskId,
      compositionId: compositionPage.compositionId,
      compositionPageId: compositionPage.id,
      sourcePageId: compositionPage.sourcePageId,
      sourceVersionId: compositionPage.sourceVersionId,
      sourcePreviewHtml: compositionPage.previewHtml,
      title: sourcePage?.coverMeta?.title ?? sourcePage?.pageType ?? compositionPage.pageType,
      subtitle: sourcePage?.coverMeta?.subtitle ?? "",
      bodyText: sourcePage?.coverMeta?.heroLabel ?? "",
      imageCaption: "主视觉区域说明",
      chartCaption: "",
      footerNote: `${sourcePage?.coverMeta?.issueLabel ?? ""} · ${sourcePage?.coverMeta?.brandLabel ?? ""}`.trim(),
      isDirty: false,
      lastSavedAt: now,
    };
  }

  if (compositionPage.pageRole === "toc") {
    const contentEntries = allContentPages
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((page, index) => `${index + 1}. ${page.pageType}`)
      .join("\n");

    return {
      id: createDraftId(),
      taskId: compositionPage.taskId,
      compositionId: compositionPage.compositionId,
      compositionPageId: compositionPage.id,
      sourcePageId: compositionPage.sourcePageId,
      sourceVersionId: compositionPage.sourceVersionId,
      sourcePreviewHtml: compositionPage.previewHtml,
      title: compositionPage.pageType,
      subtitle: "目录组织与阅读导航",
      bodyText: contentEntries,
      imageCaption: "",
      chartCaption: "",
      footerNote: "目录页可在硬编辑阶段继续微调标题和顺序表达。",
      isDirty: false,
      lastSavedAt: now,
    };
  }

  const imageBlock = sourcePage?.userProvidedContentBlocks.find((block) => block.type === "image");
  const chartBlock = sourcePage?.userProvidedContentBlocks.find((block) => block.type === "chart_desc");

  return {
    id: createDraftId(),
    taskId: compositionPage.taskId,
    compositionId: compositionPage.compositionId,
    compositionPageId: compositionPage.id,
    sourcePageId: compositionPage.sourcePageId,
    sourceVersionId: compositionPage.sourceVersionId,
    sourcePreviewHtml: compositionPage.previewHtml,
    title: sourcePage?.pageType ?? compositionPage.pageType,
    subtitle: sourcePage?.styleText ?? "",
    bodyText: sourcePage?.outlineText ?? "",
    imageCaption: imageBlock?.type === "image" ? imageBlock.caption : "",
    chartCaption: chartBlock?.type === "chart_desc" ? chartBlock.description : "",
    footerNote: sourcePage?.userConstraints ?? "",
    isDirty: false,
    lastSavedAt: now,
  };
}

function rebuildLegacyCompositionState(
  tasks: Task[],
  contentPages: Page[],
  packagingPages: Page[],
  pageVersions: PageVersion[],
  packagingCandidates: PackagingPageCandidate[],
  hardEditDrafts: Array<HardEditPageDraft | Record<string, unknown>>,
) {
  const compositions: FinalComposition[] = [];
  const compositionPages: FinalCompositionPage[] = [];
  const migratedDrafts: HardEditPageDraft[] = [];

  tasks.forEach((task) => {
    const taskContentPages = contentPages.filter((page) => page.taskId === task.id).sort((a, b) => a.index - b.index);
    const taskPackagingPages = packagingPages.filter((page) => page.taskId === task.id).sort((a, b) => a.index - b.index);
    const taskVersions = pageVersions.filter((version) => version.taskId === task.id);
    const taskPackagingCandidates = packagingCandidates.filter((candidate) => candidate.taskId === task.id);

    if (!canEnterHardEditStage(taskContentPages, taskPackagingPages, taskVersions, taskPackagingCandidates)) {
      return;
    }

    const approvedVersion = taskVersions.find((version) => version.isApproved);
    if (!approvedVersion) {
      return;
    }

    const built = createFinalComposition(task.id, taskContentPages, taskPackagingPages, approvedVersion, taskPackagingCandidates);
    const pageMap = new Map(
      [...taskContentPages, ...taskPackagingPages].map((page) => [page.id, page]),
    );

    compositions.push(built.composition);
    compositionPages.push(...built.compositionPages);

    built.compositionPages.forEach((compositionPage) => {
      const legacyDraft = hardEditDrafts.find((draft) => {
        const legacy = draft as Record<string, unknown>;
        return asString(legacy.taskId) === task.id && asString(legacy.pageId) === compositionPage.sourcePageId;
      });

      if (legacyDraft) {
        const legacy = legacyDraft as Record<string, unknown>;
        migratedDrafts.push(
          normalizeHardEditDraft({
            id: asString(legacy.id, createDraftId()),
            taskId: task.id,
            compositionId: built.composition.id,
            compositionPageId: compositionPage.id,
            sourcePageId: compositionPage.sourcePageId,
            sourceVersionId: asString(legacy.sourceVersionId, compositionPage.sourceVersionId),
            sourcePreviewHtml: asString(legacy.sourcePreviewHtml, compositionPage.previewHtml),
            title: asString(legacy.title, compositionPage.pageType),
            subtitle: asString(legacy.subtitle),
            bodyText: asString(legacy.bodyText),
            imageCaption: asString(legacy.imageCaption),
            chartCaption: asString(legacy.chartCaption),
            footerNote: asString(legacy.footerNote),
            isDirty: Boolean(legacy.isDirty),
            lastSavedAt: asString(legacy.lastSavedAt, new Date().toISOString()),
          }),
        );
        return;
      }

      migratedDrafts.push(createHardEditDraft(compositionPage, pageMap.get(compositionPage.sourcePageId), taskContentPages));
    });
  });

  return {
    compositions,
    compositionPages,
    migratedDrafts,
  };
}

function rebuildLegacyPackagingCandidates(tasks: Task[], packagingPages: Page[], contentPages: Page[], pageVersions: PageVersion[]) {
  return tasks.flatMap((task) => {
    const approvedVersion = pageVersions.find((version) => version.taskId === task.id && version.isApproved);
    if (!approvedVersion) {
      return [];
    }

    const taskPackagingPages = packagingPages.filter((page) => page.taskId === task.id);
    const taskContentPages = contentPages.filter((page) => page.taskId === task.id).sort((a, b) => a.index - b.index);

    return taskPackagingPages.map((page, index) =>
      normalizePackagingPageCandidate({
        id: createPackagingCandidateId(),
        taskId: task.id,
        pageId: page.id,
        pageRole: page.pageRole === "cover" ? "cover" : "toc",
        candidateLabel: page.pageRole === "cover" ? "封面方案 1" : "目录方案 1",
        promptNote: "从旧版包装页状态迁移的当前结果",
        summary: page.pageRole === "cover" ? "沿用当前封面页结果作为默认已选包装方案" : "沿用当前目录页结果作为默认已选包装方案",
        derivedFromCandidateId: null,
        basedOnContentVersionId: approvedVersion.id,
        previewHtml: buildPackagingPreviewHtml(page, taskContentPages, approvedVersion.versionLabel, page.renderSeed + index),
        isSelected: true,
        isApproved: true,
        createdAt: new Date().toISOString(),
      }),
    );
  });
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      tasks: [],
      pages: [],
      packagingPages: [],
      packagingCandidates: [],
      pageVersions: [],
      finalCompositions: [],
      finalCompositionPages: [],
      hardEditDrafts: [],
      assets: [],
      activeTaskId: null,
      isBootstrapped: false,
      isGenerating: false,
      bootstrap: () => {
        if (get().isBootstrapped) {
          return;
        }

        const seed = createSeedTask();
        set({
          projects: [seed.project],
          tasks: [seed.task],
          pages: seed.pages.map((page) => normalizePage(page)).filter((page) => page.pageKind === "content"),
          packagingPages: [],
          packagingCandidates: [],
          pageVersions: seed.pageVersions.map((version) => normalizePageVersion(version)),
          finalCompositions: [],
          finalCompositionPages: [],
          hardEditDrafts: [],
          assets: seed.assets,
          activeTaskId: seed.task.id,
          isBootstrapped: true,
        });
      },
      createTask: async (prompt, workType) => {
        set({ isGenerating: true });
        const result = await services.createTaskFromPrompt(prompt, workType);
        const normalizedPages = result.pages.map((page) => normalizePage(page));

        set((state) => ({
          projects: replaceById(state.projects, {
            id: "project-default",
            name: "default project",
            taskIds: Array.from(new Set([...state.tasks.map((task) => task.id), result.task.id])),
            isDefault: true,
          }),
          tasks: [...state.tasks, result.task],
          pages: [...state.pages.filter((page) => page.taskId !== result.task.id), ...normalizedPages.filter((page) => page.pageKind === "content")],
          packagingPages: state.packagingPages.filter((page) => page.taskId !== result.task.id),
          packagingCandidates: state.packagingCandidates.filter((candidate) => candidate.taskId !== result.task.id),
          pageVersions: [
            ...state.pageVersions,
            ...createInitialPageVersions(result.task.id, normalizedPages.filter((page) => page.pageKind === "content")).map((version) => normalizePageVersion(version)),
          ],
          finalCompositions: state.finalCompositions.filter((item) => item.taskId !== result.task.id),
          finalCompositionPages: state.finalCompositionPages.filter((page) => page.taskId !== result.task.id),
          hardEditDrafts: state.hardEditDrafts.filter((draft) => draft.taskId !== result.task.id),
          activeTaskId: result.task.id,
          isGenerating: false,
        }));

        return result.task;
      },
      setActiveTask: (taskId) => {
        set({ activeTaskId: taskId });
      },
      setTaskStage: (taskId, stage) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  currentStage: stage,
                  packagingStageStatus:
                    stage === "packaging"
                      ? task.packagingStageStatus === "approved"
                        ? "approved"
                        : "ready"
                      : task.packagingStageStatus,
                }
              : task,
          ),
        }));
      },
      setTaskWorkType: (taskId, workType) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, workType } : task)),
        }));
      },
      setTaskPreferredExportFormat: (taskId, format) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, preferredExportFormat: format } : task)),
        }));
      },
      setTaskSelectedPage: (taskId, pageId) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, selectedPageId: pageId } : task)),
        }));
      },
      canEnterCandidatesStage: (taskId) => canEnterCandidatesStage(get().pages.filter((page) => page.taskId === taskId)),
      canEnterPackagingStage: (taskId) => {
        const state = get();
        return canEnterPackagingStage(
          state.pages.filter((page) => page.taskId === taskId),
          state.pageVersions.filter((version) => version.taskId === taskId),
        );
      },
      canEnterHardEditStage: (taskId) => {
        const state = get();
        return canEnterHardEditStage(
          state.pages.filter((page) => page.taskId === taskId),
          state.packagingPages.filter((page) => page.taskId === taskId),
          state.pageVersions.filter((version) => version.taskId === taskId),
          state.packagingCandidates.filter((candidate) => candidate.taskId === taskId),
        );
      },
      canEnterExportStage: (taskId) => {
        const state = get();
        return canEnterExportStage(
          state.finalCompositions.find((item) => item.taskId === taskId),
          state.finalCompositionPages.filter((page) => page.taskId === taskId),
          state.hardEditDrafts.filter((draft) => draft.taskId === taskId),
        );
      },
      getTaskFinalComposition: (taskId) => get().finalCompositions.find((item) => item.taskId === taskId),
      enterCandidatesStage: (taskId) => {
        set((state) => {
          const task = state.tasks.find((item) => item.id === taskId);
          if (!task) {
            return state;
          }

          const taskPages = state.pages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index);
          if (!canEnterCandidatesStage(taskPages)) {
            return state;
          }

          const existingVersions = state.pageVersions.filter((version) => version.taskId === taskId);
          const createdVersions = existingVersions.length
            ? []
            : createInitialPageVersions(taskId, taskPages).map((version) => normalizePageVersion(version));

          return {
            tasks: state.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    currentStage: "candidates",
                    selectedPageId: taskPages[0]?.id ?? item.selectedPageId,
                  }
                : item,
            ),
            pageVersions: [...state.pageVersions, ...createdVersions],
          };
        });
      },
      enterPackagingStage: (taskId) => {
        set((state) => {
          const task = state.tasks.find((item) => item.id === taskId);
          if (!task) {
            return state;
          }

          const contentPages = state.pages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index);
          const taskVersions = state.pageVersions.filter((version) => version.taskId === taskId);
          if (!canEnterPackagingStage(contentPages, taskVersions)) {
            return state;
          }

          const existingPackagingPages = state.packagingPages.filter((page) => page.taskId === taskId);
          const packagingPages = existingPackagingPages.length
            ? existingPackagingPages
            : createDeferredPackagingPages(taskId, contentPages.length + 1).map((page) => normalizePage(page));
          const approvedVersion = taskVersions.find((version) => version.isApproved);
          if (!approvedVersion) {
            return state;
          }
          const taskPackagingCandidates = state.packagingCandidates.filter((candidate) => candidate.taskId === taskId);
          const nextPackagingCandidates = taskPackagingCandidates.length
            ? taskPackagingCandidates
            : createInitialPackagingCandidates(packagingPages, contentPages, approvedVersion);

          const updatedVersions = appendPackagingPreviewsToVersions(taskVersions, packagingPages, contentPages);

          return {
            tasks: state.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    currentStage: "packaging",
                    packagingStageStatus: "ready",
                    hasGeneratedCoverPage: packagingPages.some((page) => page.pageRole === "cover"),
                    hasDerivedTocPage: packagingPages.some((page) => page.pageRole === "toc"),
                    selectedPageId: packagingPages[0]?.id ?? item.selectedPageId,
                  }
                : item,
            ),
            packagingPages: [
              ...state.packagingPages.filter((page) => page.taskId !== taskId),
              ...packagingPages,
            ],
            packagingCandidates: [
              ...state.packagingCandidates.filter((candidate) => candidate.taskId !== taskId),
              ...nextPackagingCandidates,
            ],
            pageVersions: [
              ...state.pageVersions.filter((version) => version.taskId !== taskId),
              ...updatedVersions,
            ],
          };
        });
      },
      regeneratePackagingPage: (taskId, pageId) => {
        set((state) => {
          const packagingPage = state.packagingPages.find((page) => page.id === pageId && page.taskId === taskId);
          if (!packagingPage) {
            return state;
          }

          const contentPages = state.pages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index);
          const approvedVersion = state.pageVersions.find((version) => version.taskId === taskId && version.isApproved);
          if (!approvedVersion) {
            return state;
          }
          const existingCandidates = state.packagingCandidates.filter((candidate) => candidate.taskId === taskId);
          const currentSelectedCandidate = existingCandidates.find((candidate) => candidate.pageId === pageId && candidate.isSelected);
          const updatedPage = normalizePage({
            ...packagingPage,
            renderSeed: packagingPage.renderSeed + 1,
            coverMeta:
              packagingPage.pageRole === "cover" && packagingPage.coverMeta
                ? {
                    ...packagingPage.coverMeta,
                    heroLabel:
                      packagingPage.renderSeed % 2 === 0
                        ? "本期主题：生成式产品从试验走向结构化落地"
                        : "本期主题：AI 工作流产品进入组织级部署阶段",
                    subtitle:
                      packagingPage.renderSeed % 2 === 0
                        ? "聚焦模型发布、应用落地与商业化信号"
                        : "追踪模型能力、产品交付与组织采用节奏",
                  }
                : packagingPage.coverMeta,
          });
          const nextCandidate = createPackagingCandidate(
            updatedPage,
            contentPages,
            approvedVersion,
            existingCandidates,
            updatedPage.renderSeed,
            updatedPage.pageRole === "cover" ? "再生成：调整封面信息层级与主视觉表达" : "再生成：基于内容结构调整目录组织方式",
            currentSelectedCandidate?.id ?? null,
          );
          const updatedCandidates = [
            ...existingCandidates.map((candidate) =>
              candidate.pageId === pageId ? { ...candidate, isSelected: false, isApproved: false } : candidate,
            ),
            nextCandidate,
          ];

          return {
            packagingPages: state.packagingPages.map((page) => (page.id === pageId ? updatedPage : page)),
            packagingCandidates: [
              ...state.packagingCandidates.filter((candidate) => candidate.taskId !== taskId),
              ...updatedCandidates,
            ],
          };
        });
      },
      selectPackagingCandidate: (taskId, pageId, candidateId) => {
        set((state) => ({
          packagingCandidates: state.packagingCandidates.map((candidate) =>
            candidate.taskId === taskId && candidate.pageId === pageId
              ? { ...candidate, isSelected: candidate.id === candidateId }
              : candidate,
          ),
        }));
      },
      approvePackagingCandidate: (taskId, pageId, candidateId) => {
        set((state) => ({
          packagingCandidates: state.packagingCandidates.map((candidate) =>
            candidate.taskId === taskId && candidate.pageId === pageId
              ? {
                  ...candidate,
                  isSelected: candidate.id === candidateId ? true : candidate.isSelected,
                  isApproved: candidate.id === candidateId,
                }
              : candidate,
          ),
        }));
      },
      enterHardEditStage: (taskId) => {
        set((state) => {
          const task = state.tasks.find((item) => item.id === taskId);
          if (!task) {
            return state;
          }

          const contentPages = state.pages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index);
          const packagingPages = state.packagingPages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index);
          const taskVersions = state.pageVersions.filter((version) => version.taskId === taskId);
          const taskPackagingCandidates = state.packagingCandidates.filter((candidate) => candidate.taskId === taskId);

          if (!canEnterHardEditStage(contentPages, packagingPages, taskVersions, taskPackagingCandidates)) {
            return state;
          }

          const approvedVersion = taskVersions.find((version) => version.isApproved);
          if (!approvedVersion) {
            return state;
          }

          const builtComposition = createFinalComposition(taskId, contentPages, packagingPages, approvedVersion, taskPackagingCandidates);
          const sourcePageMap = new Map([...contentPages, ...packagingPages].map((page) => [page.id, page]));
          const drafts = builtComposition.compositionPages.map((compositionPage) =>
            createHardEditDraft(compositionPage, sourcePageMap.get(compositionPage.sourcePageId), contentPages),
          );

          return {
            tasks: state.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    currentStage: "hard-edit",
                    packagingStageStatus: "approved",
                    selectedPageId: builtComposition.composition.orderedCompositionPageIds[0] ?? item.selectedPageId,
                    status: "ready_for_export",
                  }
                : item,
            ),
            finalCompositions: [
              ...state.finalCompositions.filter((item) => item.taskId !== taskId),
              builtComposition.composition,
            ],
            finalCompositionPages: [
              ...state.finalCompositionPages.filter((page) => page.taskId !== taskId),
              ...builtComposition.compositionPages,
            ],
            hardEditDrafts: [
              ...state.hardEditDrafts.filter((draft) => draft.taskId !== taskId),
              ...drafts,
            ],
          };
        });
      },
      enterExportStage: (taskId) => {
        set((state) => {
          const task = state.tasks.find((item) => item.id === taskId);
          if (!task) {
            return state;
          }

          const finalComposition = state.finalCompositions.find((item) => item.taskId === taskId);
          const finalCompositionPages = state.finalCompositionPages.filter((page) => page.taskId === taskId);
          const taskDrafts = state.hardEditDrafts.filter((draft) => draft.taskId === taskId);

          if (!canEnterExportStage(finalComposition, finalCompositionPages, taskDrafts)) {
            return state;
          }

          return {
            tasks: state.tasks.map((item) =>
              item.id === taskId
                ? {
                    ...item,
                    currentStage: "export",
                    status: "ready_for_export",
                    preferredExportFormat: "pdf",
                  }
                : item,
            ),
          };
        });
      },
      createAssetFromFinalComposition: async (taskId) => {
        const state = get();
        const task = state.tasks.find((item) => item.id === taskId);
        const finalComposition = state.finalCompositions.find((item) => item.taskId === taskId);
        const finalCompositionPages = state.finalCompositionPages.filter((page) => page.taskId === taskId);
        const taskDrafts = state.hardEditDrafts.filter((draft) => draft.taskId === taskId);

        if (!task || !canEnterExportStage(finalComposition, finalCompositionPages, taskDrafts) || !finalComposition) {
          return null;
        }

        const existingAsset = state.assets.find((asset) => asset.compositionId === finalComposition.id);
        const coverDraft = taskDrafts.find((draft) => {
          const page = finalCompositionPages.find((item) => item.id === draft.compositionPageId);
          return page?.pageRole === "cover";
        });
        const exportFormat = "pdf";
        const title = coverDraft?.title || task.title;
        const pageTypes = finalCompositionPages.map((page) => page.pageType);
        const assetId = existingAsset?.id ?? createAssetId();
        const baseAsset = normalizeAsset({
          id: assetId,
          taskId,
          compositionId: finalComposition.id,
          title,
          fileName: `${title.replace(/\s+/g, "_") || "PagesCut_Export"}.pdf`,
          workType: task.workType,
          exportFormat,
          pageCount: finalCompositionPages.length,
          description: `基于当前 Final Composition 生成的 PDF 文件，包含 ${pageTypes.slice(0, 4).join(" / ")}${pageTypes.length > 4 ? " 等页面" : ""}。`,
          sourceVersionId: finalComposition.approvedContentVersionId,
          createdAt: existingAsset?.createdAt ?? new Date().toISOString(),
          downloadUrl: "",
          fileMimeType: "",
          fileSizeBytes: 0,
          readyAt: null,
          errorMessage: "",
          status: "preparing",
        });

        set((current) => ({
          tasks: current.tasks.map((item) => (item.id === taskId ? { ...item, preferredExportFormat: "pdf" } : item)),
          assets: current.assets.some((item) => item.id === assetId)
            ? current.assets.map((item) => (item.id === assetId ? baseAsset : item))
            : [baseAsset, ...current.assets],
        }));

        await Promise.resolve();

        set((current) => ({
          assets: current.assets.map((item) =>
            item.id === assetId
              ? {
                  ...item,
                  status: "processing",
                  errorMessage: "",
                }
              : item,
          ),
        }));

        try {
          const pdfFile = await generatePdfFromFinalComposition({
            task: { ...task, preferredExportFormat: "pdf" },
            composition: finalComposition,
            compositionPages: finalCompositionPages,
            drafts: taskDrafts,
          });

          const completedAsset = normalizeAsset({
            ...baseAsset,
            downloadUrl: pdfFile.dataUrl,
            fileMimeType: pdfFile.mimeType,
            fileSizeBytes: pdfFile.byteSize,
            readyAt: new Date().toISOString(),
            status: "completed",
          });

          set((current) => ({
            assets: current.assets.map((item) => (item.id === assetId ? completedAsset : item)),
          }));

          return completedAsset;
        } catch (error) {
          const failedAsset = normalizeAsset({
            ...baseAsset,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "PDF 导出失败。",
          });

          set((current) => ({
            assets: current.assets.map((item) => (item.id === assetId ? failedAsset : item)),
          }));

          return null;
        }
      },
      updateHardEditDraft: (draftId, patch) => {
        set((state) => ({
          hardEditDrafts: state.hardEditDrafts.map((draft) =>
            draft.id === draftId
              ? {
                  ...draft,
                  ...patch,
                  isDirty: true,
                }
              : draft,
          ),
        }));
      },
      saveHardEditDraft: (draftId) => {
        set((state) => ({
          hardEditDrafts: state.hardEditDrafts.map((draft) =>
            draft.id === draftId
              ? {
                  ...draft,
                  isDirty: false,
                  lastSavedAt: new Date().toISOString(),
                }
              : draft,
          ),
        }));
      },
      updatePage: (pageId, patch) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  ...patch,
                  isSaved: false,
                }
              : page,
          ),
        }));
      },
      savePage: (pageId) => {
        set((state) => ({
          pages: state.pages.map((page) => (page.id === pageId ? { ...page, isSaved: true } : page)),
        }));
      },
      addUserProvidedBlock: (pageId, blockType) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  isSaved: false,
                  userProvidedContentBlocks: [...page.userProvidedContentBlocks, createDefaultBlock(blockType)],
                }
              : page,
          ),
        }));
      },
      updateUserProvidedBlock: (pageId, blockId, patch) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  isSaved: false,
                  userProvidedContentBlocks: page.userProvidedContentBlocks.map((block) => {
                    if (block.id !== blockId) {
                      return block;
                    }

                    switch (block.type) {
                      case "text": {
                        const nextPatch = patch as Partial<Extract<UserProvidedContentBlock, { type: "text" }>>;
                        return {
                          ...block,
                          text: typeof nextPatch.text === "string" ? nextPatch.text : block.text,
                        };
                      }
                      case "image": {
                        const nextPatch = patch as Partial<Extract<UserProvidedContentBlock, { type: "image" }>>;
                        return {
                          ...block,
                          imageUrl: typeof nextPatch.imageUrl === "string" ? nextPatch.imageUrl : block.imageUrl,
                          altText: typeof nextPatch.altText === "string" ? nextPatch.altText : block.altText,
                          caption: typeof nextPatch.caption === "string" ? nextPatch.caption : block.caption,
                        };
                      }
                      case "chart_desc": {
                        const nextPatch = patch as Partial<Extract<UserProvidedContentBlock, { type: "chart_desc" }>>;
                        return {
                          ...block,
                          description: typeof nextPatch.description === "string" ? nextPatch.description : block.description,
                          chartTypeHint: typeof nextPatch.chartTypeHint === "string" ? nextPatch.chartTypeHint : block.chartTypeHint,
                        };
                      }
                      case "table": {
                        const nextPatch = patch as Partial<Extract<UserProvidedContentBlock, { type: "table" }>>;
                        const rawInput = typeof nextPatch.rawInput === "string" ? nextPatch.rawInput : block.rawInput;
                        const parsed = parseTableRawInput(rawInput);
                        return {
                          ...block,
                          rawInput,
                          columns: parsed.columns,
                          rows: parsed.dataRows,
                        };
                      }
                      default:
                        return block;
                    }
                  }),
                }
              : page,
          ),
        }));
      },
      removeUserProvidedBlock: (pageId, blockId) => {
        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === pageId
              ? {
                  ...page,
                  isSaved: false,
                  userProvidedContentBlocks: page.userProvidedContentBlocks.filter((block) => block.id !== blockId),
                }
              : page,
          ),
        }));
      },
      selectTaskVersion: (taskId, versionId) => {
        set((state) => ({
          pageVersions: state.pageVersions.map((version) =>
            version.taskId === taskId ? { ...version, isSelected: version.id === versionId } : version,
          ),
        }));
      },
      approveTaskVersion: (taskId, versionId) => {
        set((state) => {
          const contentPages = state.pages.filter((page) => page.taskId === taskId);
          const target = state.pageVersions.find((version) => version.id === versionId && version.taskId === taskId);
          if (!target || !isValidTaskVersion(target, contentPages)) {
            return state;
          }

          return {
            pageVersions: state.pageVersions.map((version) =>
              version.taskId === taskId
                ? {
                    ...version,
                    isSelected: version.id === versionId ? true : version.isSelected,
                    isApproved: version.id === versionId,
                  }
                : version,
            ),
          };
        });
      },
      regenerateTaskVersion: (taskId, pageId, promptNote) => {
        set((state) => {
          if (!promptNote.trim()) {
            return state;
          }

          const focusPage = state.pages.find((item) => item.id === pageId && item.taskId === taskId);
          if (!focusPage) {
            return state;
          }

          const taskPages = state.pages.filter((page) => page.taskId === taskId).sort((a, b) => a.index - b.index);
          const taskVersions = state.pageVersions.filter((version) => version.taskId === taskId);
          const selectedVersion = taskVersions.find((version) => version.isSelected);
          const nextVersion = createMockGeneratedVersion(taskId, taskPages, focusPage, taskVersions, selectedVersion, promptNote);
          if (!isValidTaskVersion(nextVersion, taskPages)) {
            return state;
          }

          return {
            pageVersions: [
              ...state.pageVersions.map((version) =>
                version.taskId === taskId ? { ...version, isSelected: false } : version,
              ),
              nextVersion,
            ],
          };
        });
      },
    }),
    {
      name: "pagescut-v1",
      version: 8,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> | undefined;
        if (!state) {
          return persistedState as AppState;
        }

        const normalizedAllPages = Array.isArray(state.pages) ? state.pages.map((page) => normalizePage(page)) : [];
        const explicitPackagingPages = Array.isArray(state.packagingPages) ? state.packagingPages.map((page) => normalizePage(page)) : [];
        const incomingPackagingCandidates = Array.isArray(state.packagingCandidates)
          ? state.packagingCandidates.map((candidate) => normalizePackagingPageCandidate(candidate))
          : [];
        const splitContentPages = normalizedAllPages.filter((page) => page.pageKind === "content");
        const legacyPackagingPages = normalizedAllPages.filter((page) => page.pageKind !== "content");
        const packagingPages = [...explicitPackagingPages, ...legacyPackagingPages].filter(
          (page, index, items) => items.findIndex((item) => item.id === page.id) === index,
        );

        const tasks = Array.isArray(state.tasks)
          ? state.tasks.map((task) => ({
              ...task,
              hasGeneratedCoverPage: Boolean(task.hasGeneratedCoverPage),
              hasDerivedTocPage: Boolean(task.hasDerivedTocPage),
              packagingStageStatus: task.packagingStageStatus ?? "pending",
              preferredExportFormat: task.preferredExportFormat ?? (task.workType === "magazine" ? "pdf" : "pptx"),
            }))
          : [];

        const incomingVersions = Array.isArray(state.pageVersions) ? state.pageVersions : [];
        const hasTaskScopedVersions = incomingVersions.every(
          (version) => typeof version?.taskId === "string" && version?.previewsByPageId && typeof version.previewsByPageId === "object",
        );

        const rebuiltVersions = hasTaskScopedVersions
          ? incomingVersions.map((version) => normalizePageVersion(version))
          : tasks.flatMap((task) =>
              createInitialPageVersions(
                task.id,
                splitContentPages.filter((page) => page.taskId === task.id).sort((a, b) => a.index - b.index),
              ).map((version) => normalizePageVersion(version)),
            );

        const packagingCandidates = incomingPackagingCandidates.length
          ? incomingPackagingCandidates
          : rebuildLegacyPackagingCandidates(tasks, packagingPages, splitContentPages, rebuiltVersions);

        const incomingFinalCompositions = Array.isArray(state.finalCompositions)
          ? state.finalCompositions.map((composition) => normalizeFinalComposition(composition))
          : [];
        const incomingFinalCompositionPages = Array.isArray(state.finalCompositionPages)
          ? state.finalCompositionPages.map((page) => normalizeFinalCompositionPage(page))
          : [];
        const incomingHardEditDrafts = Array.isArray(state.hardEditDrafts) ? state.hardEditDrafts : [];

        const rebuiltLegacyState =
          incomingFinalCompositions.length || incomingFinalCompositionPages.length
            ? null
            : rebuildLegacyCompositionState(tasks, splitContentPages, packagingPages, rebuiltVersions, packagingCandidates, incomingHardEditDrafts);

        return {
          ...state,
          pages: splitContentPages,
          packagingPages,
          packagingCandidates,
          pageVersions: rebuiltVersions,
          finalCompositions: incomingFinalCompositions.length
            ? incomingFinalCompositions
            : rebuiltLegacyState?.compositions ?? [],
          finalCompositionPages: incomingFinalCompositionPages.length
            ? incomingFinalCompositionPages
            : rebuiltLegacyState?.compositionPages ?? [],
          hardEditDrafts: incomingFinalCompositions.length
            ? incomingHardEditDrafts.map((draft) => normalizeHardEditDraft(draft as HardEditPageDraft))
            : rebuiltLegacyState?.migratedDrafts ?? [],
          assets: Array.isArray(state.assets) ? state.assets.map((asset) => normalizeAsset(asset)) : [],
        } as AppState;
      },
      partialize: (state) => ({
        projects: state.projects,
        tasks: state.tasks,
        pages: state.pages,
        packagingPages: state.packagingPages,
        packagingCandidates: state.packagingCandidates,
        pageVersions: state.pageVersions,
        finalCompositions: state.finalCompositions,
        finalCompositionPages: state.finalCompositionPages,
        hardEditDrafts: state.hardEditDrafts,
        assets: state.assets,
        activeTaskId: state.activeTaskId,
        isBootstrapped: state.isBootstrapped,
      }),
    },
  ),
);
