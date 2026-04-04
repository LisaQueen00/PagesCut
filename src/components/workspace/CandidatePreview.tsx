import type { PageVersion } from "@/types/domain";

export function CandidatePreview({
  version,
  previewHtml,
}: {
  version: PageVersion;
  previewHtml: string;
}) {
  return (
    <section className="soft-grid relative overflow-hidden rounded-[28px] border border-line/70 bg-white p-6 shadow-panel">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f8fafc] to-transparent" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 2</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">候选页面预览</h2>
          </div>
          {version.isApproved ? (
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm text-emerald-700">当前满意方案</span>
          ) : null}
        </div>

        <div className="mt-7 rounded-[28px] border border-line/70 bg-[#fcfdff] p-6 shadow-sm">
          <div className="min-h-[620px] rounded-[26px] border border-line/70 bg-[#f6f8fc] p-5">
            <div className="mx-auto max-w-[920px]" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
            <span>{version.versionLabel} · 当前方案页级预览</span>
            {version.isApproved ? <span className="text-emerald-700">当前已选为满意方案</span> : <span>候选方案预览中</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
