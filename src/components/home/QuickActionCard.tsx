import type { ReactNode } from "react";

export function QuickActionCard({
  title,
  description,
  badge,
  onClick,
}: {
  title: string;
  description: string;
  badge: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-[24px] border border-line/70 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-panel"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{badge}</span>
        <span className="text-sm text-muted transition group-hover:text-ink">发起</span>
      </div>
      <h3 className="mt-6 text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </button>
  );
}
