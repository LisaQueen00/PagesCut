import { UserProvidedContentEditor } from "@/components/workspace/UserProvidedContentEditor";
import type { ExpressionMode, Page, SourceMode, UserProvidedContentBlock, WorkType } from "@/types/domain";

const sourceModeOptions: Array<{ value: SourceMode; label: string }> = [
  { value: "user", label: "用户提供" },
  { value: "system", label: "系统生成" },
];

const expressionModeOptions: Array<{ value: ExpressionMode; label: string }> = [
  { value: "text", label: "文本为主" },
  { value: "mixed-media", label: "图文结合" },
  { value: "chart", label: "图表为主" },
  { value: "hybrid", label: "混合" },
];

const workTypeOptions: Array<{ value: WorkType; label: string }> = [
  { value: "magazine", label: "刊物" },
  { value: "report", label: "报告 / PPT" },
];

function SegmentedField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="grid gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
              active ? "border-ink bg-ink text-white" : "border-line/70 bg-white text-ink hover:border-ink/20"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function StageOneDrawer({
  open,
  workType,
  page,
  pageLabel,
  savedLabel,
  onToggle,
  onWorkTypeChange,
  onPageChange,
  onRollStyle,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
  onSave,
}: {
  open: boolean;
  workType: WorkType;
  page: Page;
  pageLabel: string;
  savedLabel: string;
  onToggle: () => void;
  onWorkTypeChange: (value: WorkType) => void;
  onPageChange: (patch: Partial<Page>) => void;
  onRollStyle: () => void;
  onAddBlock: (type: Page["userProvidedContentBlocks"][number]["type"]) => void;
  onUpdateBlock: (blockId: string, patch: Partial<UserProvidedContentBlock>) => void;
  onRemoveBlock: (blockId: string) => void;
  onSave: () => void;
}) {
  return (
    <aside
      className={`overflow-hidden rounded-[24px] border border-line/70 bg-[#f8fafc] transition-all duration-200 ${
        open ? "p-4" : "p-3"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Stage 1 Drawer</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">一阶段设置</h2>
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
          <section className="sticky top-0 z-10 rounded-[20px] border border-line/70 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Global Settings</p>
            <h3 className="mt-2 text-base font-semibold text-ink">作品类型</h3>
            <div className="mt-4">
              <SegmentedField value={workType} onChange={onWorkTypeChange} options={workTypeOptions} />
            </div>
          </section>

          <section className="rounded-[20px] border border-line/70 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Current Page</p>
            <h3 className="mt-2 text-base font-semibold text-ink">当前页设置</h3>

            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-medium text-ink">内容来源</p>
                <div className="mt-3">
                  <SegmentedField value={page.sourceMode} onChange={(value) => onPageChange({ sourceMode: value })} options={sourceModeOptions} />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-ink">表达形式倾向</p>
                <div className="mt-3">
                  <SegmentedField
                    value={page.expressionMode}
                    onChange={(value) => onPageChange({ expressionMode: value })}
                    options={expressionModeOptions}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">风格描述</p>
                  <button
                    type="button"
                    onClick={onRollStyle}
                    className="rounded-full border border-line/70 bg-[#f8fafc] px-3 py-1.5 text-sm text-muted transition hover:text-ink"
                  >
                    骰子
                  </button>
                </div>
                <input
                  value={page.styleText}
                  onChange={(event) => onPageChange({ styleText: event.target.value })}
                  className="mt-3 w-full rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
                />
              </div>

              <div>
                <p className="text-sm font-medium text-ink">用户补充约束</p>
                <textarea
                  value={page.userConstraints}
                  onChange={(event) => onPageChange({ userConstraints: event.target.value })}
                  className="mt-3 min-h-[120px] w-full resize-none rounded-2xl border border-line/70 bg-[#fbfcfd] px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
                />
              </div>

              {page.sourceMode === "user" ? (
                <div className="rounded-[18px] border border-line/70 bg-[#fbfcfd] p-4">
                  <UserProvidedContentEditor
                    page={page}
                    onAddBlock={onAddBlock}
                    onUpdateBlock={onUpdateBlock}
                    onRemoveBlock={onRemoveBlock}
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted">{savedLabel}</span>
                <button
                  type="button"
                  onClick={onSave}
                  className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-[#202632]"
                >
                  保存
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <div className="rounded-[18px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">作品类型</p>
            <p className="mt-2 text-sm text-muted">{workType === "magazine" ? "刊物" : "报告 / PPT"}</p>
          </div>
          <div className="rounded-[18px] border border-line/70 bg-white p-4">
            <p className="text-sm font-medium text-ink">当前页</p>
            <p className="mt-2 text-sm text-muted">
              {pageLabel} · {page.pageType}
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}
