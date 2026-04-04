import type { Page } from "@/types/domain";

function summarize(text: string) {
  return text.length > 16 ? `${text.slice(0, 16)}...` : text;
}

export function OutlinePageCard({
  page,
  pageLabel,
  isActive,
  onClick,
}: {
  page: Page;
  pageLabel: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[20px] border p-4 text-left transition ${
        isActive
          ? "border-ink bg-white shadow-panel"
          : "border-line/70 bg-white/90 shadow-sm hover:border-ink/20 hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{pageLabel}</p>
          <p className="mt-2 text-sm font-medium text-ink">{page.pageType}</p>
        </div>
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${page.sourceMode === "user" ? "bg-emerald-500" : "bg-slate-300"}`}
          aria-label={page.sourceMode === "user" ? "用户提供" : "系统生成"}
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-muted">
        {page.pageKind === "packaging" ? "包装页，不纳入内容大纲覆盖。" : summarize(page.outlineText)}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-[#f3f5f8] px-2.5 py-1 text-[11px] font-medium text-slate-600">
          {page.pageKind === "packaging" ? "包装页" : "内容页"}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            page.isConfirmed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {page.isConfirmed ? "已确认" : "待确认"}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            page.isSaved ? "bg-[#eef2f7] text-ink" : "bg-[#f7f8fa] text-muted"
          }`}
        >
          {page.isSaved ? "已保存" : "未保存"}
        </span>
      </div>
    </button>
  );
}
