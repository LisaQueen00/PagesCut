import { useMemo, useState } from "react";
import { CandidatePreview } from "@/components/workspace/CandidatePreview";
import { OutlinePageCard } from "@/components/workspace/OutlinePageCard";
import { StageOneDrawer } from "@/components/workspace/StageOneDrawer";
import { StageTwoDrawer } from "@/components/workspace/StageTwoDrawer";
import { WorkspaceStageRail } from "@/components/workspace/WorkspaceStageRail";
import { formatTime } from "@/lib/format";
import { getPageDisplayLabel, sortPagesForFinalOrder } from "@/lib/pageDisplay";
import { useAppStore } from "@/store/appStore";
import type { FinalComposition, FinalCompositionPage, HardEditPageDraft, Page, PageVersion, Task } from "@/types/domain";

const stylePool = [
  "现代杂志感，简洁留白",
  "轻专业汇报风，克制排版",
  "图文节奏鲜明，信息清楚",
  "冷静科技感，强调标题层级",
  "高端刊物风，边界轻、留白大",
];

function getGroupedPages<T extends Page | FinalCompositionPage>(pages: T[]) {
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

function StageSidebar<T extends Page | FinalCompositionPage>({
  pages,
  selectedPageId,
  onSelect,
  helperText,
  sourcePageMap,
  hardEditDraftMap,
  readOnlyPageIds,
  emptyLabels,
}: {
  pages: T[];
  selectedPageId: string;
  onSelect: (pageId: string) => void;
  helperText: string;
  sourcePageMap?: Map<string, Page>;
  hardEditDraftMap?: Map<string, HardEditPageDraft>;
  readOnlyPageIds?: Set<string>;
  emptyLabels?: Partial<Record<"front" | "content" | "rear", string>>;
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
                {group.pages.map((page) => {
                  const sourcePage = "sourcePageId" in page ? sourcePageMap?.get(page.sourcePageId) : page;
                  const hardEditDraft = "sourcePageId" in page ? hardEditDraftMap?.get(page.id) : undefined;
                  const isReadOnly = readOnlyPageIds?.has(page.id) ?? false;
                  const cardPage = {
                    pageType: page.pageType,
                    pageKind: page.pageKind,
                    sourceMode: sourcePage && "sourceMode" in sourcePage ? sourcePage.sourceMode : undefined,
                    outlineText: sourcePage && "outlineText" in sourcePage ? sourcePage.outlineText : undefined,
                    isConfirmed: hardEditDraft ? true : sourcePage && "isConfirmed" in sourcePage ? sourcePage.isConfirmed : true,
                    isSaved: hardEditDraft ? !hardEditDraft.isDirty : sourcePage && "isSaved" in sourcePage ? sourcePage.isSaved : true,
                    statusLabel: hardEditDraft
                      ? hardEditDraft.isDirty
                        ? "未保存"
                        : "已保存"
                      : isReadOnly
                        ? "当前不编辑"
                        : undefined,
                    disabled: isReadOnly,
                  } as const;
                  return (
                    <OutlinePageCard
                      key={page.id}
                      page={cardPage}
                      pageLabel={getPageDisplayLabel(page, pages)}
                      isActive={page.id === selectedPageId}
                      onClick={() => onSelect(page.id)}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-[16px] border border-dashed border-line/70 bg-[#fbfcfd] px-3 py-4 text-sm leading-6 text-muted">
                {emptyLabels?.[group.key as "front" | "content" | "rear"] ?? group.emptyLabel}
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
  const canAdvance = useAppStore((state) => state.canEnterCandidatesStage(task.id));

  function handleSave() {
    savePage(selectedPage.id);
  }

  function rollStyle() {
    const nextStyle = stylePool[Math.floor(Math.random() * stylePool.length)];
    updatePage(selectedPage.id, { styleText: nextStyle });
  }

  const pageLabel = getPageDisplayLabel(selectedPage, pages);
  const savedLabel = selectedPage.isSaved ? `${pageLabel} 已保存` : "当前修改尚未保存";

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
                    <h4 className="mt-2 text-2xl font-semibold tracking-tight text-ink">当前页大纲正文预览 / 编辑区</h4>
                  </div>
                  <span className="rounded-full border border-line/60 bg-white px-3 py-1 text-xs text-muted">
                    {selectedPage.sourceMode === "user" ? "用户提供" : "系统生成"}
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
                      disabled={!canAdvance}
                      className={`rounded-full px-5 py-3 text-sm font-medium text-white transition ${
                        canAdvance ? "bg-ink hover:bg-[#202632]" : "cursor-not-allowed bg-slate-300"
                      }`}
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
                  <p className="mt-2 text-sm leading-6 text-muted">当前聚焦页级大纲阅读、修改与保存。</p>
                </div>
                <div className="rounded-[22px] border border-line/50 bg-[#f8fafc] p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Next Step</p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    <p>页类型：{selectedPage.pageType}</p>
                    <p>页面类别：内容页</p>
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
  const canAdvance = useAppStore((state) => state.canEnterPackagingStage(task.id));

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
  const contentPages = pages;

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
        canEnterPackaging={canAdvance}
      />
    </div>
  );
}

function PackagingWorkspace({
  task,
  selectedPage,
  packagingPages,
  contentPages,
  pageVersions,
}: {
  task: Task;
  selectedPage: Page;
  packagingPages: Page[];
  contentPages: Page[];
  pageVersions: PageVersion[];
}) {
  const setTaskSelectedPage = useAppStore((state) => state.setTaskSelectedPage);
  const packagingCandidates = useAppStore((state) => state.packagingCandidates);
  const regeneratePackagingPage = useAppStore((state) => state.regeneratePackagingPage);
  const selectPackagingCandidate = useAppStore((state) => state.selectPackagingCandidate);
  const approvePackagingCandidate = useAppStore((state) => state.approvePackagingCandidate);
  const enterHardEditStage = useAppStore((state) => state.enterHardEditStage);
  const canAdvance = useAppStore((state) => state.canEnterHardEditStage(task.id));
  const sidebarPages = useMemo(
    () => [...packagingPages, ...contentPages].sort((a, b) => a.index - b.index),
    [contentPages, packagingPages],
  );
  const readOnlyPageIds = useMemo(() => new Set(contentPages.map((page) => page.id)), [contentPages]);
  const selectedVersion = useMemo(
    () => pageVersions.find((version) => version.isSelected) ?? pageVersions[pageVersions.length - 1],
    [pageVersions],
  );
  const currentPackagingCandidates = useMemo(
    () =>
      packagingCandidates
        .filter((candidate) => candidate.taskId === task.id && candidate.pageId === selectedPage.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [packagingCandidates, selectedPage.id, task.id],
  );
  const selectedPackagingCandidate = useMemo(
    () => currentPackagingCandidates.find((candidate) => candidate.isSelected) ?? currentPackagingCandidates[0],
    [currentPackagingCandidates],
  );
  const approvedPackagingCandidate = useMemo(
    () => currentPackagingCandidates.find((candidate) => candidate.isApproved),
    [currentPackagingCandidates],
  );
  const approvedPackagingCount = useMemo(
    () =>
      packagingPages.filter((page) =>
        packagingCandidates.some((candidate) => candidate.taskId === task.id && candidate.pageId === page.id && candidate.isApproved),
      ).length,
    [packagingCandidates, packagingPages, task.id],
  );
  const selectedPreviewHtml = selectedPackagingCandidate?.previewHtml ?? "";
  const pageLabel = getPageDisplayLabel(selectedPage, packagingPages);
  const contentTitles = useMemo(
    () => contentPages.slice().sort((a, b) => a.index - b.index).map((page, index) => `${index + 1}. ${page.pageType}`),
    [contentPages],
  );
  const approvedContentVersion = useMemo(
    () => pageVersions.find((version) => version.isApproved),
    [pageVersions],
  );

  if (!selectedVersion || !packagingPages.length || !selectedPackagingCandidate) {
    return null;
  }

  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
      <StageSidebar
        pages={sidebarPages}
        selectedPageId={selectedPage.id}
        onSelect={(pageId) => setTaskSelectedPage(task.id, pageId)}
        helperText="内容页方案已经确认。当前阶段只处理前置包装页候选，封面页与目录页都建立在已确认内容结构之上。"
        readOnlyPageIds={readOnlyPageIds}
        emptyLabels={{
          content: contentPages.length ? "内容页已确认并已纳入当前方案，本阶段仅处理包装页。" : "当前还没有内容页。",
          rear: "后置包装页当前仍为预留位，暂未配置，后续阶段再补充。",
        }}
      />

      <CandidatePreview
        version={selectedVersion}
        previewHtml={selectedPreviewHtml}
        stageLabel="Stage 2.5"
        title={selectedPage.pageRole === "cover" ? "封面页候选预览" : "目录页候选预览"}
        footerLabel={`${selectedPackagingCandidate.candidateLabel} · 基于 ${approvedContentVersion?.versionLabel ?? selectedVersion.versionLabel} 的包装页结果`}
        statusLabel={approvedPackagingCandidate?.id === selectedPackagingCandidate.id ? "当前已选包装结果" : "包装页候选预览中"}
      />

      <aside className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 2.5</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">包装页生成与筛选</h2>
        <div className="mt-5 space-y-4">
          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage Context</p>
            <h3 className="mt-2 text-base font-semibold text-ink">内容方案已确认，当前生成包装页</h3>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>已确认内容方案：{approvedContentVersion?.versionLabel ?? selectedVersion.versionLabel}</p>
              <p>已确认内容页数量：{contentPages.length}</p>
              <p>当前阶段目标：基于已确认内容结构，补齐封面页与目录页，并分别选定包装页结果。</p>
              <p>当前完成度：{approvedPackagingCount} / {packagingPages.length} 个前置包装页已选定</p>
            </div>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Current Packaging Page</p>
            <h3 className="mt-2 text-base font-semibold text-ink">
              {pageLabel} · {selectedPage.pageType}
            </h3>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>基于内容方案：{approvedContentVersion?.versionLabel ?? selectedVersion.versionLabel}</p>
              <p>包装页类型：{selectedPage.pageRole === "cover" ? "封面页" : "目录页"}</p>
              <p>{selectedPage.pageRole === "cover" ? "封面页候选围绕刊名、副标题、期次、品牌与主视觉信息生成。" : "目录页候选直接依赖已确认内容页的顺序与标题，不是独立随意写出的一页。"} </p>
              <p>当前预览候选：{selectedPackagingCandidate.candidateLabel}</p>
              <p>{approvedPackagingCandidate ? `已选定结果：${approvedPackagingCandidate.candidateLabel}` : "当前页尚未选定最终包装结果"}</p>
            </div>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Packaging Candidates</p>
                <h3 className="mt-2 text-base font-semibold text-ink">{selectedPage.pageRole === "cover" ? "封面页候选" : "目录页候选"}</h3>
              </div>
              <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-xs text-muted">{currentPackagingCandidates.length} 个候选</span>
            </div>

            <div className="mt-4 space-y-3">
              {currentPackagingCandidates.map((candidate) => {
                const isActive = selectedPackagingCandidate.id === candidate.id;
                return (
                  <div
                    key={candidate.id}
                    className={`rounded-[18px] border p-4 ${isActive ? "border-ink bg-[#fbfcff]" : "border-line/70 bg-white"}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{candidate.candidateLabel}</p>
                        <p className="mt-1 text-xs text-muted">{formatTime(candidate.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        {candidate.isApproved ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">已选定</span> : null}
                        {isActive ? <span className="rounded-full bg-[#eef2f7] px-2.5 py-1 text-[11px] text-muted">当前预览</span> : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted">{candidate.summary}</p>
                    <p className="mt-2 text-xs text-muted">{candidate.promptNote}</p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectPackagingCandidate(task.id, selectedPage.id, candidate.id)}
                        className="rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink transition hover:border-ink/20"
                      >
                        预览此候选
                      </button>
                      <button
                        type="button"
                        onClick={() => approvePackagingCandidate(task.id, selectedPage.id, candidate.id)}
                        className="rounded-full border border-line bg-white px-4 py-2 text-xs font-medium text-ink transition hover:border-ink/20"
                      >
                        选定为当前结果
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {selectedPage.pageRole === "toc" ? (
            <section className="rounded-[20px] border border-line/70 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Structure Source</p>
              <h3 className="mt-2 text-base font-semibold text-ink">目录页来源于已确认内容结构</h3>
              <p className="mt-2 text-sm leading-6 text-muted">目录页候选直接根据当前内容页的顺序与标题生成。下面这组内容结构就是它的来源，不是独立随意编写。</p>
              <div className="mt-4 rounded-[18px] bg-[#f8fafc] p-4 text-sm leading-7 text-ink">
                {contentTitles.map((title) => (
                  <p key={title}>{title}</p>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-[20px] border border-line/70 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Content Dependency</p>
              <h3 className="mt-2 text-base font-semibold text-ink">封面页建立在已确认内容方案之上</h3>
              <p className="mt-2 text-sm leading-6 text-muted">封面页不是独立漂浮的一页。它继承已确认内容方案的风格方向、刊名信息与阅读定位，用来为整期内容建立入口与识别感。</p>
            </section>
          )}

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Light Regenerate</p>
            <h3 className="mt-2 text-base font-semibold text-ink">轻量再生成</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              {selectedPage.pageRole === "cover"
                ? "再生成会新增一个新的封面页候选，调整标题呈现、主视觉说明与信息层级。"
                : "再生成会新增一个新的目录页候选，继续基于当前内容结构调整目录组织方式与展示样式。"}
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
            <p className="mt-2 text-sm leading-6 text-muted">下一步会基于已确认内容方案，以及封面页 / 目录页各自已选定的包装结果，落地 Final Composition，再进入作品页硬编辑。</p>
            <button
              type="button"
              onClick={() => enterHardEditStage(task.id)}
              disabled={!canAdvance}
              className={`mt-4 w-full rounded-full px-5 py-3 text-sm font-medium text-white transition ${
                canAdvance ? "bg-ink hover:bg-[#202632]" : "cursor-not-allowed bg-slate-300"
              }`}
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
  page: FinalCompositionPage;
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
  compositionPages,
  sourcePageMap,
}: {
  task: Task;
  selectedPage: FinalCompositionPage;
  compositionPages: FinalCompositionPage[];
  sourcePageMap: Map<string, Page>;
}) {
  const setTaskSelectedPage = useAppStore((state) => state.setTaskSelectedPage);
  const hardEditDrafts = useAppStore((state) => state.hardEditDrafts);
  const updateHardEditDraft = useAppStore((state) => state.updateHardEditDraft);
  const saveHardEditDraft = useAppStore((state) => state.saveHardEditDraft);
  const enterExportStage = useAppStore((state) => state.enterExportStage);
  const canEnterExport = useAppStore((state) => state.canEnterExportStage(task.id));
  const orderedPages = useMemo(() => sortPagesForFinalOrder(compositionPages), [compositionPages]);
  const hardEditDraftMap = useMemo(
    () =>
      new Map(
        hardEditDrafts
          .filter((item) => item.taskId === task.id)
          .map((item) => [item.compositionPageId, item] as const),
      ),
    [hardEditDrafts, task.id],
  );
  const draft = useMemo(
    () => hardEditDrafts.find((item) => item.taskId === task.id && item.compositionPageId === selectedPage.id),
    [hardEditDrafts, selectedPage.id, task.id],
  );
  const pageLabel = getPageDisplayLabel(selectedPage, compositionPages);

  if (!draft) {
    return null;
  }

  const currentDraft = draft;

  function handleSelectPage(pageId: string) {
    if (currentDraft.isDirty) {
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
        helperText="当前阶段编辑的是 Final Composition 中的已确认作品页。左侧切换的是最终编排页实例，不再是大纲定义页。"
        sourcePageMap={sourcePageMap}
        hardEditDraftMap={hardEditDraftMap}
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
            <p className="mt-2 text-xs text-muted">来源编排页：{pageLabel}，来源版本：{draft.sourceVersionId}</p>
            <button
              type="button"
              onClick={() => saveHardEditDraft(draft.id)}
              className="mt-4 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#202632]"
            >
              保存当前页面
            </button>
            <button
              type="button"
              onClick={() => enterExportStage(task.id)}
              disabled={!canEnterExport}
              className={`mt-3 w-full rounded-full px-5 py-3 text-sm font-medium text-white transition ${
                canEnterExport ? "bg-[#2f4358] hover:bg-[#243647]" : "cursor-not-allowed bg-slate-300"
              }`}
            >
              进入 Stage 3 / 导出沉淀
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

function ExportWorkspace({
  task,
  finalComposition,
  finalCompositionPages,
}: {
  task: Task;
  finalComposition: FinalComposition;
  finalCompositionPages: FinalCompositionPage[];
}) {
  const setTaskPreferredExportFormat = useAppStore((state) => state.setTaskPreferredExportFormat);
  const createAssetFromFinalComposition = useAppStore((state) => state.createAssetFromFinalComposition);
  const canCreateAsset = useAppStore((state) => state.canEnterExportStage(task.id));
  const assets = useAppStore((state) => state.assets);

  const latestAsset = useMemo(
    () => assets.find((asset) => asset.compositionId === finalComposition.id),
    [assets, finalComposition.id],
  );
  const pageTypes = useMemo(() => finalCompositionPages.map((page) => page.pageType), [finalCompositionPages]);
  const isPdfReady = latestAsset?.status === "completed" && latestAsset.fileMimeType === "application/pdf" && latestAsset.downloadUrl.startsWith("data:application/pdf");
  const isProcessing = latestAsset?.status === "preparing" || latestAsset?.status === "processing";
  return (
    <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="soft-grid relative overflow-hidden rounded-[28px] border border-line/70 bg-white p-6 shadow-panel">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f8fafc] to-transparent" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 3</p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">导出准备与产物沉淀</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">当前这一步会把已完成硬编辑的 Final Composition 转成真实 PDF 文件，并把文件引用写入 Assets。</p>
            </div>
            <div className="rounded-[20px] border border-line/70 bg-[#f8fafc] px-4 py-3 text-sm text-muted">
              Composition 更新于 {formatTime(finalComposition.updatedAt)}
            </div>
          </div>

          <div className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="rounded-[24px] border border-line/70 bg-[#fcfdff] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted">Export Summary</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{task.title}</h3>
                </div>
                <span className="rounded-full bg-ink px-4 py-2 text-sm text-white">{task.preferredExportFormat.toUpperCase()}</span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-[18px] border border-line/70 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Source</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{finalComposition.id}</p>
                  <p className="mt-2 text-xs text-muted">来源版本：{finalComposition.approvedContentVersionId}</p>
                </div>
                <div className="rounded-[18px] border border-line/70 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Pages</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{finalCompositionPages.length} 页</p>
                  <p className="mt-2 text-xs text-muted">前置包装 + 内容页 + 最终编排顺序</p>
                </div>
                <div className="rounded-[18px] border border-line/70 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">Packaging</p>
                  <p className="mt-2 text-sm font-semibold text-ink">{finalComposition.approvedPackagingCandidateIds.length} 个已选包装结果</p>
                  <p className="mt-2 text-xs text-muted">封面页 / 目录页已固化进当前 composition</p>
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-line/70 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Page Types</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pageTypes.map((pageType, index) => (
                    <span key={`${pageType}-${index}`} className="rounded-full bg-[#f3f5f8] px-3 py-1.5 text-xs text-muted">
                      {pageType}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-[22px] border border-line/70 bg-white p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Export Format</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setTaskPreferredExportFormat(task.id, "pdf")}
                    className={`rounded-[18px] border px-4 py-4 text-left ${task.preferredExportFormat === "pdf" ? "border-ink bg-[#fbfcff]" : "border-line/70 bg-white"}`}
                  >
                    <p className="text-sm font-semibold text-ink">PDF</p>
                    <p className="mt-2 text-xs text-muted">本轮已接通真实导出，可生成并下载 PDF 文件。</p>
                  </button>
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-[18px] border border-line/70 bg-slate-50 px-4 py-4 text-left opacity-75"
                  >
                    <p className="text-sm font-semibold text-ink">PPTX</p>
                    <p className="mt-2 text-xs text-muted">这轮暂不接通真实导出，后续再补。</p>
                  </button>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">PDF Export</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">生成真实 PDF 文件</h3>
                <p className="mt-3 text-sm leading-6 text-muted">当前会直接以 Final Composition 为来源生成真实 PDF，并把文件引用写入 Asset，随后可在 Assets 中下载。</p>
                <button
                  type="button"
                  onClick={() => void createAssetFromFinalComposition(task.id)}
                  disabled={!canCreateAsset || isProcessing}
                  className={`mt-4 w-full rounded-full px-5 py-3 text-sm font-medium text-white transition ${
                    canCreateAsset && !isProcessing ? "bg-ink hover:bg-[#202632]" : "cursor-not-allowed bg-slate-300"
                  }`}
                >
                  {isProcessing ? "PDF 导出中..." : isPdfReady ? "重新生成 PDF" : "开始导出 PDF"}
                </button>
              </section>

              <section className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Current Result</p>
                <h3 className="mt-2 text-lg font-semibold text-ink">当前 Assets 状态</h3>
                {latestAsset ? (
                  <div className="mt-4 rounded-[20px] border border-line/70 bg-white p-4">
                    <p className="text-sm font-semibold text-ink">{latestAsset.title}</p>
                    <p className="mt-2 text-sm text-muted">{latestAsset.exportFormat.toUpperCase()} · {latestAsset.pageCount} 页 · {formatTime(latestAsset.createdAt)}</p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {latestAsset.status === "completed"
                        ? `导出成功，已生成可下载 PDF。${latestAsset.readyAt ? `完成于 ${formatTime(latestAsset.readyAt)}。` : ""}`
                        : latestAsset.status === "failed"
                          ? `导出失败。${latestAsset.errorMessage || "请稍后重试。"}`
                          : "正在生成 PDF 文件，请稍候。"}
                    </p>
                    {isPdfReady ? (
                      <a
                        href={latestAsset.downloadUrl}
                        download={latestAsset.fileName}
                        className="mt-4 inline-flex rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/20"
                      >
                        下载 PDF
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[20px] border border-dashed border-line/70 bg-white p-4 text-sm leading-6 text-muted">
                    当前 Final Composition 还没有导出文件。开始导出后，将先进入导出状态，再在 Assets 中成为可下载的 PDF 作品。
                  </div>
                )}
              </section>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}

export function WorkspaceShell({
  task,
  pages,
  packagingPages,
  pageVersions,
  finalComposition,
  finalCompositionPages,
}: {
  task: Task;
  pages: Page[];
  packagingPages: Page[];
  pageVersions: PageVersion[];
  finalComposition: FinalComposition | undefined;
  finalCompositionPages: FinalCompositionPage[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const sourcePageMap = useMemo(() => new Map([...pages, ...packagingPages].map((page) => [page.id, page])), [pages, packagingPages]);

  const selectedContentPage = useMemo(() => {
    const current = pages.find((page) => page.id === task.selectedPageId);
    return current ?? pages[0];
  }, [pages, task.selectedPageId]);

  const selectedPackagingPage = useMemo(() => {
    const current = packagingPages.find((page) => page.id === task.selectedPageId);
    return current ?? packagingPages[0];
  }, [packagingPages, task.selectedPageId]);

  const selectedCompositionPage = useMemo(() => {
    const current = finalCompositionPages.find((page) => page.id === task.selectedPageId);
    return current ?? finalCompositionPages[0];
  }, [finalCompositionPages, task.selectedPageId]);

  if (task.currentStage === "hard-edit") {
    if (!finalComposition || !finalCompositionPages.length || !selectedCompositionPage) {
      return (
        <div className="flex h-full flex-col gap-4">
          <WorkspaceStageRail task={task} />
          <section className="flex min-h-[520px] items-center justify-center rounded-[28px] border border-line/70 bg-white shadow-panel">
            <div className="max-w-md text-center">
              <p className="text-xs uppercase tracking-[0.24em] text-muted">Final Composition</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">正在准备最终编排稿</h2>
              <p className="mt-3 text-sm leading-7 text-muted">当前任务已进入硬编辑阶段，正在从满意内容方案和包装页生成最终编排稿。</p>
            </div>
          </section>
        </div>
      );
    }
  } else if (!selectedContentPage && task.currentStage !== "packaging") {
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

      {task.currentStage === "candidates" && selectedContentPage ? (
        <StageTwoWorkspace
          task={task}
          selectedPage={selectedContentPage}
          pages={pages}
          pageVersions={pageVersions}
          drawerOpen={drawerOpen}
          setDrawerOpen={setDrawerOpen}
        />
      ) : task.currentStage === "packaging" && selectedPackagingPage ? (
        <PackagingWorkspace
          task={task}
          selectedPage={selectedPackagingPage}
          packagingPages={packagingPages}
          contentPages={pages}
          pageVersions={pageVersions}
        />
      ) : task.currentStage === "hard-edit" && selectedCompositionPage ? (
        <HardEditWorkspace
          task={task}
          selectedPage={selectedCompositionPage}
          compositionPages={finalCompositionPages}
          sourcePageMap={sourcePageMap}
        />
      ) : task.currentStage === "export" && finalComposition ? (
        <ExportWorkspace
          task={task}
          finalComposition={finalComposition}
          finalCompositionPages={finalCompositionPages}
        />
      ) : selectedContentPage ? (
        <StageOneWorkspace task={task} selectedPage={selectedContentPage} pages={pages} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} />
      ) : null}
    </div>
  );
}
