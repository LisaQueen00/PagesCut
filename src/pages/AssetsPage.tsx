import { useMemo, useState } from "react";
import { formatTime } from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import type { Asset, FinalCompositionPage } from "@/types/domain";

const A4_RATIO = 210 / 297;
const SLIDE_RATIO = 16 / 9;

function getWorkTypeLabel(workType: "magazine" | "report") {
  return workType === "magazine" ? "月刊 / 刊物" : "报告 / PPT";
}

function getPreviewRatio(exportFormat: "pdf" | "pptx") {
  return exportFormat === "pptx" ? SLIDE_RATIO : A4_RATIO;
}

function getStatusMeta(asset: Asset) {
  if (asset.status === "completed" && asset.exportFormat === "pdf" && asset.fileMimeType === "application/pdf" && asset.downloadUrl.startsWith("data:application/pdf")) {
    return {
      label: "PDF 可下载",
      tone: "bg-emerald-50 text-emerald-700",
      helper: `导出成功${asset.readyAt ? `，完成于 ${formatTime(asset.readyAt)}` : ""}。`,
    };
  }

  if (asset.status === "completed") {
    return {
      label: "已生成记录",
      tone: "bg-slate-100 text-slate-700",
      helper: "当前只有产物记录，尚未附带真实文件。",
    };
  }

  if (asset.status === "preparing") {
    return {
      label: "准备导出",
      tone: "bg-sky-50 text-sky-700",
      helper: "正在整理 Final Composition 与硬编辑内容。",
    };
  }

  if (asset.status === "processing") {
    return {
      label: "导出中",
      tone: "bg-amber-50 text-amber-700",
      helper: "正在生成真实 PDF 文件。",
    };
  }

  return {
    label: "导出失败",
    tone: "bg-rose-50 text-rose-700",
    helper: asset.errorMessage || "PDF 导出失败，请稍后重试。",
  };
}

function PageThumbnail({
  page,
  pageNumber,
  exportFormat,
  onClick,
}: {
  page: FinalCompositionPage;
  pageNumber: number;
  exportFormat: "pdf" | "pptx";
  onClick: () => void;
}) {
  const ratio = getPreviewRatio(exportFormat);
  const frameWidth = exportFormat === "pptx" ? 110 : 86;
  const frameHeight = Math.round(frameWidth / ratio);
  const scale = frameWidth / 920;

  return (
    <button
      type="button"
      onClick={onClick}
      className="overflow-hidden rounded-[14px] border border-line/70 bg-[#f4f7fb] text-left transition hover:border-ink/20 hover:shadow-sm"
      style={{ width: frameWidth, minWidth: frameWidth, maxWidth: frameWidth }}
    >
      <div className="relative overflow-hidden bg-white" style={{ height: frameHeight }}>
        <div
          className="origin-top-left overflow-hidden opacity-85"
          style={{ width: 920, height: 620, transform: `scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: page.previewHtml }}
        />
        <div className="pointer-events-none absolute inset-0 bg-white/28" />
        <div className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-slate-950/72 px-1.5 py-0.5 text-[9px] font-medium text-white">
          {pageNumber}
        </div>
      </div>
      <div className="border-t border-line/60 bg-white px-2 py-1.5">
        <p className="truncate text-[10px] font-medium text-ink">{page.pageType}</p>
      </div>
    </button>
  );
}

function PreviewModal({
  pages,
  pageIndex,
  exportFormat,
  onClose,
  onPrev,
  onNext,
}: {
  pages: FinalCompositionPage[];
  pageIndex: number;
  exportFormat: "pdf" | "pptx";
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const page = pages[pageIndex];
  if (!page) {
    return null;
  }

  const ratio = getPreviewRatio(exportFormat);
  const frameWidth = exportFormat === "pptx" ? 1120 : 760;
  const frameHeight = Math.round(frameWidth / ratio);
  const scale = frameWidth / 920;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/58 p-4">
      <div className="relative w-full max-w-6xl rounded-[28px] border border-white/20 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line/70 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Preview</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">
              {page.pageType} · 第 {pageIndex + 1} / {pages.length} 页
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line/70 bg-white px-4 py-2 text-sm text-muted transition hover:text-ink"
          >
            关闭
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[72px_minmax(0,1fr)_72px]">
          <button
            type="button"
            onClick={onPrev}
            disabled={pageIndex === 0}
            className={`rounded-[20px] border px-3 py-4 text-sm ${
              pageIndex === 0 ? "cursor-not-allowed border-line/50 bg-slate-100 text-muted" : "border-line/70 bg-white text-ink hover:border-ink/20"
            }`}
          >
            上一页
          </button>

          <div className="overflow-hidden rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
            <div
              className="mx-auto overflow-hidden rounded-[18px] bg-white shadow-sm"
              style={{ width: frameWidth, maxWidth: "100%", height: frameHeight }}
            >
              <div
                className="origin-top-left"
                style={{ width: 920, height: 620, transform: `scale(${scale})` }}
                dangerouslySetInnerHTML={{ __html: page.previewHtml }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={pageIndex === pages.length - 1}
            className={`rounded-[20px] border px-3 py-4 text-sm ${
              pageIndex === pages.length - 1 ? "cursor-not-allowed border-line/50 bg-slate-100 text-muted" : "border-line/70 bg-white text-ink hover:border-ink/20"
            }`}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}

export function AssetsPage() {
  const [activePreview, setActivePreview] = useState<{ compositionId: string; pageIndex: number } | null>(null);
  const assets = useAppStore((state) => state.assets);
  const tasks = useAppStore((state) => state.tasks);
  const projects = useAppStore((state) => state.projects);
  const finalCompositionPages = useAppStore((state) => state.finalCompositionPages);

  const totalPages = assets.reduce((sum, asset) => sum + asset.pageCount, 0);
  const exportFormats = Array.from(new Set(assets.map((asset) => asset.exportFormat.toUpperCase())));

  const activePages = useMemo(() => {
    if (!activePreview) {
      return [];
    }

    return finalCompositionPages
      .filter((page) => page.compositionId === activePreview.compositionId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  }, [activePreview, finalCompositionPages]);

  return (
    <div className="rounded-[28px] bg-transparent p-2">
      <section className="rounded-[32px] border border-line/70 bg-white px-6 py-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Assets</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">最终作品</h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              这里集中展示已经完成的作品结果。当前可以浏览页面预览、查看生成时间与作品信息，并下载已成功导出的 PDF 文件。
            </p>
          </div>
          <div className="grid min-w-[280px] grid-cols-3 gap-3">
            <div className="rounded-[20px] border border-line/70 bg-[#f8fafc] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">作品数</p>
              <p className="mt-3 text-xl font-semibold text-ink">{assets.length}</p>
            </div>
            <div className="rounded-[20px] border border-line/70 bg-[#f8fafc] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">总页数</p>
              <p className="mt-3 text-xl font-semibold text-ink">{totalPages}</p>
            </div>
            <div className="rounded-[20px] border border-line/70 bg-[#f8fafc] px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">格式</p>
              <p className="mt-3 text-sm font-semibold text-ink">{exportFormats.length ? exportFormats.join(" / ") : "-"}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {assets.map((asset) => {
            const task = tasks.find((item) => item.id === asset.taskId);
            const project = projects.find((item) => item.id === task?.projectId);
            const compositionPages = finalCompositionPages
              .filter((page) => page.compositionId === asset.compositionId)
              .sort((a, b) => a.orderIndex - b.orderIndex);
            const includesPackaging = compositionPages.some((page) => page.pageKind === "packaging");
            const statusMeta = getStatusMeta(asset);
            const cleanDescription =
              asset.description === "Seed asset placeholder" ||
              asset.description.includes("version-") ||
              asset.description.includes("页面类型：")
                ? "当前作品已形成可浏览的结果记录。"
                : asset.description;
            const previewPages = compositionPages.slice(0, 5);

            return (
              <article key={asset.id} className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-ink">{asset.title}</h3>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-muted">{getWorkTypeLabel(asset.workType)}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-muted">{asset.exportFormat.toUpperCase()}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-muted">{asset.pageCount} 页</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
                      <span>生成于 {formatTime(asset.createdAt)}</span>
                      <span>项目：{project?.name ?? "default project"}</span>
                      <span>{includesPackaging ? "含封面页 / 目录页" : "内容页结果"}</span>
                    </div>

                    {cleanDescription ? <p className="mt-4 max-w-4xl text-sm leading-7 text-muted">{cleanDescription}</p> : null}

                    <div className="mt-4 rounded-[18px] border border-line/70 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-muted">页面预览</p>
                          <p className="mt-1 text-sm text-muted">点击任一页面可放大浏览</p>
                        </div>
                        {compositionPages.length > previewPages.length ? (
                          <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-xs text-muted">+{compositionPages.length - previewPages.length} 页</span>
                        ) : null}
                      </div>

                      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                        {previewPages.map((page, index) => (
                          <PageThumbnail
                            key={page.id}
                            page={page}
                            pageNumber={page.orderIndex}
                            exportFormat={asset.exportFormat}
                            onClick={() => setActivePreview({ compositionId: asset.compositionId, pageIndex: index })}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-[240px] space-y-3">
                    <div className="rounded-[18px] border border-line/70 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">当前状态</p>
                      <div className="mt-3">
                        <span className={`inline-flex rounded-full px-3 py-1.5 text-sm font-medium ${statusMeta.tone}`}>{statusMeta.label}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted">{statusMeta.helper}</p>
                      {asset.status === "completed" && asset.exportFormat === "pdf" && asset.fileMimeType === "application/pdf" && asset.downloadUrl.startsWith("data:application/pdf") ? (
                        <a
                          href={asset.downloadUrl}
                          download={asset.fileName}
                          className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/20"
                        >
                          下载 PDF
                        </a>
                      ) : asset.exportFormat === "pptx" ? (
                        <div className="mt-4 rounded-full border border-line/70 bg-slate-50 px-4 py-2 text-center text-sm text-muted">PPTX 即将支持</div>
                      ) : asset.status === "failed" ? (
                        <div className="mt-4 rounded-full border border-rose-100 bg-rose-50 px-4 py-2 text-center text-sm text-rose-700">导出失败</div>
                      ) : (
                        <div className="mt-4 rounded-full border border-line/70 bg-slate-50 px-4 py-2 text-center text-sm text-muted">PDF 生成中</div>
                      )}
                    </div>

                    <div className="rounded-[18px] border border-line/70 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">任务描述</p>
                      <p className="mt-3 text-sm leading-6 text-muted">{task?.prompt ?? task?.title ?? "-"}</p>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {activePreview ? (
        <PreviewModal
          pages={activePages}
          pageIndex={activePreview.pageIndex}
          exportFormat={assets.find((asset) => asset.compositionId === activePreview.compositionId)?.exportFormat ?? "pdf"}
          onClose={() => setActivePreview(null)}
          onPrev={() => setActivePreview((current) => (current ? { ...current, pageIndex: Math.max(0, current.pageIndex - 1) } : current))}
          onNext={() =>
            setActivePreview((current) =>
              current ? { ...current, pageIndex: Math.min(activePages.length - 1, current.pageIndex + 1) } : current,
            )
          }
        />
      ) : null}
    </div>
  );
}
