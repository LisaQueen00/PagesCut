import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isValidTaskVersion } from "@/lib/versionValidation";
import {
  buildMockPreviewHtml,
  buildPackagingPreviewHtml,
  createDeferredPackagingPages,
  createInitialPageVersions,
  createSeedTask,
  getMockVersionStrategySummary,
} from "@/mocks/data";
import { services } from "@/services";
import type {
  Asset,
  HardEditPageDraft,
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
  pageVersions: PageVersion[];
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
  setTaskSelectedPage: (taskId: string, pageId: string) => void;
  enterCandidatesStage: (taskId: string) => void;
  enterPackagingStage: (taskId: string) => void;
  regeneratePackagingPage: (taskId: string, pageId: string) => void;
  enterHardEditStage: (taskId: string) => void;
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

function createDraftId() {
  return `draft-${Math.random().toString(36).slice(2, 8)}`;
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
  const inferredRole = page.pageRole ?? (page.pageType === "封面页" ? "cover" : page.pageType === "趋势综述" ? "overview" : page.pageType === "案例页" ? "case-study" : page.pageType === "结语页" ? "summary" : "feature");
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

function createMockGeneratedVersion(taskId: string, pages: Page[], focusPage: Page, existingVersions: PageVersion[], selectedVersion: PageVersion | undefined, promptNote: string): PageVersion {
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

  return {
    id: createVersionId(),
    taskId,
    versionLabel,
    promptNote: promptText,
    variantSummary,
    derivedFromVersionId: selectedVersion?.id ?? null,
    previewsByPageId,
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

function createHardEditDraft(page: Page, sourceVersion: PageVersion, allPages: Page[]): HardEditPageDraft {
  const sourcePreviewHtml = sourceVersion.previewsByPageId[page.id] ?? "";
  const now = new Date().toISOString();

  if (page.pageRole === "cover") {
    return {
      id: createDraftId(),
      taskId: page.taskId,
      pageId: page.id,
      sourceVersionId: sourceVersion.id,
      sourcePreviewHtml,
      title: page.coverMeta?.title ?? page.pageType,
      subtitle: page.coverMeta?.subtitle ?? "",
      bodyText: page.coverMeta?.heroLabel ?? "",
      imageCaption: "主视觉区域说明",
      chartCaption: "",
      footerNote: `${page.coverMeta?.issueLabel ?? ""} · ${page.coverMeta?.brandLabel ?? ""}`.trim(),
      isDirty: false,
      lastSavedAt: now,
    };
  }

  if (page.pageRole === "toc") {
    const contentEntries = allPages
      .filter((item) => item.taskId === page.taskId && item.pageKind === "content")
      .sort((a, b) => a.index - b.index)
      .map((item, index) => `${index + 1}. ${item.pageType}`)
      .join("\n");

    return {
      id: createDraftId(),
      taskId: page.taskId,
      pageId: page.id,
      sourceVersionId: sourceVersion.id,
      sourcePreviewHtml,
      title: page.pageType,
      subtitle: "目录组织与阅读导航",
      bodyText: contentEntries,
      imageCaption: "",
      chartCaption: "",
      footerNote: "目录页可在硬编辑阶段继续微调标题和顺序表达。",
      isDirty: false,
      lastSavedAt: now,
    };
  }

  const imageBlock = page.userProvidedContentBlocks.find((block) => block.type === "image");
  const chartBlock = page.userProvidedContentBlocks.find((block) => block.type === "chart_desc");

  return {
    id: createDraftId(),
    taskId: page.taskId,
    pageId: page.id,
    sourceVersionId: sourceVersion.id,
    sourcePreviewHtml,
    title: page.pageType,
    subtitle: page.styleText,
    bodyText: page.outlineText,
    imageCaption: imageBlock?.type === "image" ? imageBlock.caption : "",
    chartCaption: chartBlock?.type === "chart_desc" ? chartBlock.description : "",
    footerNote: page.userConstraints,
    isDirty: false,
    lastSavedAt: now,
  };
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      tasks: [],
      pages: [],
      pageVersions: [],
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
          pages: seed.pages.map((page) => normalizePage(page)),
          pageVersions: seed.pageVersions.map((version) => normalizePageVersion(version)),
          hardEditDrafts: [],
          assets: seed.assets,
          activeTaskId: seed.task.id,
          isBootstrapped: true,
        });
      },
      createTask: async (prompt, workType) => {
        set({ isGenerating: true });
        const result = await services.createTaskFromPrompt(prompt, workType);

        set((state) => ({
          projects: replaceById(state.projects, {
            id: "project-default",
            name: "default project",
            taskIds: Array.from(new Set([...state.tasks.map((task) => task.id), result.task.id])),
            isDefault: true,
          }),
          tasks: [...state.tasks, result.task],
          pages: [...state.pages.filter((page) => page.taskId !== result.task.id), ...result.pages],
          pageVersions: [
            ...state.pageVersions,
            ...createInitialPageVersions(result.task.id, result.pages).map((version) => normalizePageVersion(version)),
          ],
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
      setTaskSelectedPage: (taskId, pageId) => {
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, selectedPageId: pageId } : task)),
        }));
      },
      enterCandidatesStage: (taskId) => {
        set((state) => {
          const task = state.tasks.find((item) => item.id === taskId);
          if (!task) {
            return state;
          }

          const taskPages = state.pages.filter((page) => page.taskId === taskId);
          const existingVersions = state.pageVersions.filter((version) => version.taskId === taskId);
          const createdVersions = existingVersions.length ? [] : createInitialPageVersions(taskId, taskPages).map((version) => normalizePageVersion(version));

          return {
            tasks: state.tasks.map((item) => (item.id === taskId ? { ...item, currentStage: "candidates" } : item)),
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

          const taskPages = state.pages.filter((page) => page.taskId === taskId);
          const contentPages = taskPages.filter((page) => page.pageKind === "content").sort((a, b) => a.index - b.index);
          const hasApprovedValidVersion = state.pageVersions.some(
            (version) => version.taskId === taskId && version.isApproved && isValidTaskVersion(version, contentPages),
          );
          if (!hasApprovedValidVersion) {
            return state;
          }
          const existingPackagingPages = taskPages.filter((page) => page.pageKind !== "content");
          const packagingPages = existingPackagingPages.length
            ? existingPackagingPages
            : createDeferredPackagingPages(taskId, contentPages.length + 1).map((page) => normalizePage(page));

          const updatedVersions = appendPackagingPreviewsToVersions(
            state.pageVersions.filter((version) => version.taskId === taskId),
            packagingPages,
            contentPages,
          );

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
                    pageIds: [...item.pageIds, ...packagingPages.filter((page) => !item.pageIds.includes(page.id)).map((page) => page.id)],
                  }
                : item,
            ),
            pages: [...state.pages, ...packagingPages.filter((page) => !state.pages.some((item) => item.id === page.id))],
            pageVersions: [
              ...state.pageVersions.filter((version) => version.taskId !== taskId),
              ...updatedVersions,
            ],
          };
        });
      },
      regeneratePackagingPage: (taskId, pageId) => {
        set((state) => {
          const packagingPage = state.pages.find((page) => page.id === pageId && page.taskId === taskId && page.pageKind !== "content");
          if (!packagingPage) {
            return state;
          }

          const contentPages = state.pages.filter((page) => page.taskId === taskId && page.pageKind === "content").sort((a, b) => a.index - b.index);
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
          const updatedVersions = state.pageVersions
            .filter((version) => version.taskId === taskId)
            .map((version) => {
              const family = getVersionFamilyFromLabel(version.versionLabel);
              return normalizePageVersion({
                ...version,
                previewsByPageId: {
                  ...version.previewsByPageId,
                  [pageId]: buildPackagingPreviewHtml(updatedPage, contentPages, version.versionLabel, updatedPage.renderSeed, family),
                },
              });
            });

          return {
            pages: state.pages.map((page) => (page.id === pageId ? updatedPage : page)),
            pageVersions: [
              ...state.pageVersions.filter((version) => version.taskId !== taskId),
              ...updatedVersions,
            ],
          };
        });
      },
      enterHardEditStage: (taskId) => {
        set((state) => {
          const taskPages = state.pages.filter((page) => page.taskId === taskId);
          const approvedVersion = state.pageVersions.find((version) => version.taskId === taskId && version.isApproved);
          const contentPages = taskPages.filter((page) => page.pageKind === "content");
          if (!approvedVersion || !isValidTaskVersion(approvedVersion, contentPages)) {
            return state;
          }

          const drafts = taskPages.map((page) => createHardEditDraft(page, approvedVersion, taskPages));

          return {
            tasks: state.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    currentStage: "hard-edit",
                    packagingStageStatus: "approved",
                  }
                : task,
            ),
            hardEditDrafts: [
              ...state.hardEditDrafts.filter((draft) => draft.taskId !== taskId),
              ...drafts,
            ],
          };
        });
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
          const contentPages = state.pages.filter((page) => page.taskId === taskId && page.pageKind === "content");
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
          const contentPages = taskPages.filter((page) => page.pageKind === "content");
          if (!isValidTaskVersion(nextVersion, contentPages)) {
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
      version: 6,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AppState> | undefined;
        if (!state) {
          return persistedState as AppState;
        }

        const normalizedPages = Array.isArray(state.pages) ? state.pages.map((page) => normalizePage(page)) : [];
        const tasks = Array.isArray(state.tasks)
          ? state.tasks.map((task) => ({
              ...task,
              hasGeneratedCoverPage: Boolean(task.hasGeneratedCoverPage),
              hasDerivedTocPage: Boolean(task.hasDerivedTocPage),
              packagingStageStatus: task.packagingStageStatus ?? "pending",
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
                normalizedPages.filter((page) => page.taskId === task.id).sort((a, b) => a.index - b.index),
              ).map((version) => normalizePageVersion(version)),
            );

        return {
          ...state,
          pages: normalizedPages,
          pageVersions: rebuiltVersions,
          hardEditDrafts: Array.isArray(state.hardEditDrafts)
            ? state.hardEditDrafts.map((draft) => ({
                ...draft,
                lastSavedAt: typeof draft.lastSavedAt === "string" ? draft.lastSavedAt : new Date().toISOString(),
              }))
            : [],
        } as AppState;
      },
      partialize: (state) => ({
        projects: state.projects,
        tasks: state.tasks,
        pages: state.pages,
        pageVersions: state.pageVersions,
        hardEditDrafts: state.hardEditDrafts,
        assets: state.assets,
        activeTaskId: state.activeTaskId,
        isBootstrapped: state.isBootstrapped,
      }),
    },
  ),
);
