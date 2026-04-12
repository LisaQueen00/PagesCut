import { ResponsiveHtmlPreview } from "@/lib/htmlPreview";
import { PageModelPreview } from "@/lib/pageModel";
import type { PageVersion } from "@/types/domain";
import type { PageModel } from "@/types/pageModel";

export function CandidatePreview({
  version,
  pageModel,
  previewHtml,
  stageLabel = "Stage 2",
  title = "候选页面预览",
  footerLabel,
  statusLabel,
}: {
  version: PageVersion;
  pageModel?: PageModel | null;
  previewHtml: string;
  stageLabel?: string;
  title?: string;
  footerLabel?: string;
  statusLabel?: string;
}) {
  const debugPageType = pageModel?.pageType;
  const isModelTextCandidate = version.promptNote.includes("本地") || version.variantSummary.includes("模型正文候选");

  return (
    <section className="soft-grid relative min-w-0 overflow-hidden rounded-[28px] border border-line/70 bg-white p-6 shadow-panel">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f8fafc] to-transparent" />
      <div className="relative min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">{stageLabel}</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">{title}</h2>
          </div>
          {statusLabel ? <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{statusLabel}</span> : version.isApproved ? <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">当前满意方案</span> : null}
        </div>

        <div className="mt-7 min-w-0 rounded-[28px] border border-line/70 bg-[#fcfdff] p-6 shadow-sm">
          <div className="min-w-0 rounded-[26px] border border-line/70 bg-[#f6f8fc] p-5">
            <div className="mx-auto flex min-w-0 w-full justify-center">
              {pageModel ? (
                <PageModelPreview pageModel={pageModel} maxWidth={760} />
              ) : (
                // Fallback path for page types that have not migrated to PageModel yet.
                <ResponsiveHtmlPreview html={previewHtml} maxWidth={760} />
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
            <span className="flex flex-wrap items-center gap-2">
              <span>{footerLabel ?? `${version.versionLabel} · 当前方案页级预览`}</span>
              <span className="rounded-full bg-[#f6f8fc] px-2.5 py-1 text-[11px] text-muted">{isModelTextCandidate ? "模型正文候选" : version.variantSummary}</span>
              {debugPageType && !isModelTextCandidate ? (
                <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#3b5ccc]">
                  {debugPageType}
                </span>
              ) : null}
            </span>
            {statusLabel ? <span className="text-emerald-700">{statusLabel}</span> : version.isApproved ? <span className="text-emerald-700">当前已选为满意方案</span> : <span>候选方案预览中</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
