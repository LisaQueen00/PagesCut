import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QuickActionCard } from "@/components/home/QuickActionCard";
import { useAppStore } from "@/store/appStore";
import type { WorkType } from "@/types/domain";

export function HomePage() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();
  const createTask = useAppStore((state) => state.createTask);
  const isGenerating = useAppStore((state) => state.isGenerating);
  const tasks = useAppStore((state) => state.tasks);

  const stats = useMemo(
    () => [
      { label: "任务会话", value: tasks.length.toString().padStart(2, "0") },
      { label: "当前模式", value: "MVP" },
      { label: "工作流", value: "Outline First" },
    ],
    [tasks.length],
  );

  async function handleCreateTask(workType: WorkType, incomingPrompt?: string) {
    const nextPrompt =
      incomingPrompt?.trim() || prompt.trim() || (workType === "magazine" ? "请生成一期主题待补充的月刊" : "请生成一份主题待补充的报告 / PPT");
    const task = await createTask(nextPrompt, workType);
    setPrompt("");
    navigate(`/workspace/${task.id}`);
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded-[24px] bg-transparent p-2">
      <section className="relative overflow-hidden rounded-[32px] border border-line/70 bg-gradient-to-br from-white via-white to-[#f3f6fb] px-6 py-8 shadow-panel lg:px-8 lg:py-9">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#e9eef6] blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.26em] text-muted">Project Overview</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink lg:text-5xl">PagesCut</h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-muted">
                从任务描述进入页级工作流，先生成大纲，再逐页推进候选版本、硬编辑和导出。Phase 1 先完成任务入口和统一工作台壳层。
              </p>
            </div>

            <div className="grid min-w-[280px] grid-cols-3 gap-3">
              {stats.map((item) => (
                <div key={item.label} className="rounded-[22px] border border-white/70 bg-[#f7f9fc] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
                  <p className="mt-3 text-xl font-semibold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-[28px] border border-line/70 bg-white p-4 shadow-sm lg:p-5">
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateTask("magazine");
              }}
            >
              <div className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-4">
                <label htmlFor="task-prompt" className="sr-only">
                  任务输入
                </label>
                <textarea
                  id="task-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="开始新的任务会话吧"
                  className="min-h-[136px] w-full resize-none border-0 bg-transparent text-lg leading-8 text-ink outline-none placeholder:text-muted"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-muted">输入任务描述后，将进入工作台并模拟生成初版页级大纲。</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCreateTask("report")}
                    className="rounded-full border border-line bg-white px-5 py-3 text-sm font-medium text-ink transition hover:border-ink/20"
                  >
                    生成报告 / PPT
                  </button>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#202632] disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isGenerating ? "正在生成初版大纲..." : "生成月刊"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <QuickActionCard
          title="生成月刊"
          description="面向刊物型任务，先建立页级目录，再进入逐页确认的生成工作台。"
          badge="Monthly"
          onClick={() => void handleCreateTask("magazine", "请生成一期主题待补充的月刊")}
        />
        <QuickActionCard
          title="生成报告 / PPT"
          description="适合汇报型内容，先整理页级结构，再切换到候选页面与导出流程。"
          badge="Report"
          onClick={() => void handleCreateTask("report", "请生成一份主题待补充的报告 / PPT")}
        />
        <QuickActionCard
          title="从素材开始"
          description="从已有资料出发创建工作区，第一版先建立任务壳和后续素材导入口占位。"
          badge="Assets"
          onClick={() => void handleCreateTask("magazine", "我想基于已有素材整理一期品牌内容月刊")}
        />
      </section>
    </div>
  );
}
