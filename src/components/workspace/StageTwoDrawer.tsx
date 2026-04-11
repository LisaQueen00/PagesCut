import { useEffect, useState } from "react";
import { formatTime } from "@/lib/format";
import { hasValidApprovedTaskVersion, isValidTaskVersion } from "@/lib/versionValidation";
import type { Page, PageVersion, Task } from "@/types/domain";

export function StageTwoDrawer({
  open,
  task,
  page,
  pageLabel,
  contentPages,
  versions,
  selectedVersionId,
  onToggle,
  onSelectVersion,
  onApproveVersion,
  onRegenerate,
  onEnterPackaging,
  canEnterPackaging,
}: {
  open: boolean;
  task: Task;
  page: Page;
  pageLabel: string;
  contentPages: Page[];
  versions: PageVersion[];
  selectedVersionId: string;
  onToggle: () => void;
  onSelectVersion: (versionId: string) => void;
  onApproveVersion: (versionId: string) => void;
  onRegenerate: (promptNote: string) => void | Promise<void>;
  onEnterPackaging: () => void;
  canEnterPackaging: boolean;
}) {
  const [promptNote, setPromptNote] = useState("");
  const selectedVersion = versions.find((version) => version.id === selectedVersionId);
  const canRegenerate = promptNote.trim().length > 0;
  const selectedVersionValid = selectedVersion ? isValidTaskVersion(selectedVersion, contentPages) : false;
  const hasApprovedValidVersion = hasValidApprovedTaskVersion(versions, contentPages) && canEnterPackaging;

  useEffect(() => {
    setPromptNote("");
  }, [selectedVersionId]);

  return (
    <aside className={`rounded-[24px] border border-line/70 bg-[#f8fafc] transition-all duration-200 ${open ? "p-4" : "p-3"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 2 Drawer</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">版本与再生成</h2>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-line/80 bg-white px-3 py-2 text-sm text-muted transition hover:text-ink"
        >
          {open ? "收起" : "展开"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-4">
          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Current Context</p>
            <h3 className="mt-2 text-base font-semibold text-ink">当前整期方案备注</h3>
            <div className="mt-4 space-y-3 text-sm text-muted">
              <p>页面：{pageLabel} · {page.pageType}</p>
              <p>当前方案：{selectedVersion?.versionLabel ?? "-"}</p>
              <p>方案备注：{selectedVersion?.promptNote ?? "初版候选结果"}</p>
              <p>方案摘要：{selectedVersion?.variantSummary ?? "-"}</p>
              <p>风格：{page.styleText || "未设置"}</p>
              <p>作品类型：{task.workType === "magazine" ? "刊物" : "报告 / PPT"}</p>
              <p>来源：{selectedVersion?.derivedFromVersionId ? `基于 ${selectedVersion.derivedFromVersionId} 派生的整期方案` : "初始整期候选方案集"}</p>
            </div>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Versions</p>
                <h3 className="mt-2 text-base font-semibold text-ink">当前整期方案流</h3>
              </div>
              <span className="rounded-full bg-[#f3f5f8] px-3 py-1 text-xs text-muted">{versions.length} 个方案</span>
            </div>

            <div className="mt-4 space-y-3">
              {versions
                .slice()
                .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                .map((version) => {
                  const active = version.id === selectedVersionId;
                  return (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => onSelectVersion(version.id)}
                      className={`w-full rounded-[18px] border p-4 text-left transition ${
                        active ? "border-ink bg-[#fbfcff] shadow-sm" : "border-line/70 bg-white hover:border-ink/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{version.versionLabel}</p>
                          <p className="mt-1 text-xs text-muted">{formatTime(version.createdAt)}</p>
                        </div>
                        {version.isApproved ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">满意方案</span>
                        ) : active ? (
                          <span className="rounded-full bg-[#eef2f7] px-2.5 py-1 text-[11px] text-muted">当前预览</span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted">{version.variantSummary}</p>
                      <p className="mt-2 text-xs text-muted/90">{version.promptNote}</p>
                    </button>
                  );
                })}
            </div>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Regenerate</p>
            <h3 className="mt-2 text-base font-semibold text-ink">基于当前整期方案再生成</h3>
            <textarea
              value={promptNote}
              onChange={(event) => setPromptNote(event.target.value)}
              placeholder="补充新的整期方案调整提示词，例如：更偏杂志感、案例区更前置、加强结论区"
              className="mt-4 min-h-[132px] w-full resize-none rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
            />
            <p className="mt-3 text-xs text-muted">提示词不能为空。只有提供有效调整指令时，才允许生成新方案版本。</p>
            <button
              type="button"
              onClick={() => onRegenerate(promptNote)}
              disabled={!canRegenerate}
              className={`mt-4 w-full rounded-full px-5 py-3 text-sm font-medium text-white transition ${
                canRegenerate ? "bg-ink hover:bg-[#202632]" : "cursor-not-allowed bg-slate-300"
              }`}
            >
              基于当前方案再生成
            </button>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Selection</p>
            <h3 className="mt-2 text-base font-semibold text-ink">设为当前满意方案</h3>
            <p className="mt-2 text-sm leading-6 text-muted">
              将当前整期方案标记为 Stage 2 的满意结果。只有通过最小页面结构校验的合法方案，才能被设为满意方案。
            </p>
            <button
              type="button"
              onClick={() => onApproveVersion(selectedVersionId)}
              disabled={!selectedVersionValid}
              className={`mt-4 w-full rounded-full border px-5 py-3 text-sm font-medium transition ${
                selectedVersionValid
                  ? "border-line bg-white text-ink hover:border-ink/20"
                  : "cursor-not-allowed border-line/60 bg-slate-100 text-muted"
              }`}
            >
              设为当前满意方案
            </button>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Next Step</p>
            <h3 className="mt-2 text-base font-semibold text-ink">进入包装页生成阶段</h3>
            <p className="mt-2 text-sm leading-6 text-muted">只有存在合法满意方案时，才能进入包装页生成阶段。空版本、无效版本不会进入下一步流程。</p>
            <button
              type="button"
              onClick={onEnterPackaging}
              disabled={!hasApprovedValidVersion}
              className={`mt-4 w-full rounded-full border px-5 py-3 text-sm font-medium transition ${
                hasApprovedValidVersion
                  ? "border-line bg-white text-ink hover:border-ink/20"
                  : "cursor-not-allowed border-line/60 bg-slate-100 text-muted"
              }`}
            >
              进入包装页生成阶段
            </button>
          </section>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-[18px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">方案数量</p>
            <p className="mt-2 text-sm text-muted">{versions.length} 个</p>
          </div>
          <div className="rounded-[18px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">当前方案</p>
            <p className="mt-2 text-sm text-muted">{versions.find((version) => version.id === selectedVersionId)?.versionLabel ?? "-"}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
