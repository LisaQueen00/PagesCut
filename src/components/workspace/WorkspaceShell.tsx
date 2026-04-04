import { useMemo, useState } from "react";
import { CandidatePreview } from "@/components/workspace/CandidatePreview";
import { OutlinePageCard } from "@/components/workspace/OutlinePageCard";
import { StageOneDrawer } from "@/components/workspace/StageOneDrawer";
import { StageTwoDrawer } from "@/components/workspace/StageTwoDrawer";
import { WorkspaceStageRail } from "@/components/workspace/WorkspaceStageRail";
import { formatTime } from "@/lib/format";
import { getPageDisplayLabel, sortPagesForFinalOrder } from "@/lib/pageDisplay";
import { useAppStore } from "@/store/appStore";
import type { HardEditPageDraft, Page, PageVersion, Task } from "@/types/domain";

const stylePool = [
  "现代杂志感，简洁留白",
  "轻专业汇报风，克制排版",
  "图文节奏鲜明，信息清楚",
  "冷静科技感，强调标题层级",
  "高端刊物风，边界轻、留白大",
];

function getGroupedPages(pages: Page[]) {
  const orderedPages = sortPagesForFinalOrder(pages);
  const front = orderedPages.filter((page) => getPageDisplayLabel(page, pages).startsWith("B"));
  const content = orderedPages.filter((page) => getPageDisplayLabel(page, pages).startsWith("P"));
  const rear = orderedPages.filter((page) => getPageDisplayLabel(page, pages).startsWith("T"));

  return [
    {
      key: "front",
      title: "前置包装页",
      subtitle: "封面页 / 目录页",
      pages: front,
      emptyLabel: "当前阶段尚未补入前置包装页。",
    },
    {
      key: "content",
      title: "内容页",
      subtitle: "综述 / 案例 / 数据 / 总结",
      pages: content,
      emptyLabel: "当前还没有内容页。",
    },
    {
      key: "rear",
      title: "后置包装页",
      subtitle: "封尾 / 封底 / 附录",
      pages: rear,
      emptyLabel: "当前先预留后置包装页分组。",
    },
  ];
}

function StageSidebar({
  pages,
  selectedPageId,
  onSelect,
  helperText,
}: {
  pages: Page[];
  selectedPageId: string;
  onSelect: (pageId: string) => void;
  helperText: string;
}) {
  const groups = getGroupedPages(pages);

  return (
    <section className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Pages</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">页级结构</h2>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs text-muted">{pages.length} 页</span>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">{helperText}</p>

      <div className="mt-4 space-y-4">
        {groups.map((group) => (
          <div key={group.key} className="rounded-[20px] border border-line/60 bg-white/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{group.title}</p>
                <p className="mt-1 text-xs text-muted">{group.subtitle}</p>
              </div>
              <span className="rounded-full bg-[#f3f5f8] px-2.5 py-1 text-[11px] text-muted">{group.pages.length}</span>
            </div>

            {group.pages.length ? (
              <div className="mt-3 space-y-3">
                {group.pages.map((page) => (
                  <OutlinePageCard
                    key={page.id}
                    page={page}
                    pageLabel={getPageDisplayLabel(page, pages)}
                    isActive={page.id === selectedPageId}
                    onClick={() => onSelect(page.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-[16px] border border-dashed border-line/70 bg-[#fbfcfd] px-3 py-4 text-sm leading-6 text-muted">
                {group.emptyLabel}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StageOneWorkspace({
  task,
  selectedPage,
  pages,
  drawerOpen,
  setDrawerOpen,
}: {
  task: Task;
  selectedPage: Page;
  pages: Page[];
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const setTaskSelectedPage = useAppStore((state) => state.setTaskSelectedPage);
  const updatePage = useAppStore((state) => state.updatePage);
  const savePage = useAppStore((state) => state.savePage);
  const setTaskWorkType = useAppStore((state) => state.setTaskWorkType);
  const addUserProvidedBlock = useAppStore((state) => state.addUserProvidedBlock);
  const updateUserProvidedBlock = useAppStore((state) => state.updateUserProvidedBlock);
  const removeUserProvidedBlock = useAppStore((state) => state.removeUserProvidedBlock);
  const enterCandidatesStage = useAppStore((state) => state.enterCandidatesStage);

  function handleSave() {
    savePage(selectedPage.id);
  }

  function rollStyle() {
    const nextStyle = stylePool[Math.floor(Math.random() * stylePool.length)];
    updatePage(selectedPage.id, { styleText: nextStyle });
  }

  const pageLabel = getPageDisplayLabel(selectedPage, pages);
  const savedLabel = selectedPage.isSaved ? `${pageLabel} 已保存` : "当前修改尚未保存";
  const mainEditorTitle = selectedPage.pageKind === "packaging" ? "当前页包装信息 / 引导文案" : "当前页大纲正文预览 / 编辑区";
  const currentFocusText = selectedPage.pageKind === "packaging" ? "当前聚焦封面包装信息、入口文案与作品识别表达。" : "当前聚焦页级大纲阅读、修改与保存。";

  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <StageSidebar
        pages={pages}
        selectedPageId={selectedPage.id}
        onSelect={(pageId) => setTaskSelectedPage(task.id, pageId)}
        helperText="点击左侧页卡即可切换当前编辑页，页级正文和右侧设置会实时联动。"
      />

      <section className="soft-grid relative overflow-hidden rounded-[28px] border border-line/70 bg-white p-6 shadow-panel">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f8fafc] to-transparent" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 1</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">一阶段待确认视图</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">{task.prompt}</p>
            </div>
            <div className="rounded-[20px] border border-line/70 bg-[#f8fafc] px-4 py-3 text-sm text-muted">
              创建于 {formatTime(task.createdAt)}
            </div>
          </div>

          <div className="mt-7 rounded-[28px] border border-line/70 bg-white/95 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Outline Editing</p>
                <h3 className="mt-2 text-[28px] font-semibold tracking-tight text-ink">
                  {pageLabel} · {selectedPage.pageType}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-ink px-4 py-2 text-sm text-white">
                  {task.workType === "magazine" ? "刊物" : "报告 / PPT"}
                </span>
                <span className={`rounded-full px-4 py-2 text-sm ${selectedPage.isSaved ? "bg-[#eef2f7] text-ink" : "bg-[#f7f8fa] text-muted"}`}>
                  {selectedPage.isSaved ? "已保存" : "未保存"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-[24px] border border-line/70 bg-[#fcfdff] p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">Outline Body</p>
                    <h4 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{mainEditorTitle}</h4>
                  </div>
                  <span className="rounded-full border border-line/60 bg-white px-3 py-1 text-xs text-muted">
                    {selectedPage.pageKind === "packaging" ? "包装页" : selectedPage.sourceMode === "user" ? "用户提供" : "系统生成"}
                  </span>
                </div>

                <textarea
                  value={selectedPage.outlineText}
                  onChange={(event) => updatePage(selectedPage.id, { outlineText: event.target.value })}
                  className="mt-5 min-h-[460px] w-full resize-none rounded-[24px] border border-line/70 bg-white px-6 py-6 text-[18px] leading-9 text-ink outline-none transition focus:border-ink/20"
                />
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">{savedLabel}</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="rounded-full border border-line bg-white px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/20"
                    >
                      保存当前大纲
                    </button>
                    <button
                      type="button"
                      onClick={() => enterCandidatesStage(task.id)}
                      className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#202632]"
                    >
                      进入候选页面阶段
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-line/50 bg-[#f8fafc] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Current Focus</p>
                  <h4 className="mt-2 text-sm font-semibold text-ink">一阶段待确认视图</h4>
                  <p className="mt-2 text-sm leading-6 text-muted">{currentFocusText}</p>
                </div>
                <div className="rounded-[22px] border border-line/50 bg-[#f8fafc] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Next Step</p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    <p>页类型：{selectedPage.pageType}</p>
                    <p>页面类别：{selectedPage.pageKind === "packaging" ? "包装 / 结构页" : "内容页"}</p>
                    <p>表达形式：{selectedPage.expressionMode}</p>
                    <p>风格描述：{selectedPage.styleText}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <StageOneDrawer
        open={drawerOpen}
        workType={task.workType}
        page={selectedPage}
        pageLabel={pageLabel}
        savedLabel={savedLabel}
        onToggle={() => setDrawerOpen((current) => !current)}
        onWorkTypeChange={(value) => setTaskWorkType(task.id, value)}
        onPageChange={(patch) => updatePage(selectedPage.id, patch)}
        onRollStyle={rollStyle}
        onAddBlock={(type) => addUserProvidedBlock(selectedPage.id, type)}
        onUpdateBlock={(blockId, patch) => updateUserProvidedBlock(selectedPage.id, blockId, patch)}
        onRemoveBlock={(blockId) => removeUserProvidedBlock(selectedPage.id, blockId)}
        onSave={handleSave}
      />
    </div>
  );
}

function StageTwoWorkspace({
  task,
  selectedPage,
  pages,
  pageVersions,
  drawerOpen,
  setDrawerOpen,
}: {
  task: Task;
  selectedPage: Page;
  pages: Page[];
  pageVersions: PageVersion[];
  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const setTaskSelectedPage = useAppStore((state) => state.setTaskSelectedPage);
  const selectTaskVersion = useAppStore((state) => state.selectTaskVersion);
  const approveTaskVersion = useAppStore((state) => state.approveTaskVersion);
  const regenerateTaskVersion = useAppStore((state) => state.regenerateTaskVersion);
  const enterPackagingStage = useAppStore((state) => state.enterPackagingStage);

  const currentPageVersions = useMemo(
    () => pageVersions.slice().sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)),
    [pageVersions],
  );

  const selectedVersion = useMemo(
    () => currentPageVersions.find((version) => version.isSelected) ?? currentPageVersions[currentPageVersions.length - 1],
    [currentPageVersions],
  );
  const selectedPreviewHtml = selectedVersion?.previewsByPageId[selectedPage.id] ?? "";
  const pageLabel = getPageDisplayLabel(selectedPage, pages);
  const contentPages = pages.filter((page) => page.pageKind === "content");

  if (!selectedVersion) {
    return null;
  }

  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <StageSidebar
        pages={pages}
        selectedPageId={selectedPage.id}
        onSelect={(pageId) => setTaskSelectedPage(task.id, pageId)}
        helperText="左侧继续切换页卡；当前整期方案保持不变，不同页面只展示该方案下的页级适配预览。"
      />

      <CandidatePreview version={selectedVersion} previewHtml={selectedPreviewHtml} />

      <StageTwoDrawer
        open={drawerOpen}
        task={task}
        page={selectedPage}
        pageLabel={pageLabel}
        contentPages={contentPages}
        versions={currentPageVersions}
        selectedVersionId={selectedVersion.id}
        onToggle={() => setDrawerOpen((current) => !current)}
        onSelectVersion={(versionId) => selectTaskVersion(task.id, versionId)}
        onApproveVersion={(versionId) => approveTaskVersion(task.id, versionId)}
        onRegenerate={(promptNote) => regenerateTaskVersion(task.id, selectedPage.id, promptNote)}
        onEnterPackaging={() => enterPackagingStage(task.id)}
      />
    </div>
  );
}

function PackagingWorkspace({
  task,
  selectedPage,
  pages,
  pageVersions,
}: {
  task: Task;
  selectedPage: Page;
  pages: Page[];
  pageVersions: PageVersion[];
}) {
  const setTaskSelectedPage = useAppStore((state) => state.setTaskSelectedPage);
  const regeneratePackagingPage = useAppStore((state) => state.regeneratePackagingPage);
  const enterHardEditStage = useAppStore((state) => state.enterHardEditStage);
  const packagingPages = useMemo(
    () => pages.filter((page) => page.pageKind !== "content").sort((a, b) => a.index - b.index),
    [pages],
  );
  const selectedVersion = useMemo(
    () => pageVersions.find((version) => version.isSelected) ?? pageVersions[pageVersions.length - 1],
    [pageVersions],
  );
  const selectedPreviewHtml = selectedVersion?.previewsByPageId[selectedPage.id] ?? "";
  const pageLabel = getPageDisplayLabel(selectedPage, pages);

  if (!selectedVersion || !packagingPages.length) {
    return null;
  }

  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <StageSidebar
        pages={packagingPages}
        selectedPageId={selectedPage.id}
        onSelect={(pageId) => setTaskSelectedPage(task.id, pageId)}
        helperText="当前阶段只处理包装页与结构页。封面页和目录页都基于已确认的内容方案与内容结构生成。"
      />

      <CandidatePreview version={selectedVersion} previewHtml={selectedPreviewHtml} />

      <aside className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 2.5</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">包装页生成与筛选</h2>
        <div className="mt-5 space-y-4">
          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Current Packaging Page</p>
            <h3 className="mt-2 text-base font-semibold text-ink">
              {pageLabel} · {selectedPage.pageType}
            </h3>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>当前方案：{selectedVersion.versionLabel}</p>
              <p>包装页类型：{selectedPage.pageRole === "cover" ? "封面页" : "目录页"}</p>
              <p>{selectedPage.pageRole === "cover" ? "基于标题、副标题、期次、品牌和主视觉信息生成。" : "基于当前内容页顺序、标题和结构生成目录。"} </p>
            </div>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Light Regenerate</p>
            <h3 className="mt-2 text-base font-semibold text-ink">轻量再生成</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {selectedPage.pageRole === "cover"
                ? "重新生成封面页会调整标题呈现、主视觉说明与信息层级。"
                : "重新生成目录页会调整目录组织方式和目录展示样式。"}
            </p>
            <button
              type="button"
              onClick={() => regeneratePackagingPage(task.id, selectedPage.id)}
              className="mt-4 w-full rounded-full border border-line bg-white px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/20"
            >
              重新生成当前包装页
            </button>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Next Step</p>
            <h3 className="mt-2 text-base font-semibold text-ink">进入页面硬编辑</h3>
            <p className="mt-2 text-sm leading-6 text-muted">下一步将把封面页、目录页以及所有内容页一并纳入最终硬编辑集合。</p>
            <button
              type="button"
              onClick={() => enterHardEditStage(task.id)}
              className="mt-4 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#202632]"
            >
              所有页面一起进入硬编辑
            </button>
          </section>
        </div>
      </aside>
    </div>
  );
}

function HardEditPagePreview({
  page,
  pageLabel,
  draft,
}: {
  page: Page;
  pageLabel: string;
  draft: HardEditPageDraft;
}) {
  return (
    <section className="soft-grid relative overflow-hidden rounded-[28px] border border-line/70 bg-white p-6 shadow-panel">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f8fafc] to-transparent" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Hard Edit</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">{pageLabel} · {page.pageType}</h2>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm ${draft.isDirty ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
            {draft.isDirty ? "未保存修改" : "已保存"}
          </span>
        </div>

        <div className="mt-7 rounded-[28px] border border-line/70 bg-[#fcfdff] p-6 shadow-sm">
          {page.pageRole === "cover" ? (
            <article className="rounded-[26px] border border-line/70 bg-white p-8">
              <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[24px] bg-ink p-7 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/70">Cover</p>
                  <h3 className="mt-4 text-4xl font-semibold leading-tight">{draft.title}</h3>
                  <p className="mt-5 text-base leading-8 text-white/85">{draft.subtitle}</p>
                </div>
                <div className="rounded-[24px] border border-line/70 bg-[#f7f9fc] p-7">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">主视觉说明</p>
                  <p className="mt-4 text-lg leading-8 text-ink">{draft.bodyText}</p>
                  <p className="mt-8 text-sm leading-7 text-muted">{draft.footerNote}</p>
                </div>
              </div>
            </article>
          ) : page.pageRole === "toc" ? (
            <article className="rounded-[26px] border border-line/70 bg-white p-8">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Table Of Contents</p>
              <h3 className="mt-3 text-3xl font-semibold text-ink">{draft.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted">{draft.subtitle}</p>
              <div className="mt-6 whitespace-pre-line rounded-[22px] bg-[#f7f9fc] p-6 text-base leading-8 text-ink">{draft.bodyText}</div>
              <p className="mt-5 text-sm leading-7 text-muted">{draft.footerNote}</p>
            </article>
          ) : (
            <article className="rounded-[26px] border border-line/70 bg-white p-8">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Final Page</p>
                  <h3 className="mt-3 text-3xl font-semibold text-ink">{draft.title}</h3>
                  <p className="mt-4 text-base leading-8 text-muted">{draft.subtitle}</p>
                  <div className="mt-6 rounded-[22px] bg-[#f7f9fc] p-6 text-[17px] leading-9 text-ink">{draft.bodyText}</div>
                </div>
                <div className="space-y-4">
                  <div className="rounded-[22px] border border-line/70 bg-white p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">图片说明</p>
                    <p className="mt-3 text-sm leading-7 text-ink">{draft.imageCaption || "当前页无图片说明"}</p>
                  </div>
                  <div className="rounded-[22px] border border-line/70 bg-white p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">图表说明</p>
                    <p className="mt-3 text-sm leading-7 text-ink">{draft.chartCaption || "当前页无图表说明"}</p>
                  </div>
                  <div className="rounded-[22px] border border-line/70 bg-white p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">页尾备注</p>
                    <p className="mt-3 text-sm leading-7 text-ink">{draft.footerNote || "当前页无补充备注"}</p>
                  </div>
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}

function HardEditWorkspace({
  task,
  selectedPage,
  pages,
}: {
  task: Task;
  selectedPage: Page;
  pages: Page[];
}) {
  const setTaskSelectedPage = useAppStore((state) => state.setTaskSelectedPage);
  const hardEditDrafts = useAppStore((state) => state.hardEditDrafts);
  const updateHardEditDraft = useAppStore((state) => state.updateHardEditDraft);
  const saveHardEditDraft = useAppStore((state) => state.saveHardEditDraft);
  const orderedPages = useMemo(() => sortPagesForFinalOrder(pages), [pages]);
  const draft = useMemo(
    () => hardEditDrafts.find((item) => item.taskId === task.id && item.pageId === selectedPage.id),
    [hardEditDrafts, selectedPage.id, task.id],
  );
  const pageLabel = getPageDisplayLabel(selectedPage, pages);

  if (!draft) {
    return null;
  }

  function handleSelectPage(pageId: string) {
    if (draft?.isDirty) {
      const shouldLeave = window.confirm("当前页面有未保存修改，是否继续切换页面？未保存内容仍会保留在本地，但建议先保存。");
      if (!shouldLeave) {
        return;
      }
    }

    setTaskSelectedPage(task.id, pageId);
  }

  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <StageSidebar
        pages={orderedPages}
        selectedPageId={selectedPage.id}
        onSelect={handleSelectPage}
        helperText="当前阶段编辑的是已确认页面产物本身。左侧切换的是最终作品页，不再是大纲定义或参数设置。"
      />

      <HardEditPagePreview page={selectedPage} pageLabel={pageLabel} draft={draft} />

      <aside className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Hard Edit Fields</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">作品页直接编辑</h2>
        <div className="mt-5 space-y-4">
          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">保存状态</p>
              <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${draft.isDirty ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {draft.isDirty ? "未保存" : "已保存"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">最近保存时间：{formatTime(draft.lastSavedAt)}</p>
            <button
              type="button"
              onClick={() => saveHardEditDraft(draft.id)}
              className="mt-4 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#202632]"
            >
              保存当前页面
            </button>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">标题</p>
            <input
              value={draft.title}
              onChange={(event) => updateHardEditDraft(draft.id, { title: event.target.value })}
              className="mt-3 w-full rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
            />
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">副标题 / 摘要</p>
            <textarea
              value={draft.subtitle}
              onChange={(event) => updateHardEditDraft(draft.id, { subtitle: event.target.value })}
              className="mt-3 min-h-[96px] w-full resize-none rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
            />
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">正文 / 主视觉文案</p>
            <textarea
              value={draft.bodyText}
              onChange={(event) => updateHardEditDraft(draft.id, { bodyText: event.target.value })}
              className="mt-3 min-h-[140px] w-full resize-none rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
            />
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">图片说明</p>
            <input
              value={draft.imageCaption}
              onChange={(event) => updateHardEditDraft(draft.id, { imageCaption: event.target.value })}
              className="mt-3 w-full rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
            />
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">图表标题 / 说明</p>
            <input
              value={draft.chartCaption}
              onChange={(event) => updateHardEditDraft(draft.id, { chartCaption: event.target.value })}
              className="mt-3 w-full rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
            />
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">补充块内容 / 页尾备注</p>
            <textarea
              value={draft.footerNote}
              onChange={(event) => updateHardEditDraft(draft.id, { footerNote: event.target.value })}
              className="mt-3 min-h-[96px] w-full resize-none rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

export function WorkspaceShell({
  task,
  pages,
  pageVersions,
}: {
  task: Task;
  pages: Page[];
  pageVersions: PageVersion[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const selectedPage = useMemo(() => {
    const current = pages.find((page) => page.id === task.selectedPageId);
    if (task.currentStage === "packaging") {
      return current?.pageKind !== "content" ? current : pages.find((page) => page.pageKind !== "content") ?? pages[0];
    }

    return current ?? pages[0];
  }, [pages, task.currentStage, task.selectedPageId]);

  if (!pages.length || !selectedPage) {
    return (
      <div className="flex h-full flex-col gap-4">
        <WorkspaceStageRail task={task} />
        <section className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-line/70 bg-white shadow-panel">
          <div className="max-w-md text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Workspace</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">正在加载工作台页级结构</h2>
            <p className="mt-3 text-sm leading-7 text-muted">当前任务已经创建完成，正在把页级数据挂到工作台视图中。</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <WorkspaceStageRail task={task} />

      {task.currentStage === "candidates" ? (
        <StageTwoWorkspace
          task={task}
          selectedPage={selectedPage}
          pages={pages}
          pageVersions={pageVersions}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
        />
      ) : task.currentStage === "packaging" ? (
        <PackagingWorkspace task={task} selectedPage={selectedPage} pages={pages} pageVersions={pageVersions} />
      ) : task.currentStage === "hard-edit" ? (
        <HardEditWorkspace task={task} selectedPage={selectedPage} pages={pages} />
      ) : (
        <StageOneWorkspace task={task} selectedPage={selectedPage} pages={pages} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
      )}
    </div>
  );
}
