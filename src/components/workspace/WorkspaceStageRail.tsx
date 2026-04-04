import type { StageKey, Task } from "@/types/domain";

const stageLabels: Array<{ key: StageKey; title: string; subtitle: string }> = [
  { key: "outline", title: "大纲生成", subtitle: "页级结构确认" },
  { key: "candidates", title: "页面候选生成", subtitle: "版本预览与筛选" },
  { key: "packaging", title: "包装页生成", subtitle: "封面 / 目录候选筛选" },
  { key: "hard-edit", title: "页面硬编辑", subtitle: "细节定稿入口" },
  { key: "export", title: "格式转换输出", subtitle: "进入 Assets" },
];

export function WorkspaceStageRail({ task }: { task: Task }) {
  const activeLabel =
    task.currentStage === "outline"
      ? "Stage 1 Active"
      : task.currentStage === "candidates"
        ? "Stage 2 Active"
        : task.currentStage === "packaging"
          ? "Stage 2.5 Packaging"
        : task.currentStage === "hard-edit"
          ? "Hard Edit"
          : "Export";

  return (
    <div className="rounded-[22px] border border-line/70 bg-[#f8fafc] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted">Flow</p>
          <h2 className="mt-1 text-sm font-semibold text-ink">工作台阶段</h2>
        </div>
        <span className="rounded-full border border-line/70 bg-white px-3 py-1 text-[11px] text-muted">{activeLabel}</span>
      </div>

      <div className="mt-4 grid gap-2 xl:grid-cols-5">
        {stageLabels.map((stage, index) => {
          const isActive = task.currentStage === stage.key;
          return (
            <div
              key={stage.key}
              className={`rounded-[18px] border px-3 py-3 transition ${
                isActive ? "border-ink/15 bg-white text-ink shadow-sm" : "border-transparent bg-white/55 text-ink"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 min-w-7 items-center justify-center rounded-full text-[11px] font-semibold ${
                    isActive ? "bg-ink text-white" : "bg-[#eef2f7] text-muted"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{stage.title}</h3>
                  <p className={`mt-0.5 truncate text-xs ${isActive ? "text-muted" : "text-muted/85"}`}>{stage.subtitle}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
