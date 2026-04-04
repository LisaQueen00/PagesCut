import type { ExpressionMode, Page, UserProvidedBlockType, UserProvidedContentBlock } from "@/types/domain";

function filterBlocks<TType extends UserProvidedBlockType>(
  page: Page,
  type: TType,
): Extract<UserProvidedContentBlock, { type: TType }>[] {
  return page.userProvidedContentBlocks.filter((block) => block.type === type) as Extract<UserProvidedContentBlock, { type: TType }>[];
}

function TextBlockEditor({
  blocks,
  onAdd,
  onChangeText,
  onRemove,
}: {
  blocks: Extract<UserProvidedContentBlock, { type: "text" }>[];
  onAdd: () => void;
  onChangeText: (blockId: string, value: string) => void;
  onRemove: (blockId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">文本块</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={blocks.length >= 5}
          className="rounded-full border border-line/70 bg-[#f8fafc] px-3 py-1.5 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {blocks.length ? (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-[18px] border border-line/70 bg-[#fbfcfd] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">文本块 {index + 1}</p>
                <button type="button" onClick={() => onRemove(block.id)} className="text-sm text-muted transition hover:text-ink">
                  删除
                </button>
              </div>
              <textarea
                value={block.text}
                onChange={(event) => onChangeText(block.id, event.target.value)}
                placeholder="输入一段要放入当前页的文字内容"
                className="mt-3 min-h-[92px] w-full resize-none rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-line/70 bg-[#fbfcfd] px-4 py-4 text-sm text-muted">暂无文本块内容</div>
      )}
    </div>
  );
}

function ImageBlockEditor({
  blocks,
  onAdd,
  onPatch,
  onRemove,
}: {
  blocks: Extract<UserProvidedContentBlock, { type: "image" }>[];
  onAdd: () => void;
  onPatch: (blockId: string, patch: Partial<Extract<UserProvidedContentBlock, { type: "image" }>>) => void;
  onRemove: (blockId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">图片块</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={blocks.length >= 5}
          className="rounded-full border border-line/70 bg-[#f8fafc] px-3 py-1.5 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {blocks.length ? (
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <div key={block.id} className="rounded-[18px] border border-line/70 bg-[#fbfcfd] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">图片块 {index + 1}</p>
                <button type="button" onClick={() => onRemove(block.id)} className="text-sm text-muted transition hover:text-ink">
                  删除
                </button>
              </div>
              <div className="mt-3 space-y-3">
                <input
                  value={block.imageUrl}
                  onChange={(event) => onPatch(block.id, { imageUrl: event.target.value })}
                  placeholder="图片 URL / 上传结果占位"
                  className="w-full rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
                />
                <input
                  value={block.altText}
                  onChange={(event) => onPatch(block.id, { altText: event.target.value })}
                  placeholder="图片替代文本"
                  className="w-full rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
                />
                <textarea
                  value={block.caption}
                  onChange={(event) => onPatch(block.id, { caption: event.target.value })}
                  placeholder="图片说明 / 素材备注"
                  className="min-h-[92px] w-full resize-none rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-dashed border-line/70 bg-[#fbfcfd] px-4 py-4 text-sm text-muted">暂无图片块内容</div>
      )}
    </div>
  );
}

function ChartDescBlockEditor({
  blocks,
  onAdd,
  onPatch,
  onRemove,
}: {
  blocks: Extract<UserProvidedContentBlock, { type: "chart_desc" }>[];
  onAdd: () => void;
  onPatch: (blockId: string, patch: Partial<Extract<UserProvidedContentBlock, { type: "chart_desc" }>>) => void;
  onRemove: (blockId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">图表说明</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={blocks.length >= 1}
          className="rounded-full border border-line/70 bg-[#f8fafc] px-3 py-1.5 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {blocks.length ? (
        blocks.map((block) => (
          <div key={block.id} className="rounded-[18px] border border-line/70 bg-[#fbfcfd] p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">图表说明</p>
              <button type="button" onClick={() => onRemove(block.id)} className="text-sm text-muted transition hover:text-ink">
                删除
              </button>
            </div>
            <input
              value={block.chartTypeHint}
              onChange={(event) => onPatch(block.id, { chartTypeHint: event.target.value })}
              placeholder="图表类型提示，例如：bar / line / pie"
              className="mt-3 w-full rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ink/20"
            />
            <textarea
              value={block.description}
              onChange={(event) => onPatch(block.id, { description: event.target.value })}
              placeholder="描述图表想表达的结论、对比关系或趋势"
              className="mt-3 min-h-[96px] w-full resize-none rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
            />
          </div>
        ))
      ) : (
        <div className="rounded-[18px] border border-dashed border-line/70 bg-[#fbfcfd] px-4 py-4 text-sm text-muted">暂无图表说明</div>
      )}
    </div>
  );
}

function TableBlockEditor({
  blocks,
  onAdd,
  onPatch,
  onRemove,
}: {
  blocks: Extract<UserProvidedContentBlock, { type: "table" }>[];
  onAdd: () => void;
  onPatch: (blockId: string, patch: Partial<Extract<UserProvidedContentBlock, { type: "table" }>>) => void;
  onRemove: (blockId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">简单数据表</p>
        <button
          type="button"
          onClick={onAdd}
          disabled={blocks.length >= 1}
          className="rounded-full border border-line/70 bg-[#f8fafc] px-3 py-1.5 text-sm text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          添加
        </button>
      </div>

      {blocks.length ? (
        blocks.map((block) => (
          <div key={block.id} className="rounded-[18px] border border-line/70 bg-[#fbfcfd] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted">简单数据表</p>
                <p className="mt-1 text-xs text-muted">
                  当前解析列数：{(block.columns ?? []).length}，数据行：{(block.rows ?? []).length}
                </p>
              </div>
              <button type="button" onClick={() => onRemove(block.id)} className="text-sm text-muted transition hover:text-ink">
                删除
              </button>
            </div>
            <textarea
              value={block.rawInput}
              onChange={(event) => onPatch(block.id, { rawInput: event.target.value })}
              placeholder="使用 CSV 形式输入，例如：指标,数值"
              className="mt-3 min-h-[120px] w-full resize-none rounded-2xl border border-line/70 bg-white px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-ink/20"
            />
          </div>
        ))
      ) : (
        <div className="rounded-[18px] border border-dashed border-line/70 bg-[#fbfcfd] px-4 py-4 text-sm text-muted">暂无数据表内容</div>
      )}
    </div>
  );
}

function getAllowedTypes(expressionMode: ExpressionMode): UserProvidedBlockType[] {
  if (expressionMode === "text") {
    return ["text"];
  }

  if (expressionMode === "mixed-media") {
    return ["text", "image"];
  }

  if (expressionMode === "chart") {
    return ["chart_desc", "table"];
  }

  return ["text", "image", "chart_desc", "table"];
}

export function UserProvidedContentEditor({
  page,
  onAddBlock,
  onUpdateBlock,
  onRemoveBlock,
}: {
  page: Page;
  onAddBlock: (type: UserProvidedBlockType) => void;
  onUpdateBlock: (blockId: string, patch: Partial<UserProvidedContentBlock>) => void;
  onRemoveBlock: (blockId: string) => void;
}) {
  const allowedTypes = getAllowedTypes(page.expressionMode);
  const textBlocks = filterBlocks(page, "text");
  const imageBlocks = filterBlocks(page, "image");
  const chartDescBlocks = filterBlocks(page, "chart_desc");
  const tableBlocks = filterBlocks(page, "table");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">用户提供内容</p>
        <p className="mt-1 text-sm leading-6 text-muted">内容块已按类型拆分存储，当前 UI 仍保持轻量输入形态。</p>
      </div>

      {allowedTypes.includes("text") ? (
        <TextBlockEditor
          blocks={textBlocks}
          onAdd={() => onAddBlock("text")}
          onChangeText={(blockId, value) => onUpdateBlock(blockId, { text: value })}
          onRemove={onRemoveBlock}
        />
      ) : null}

      {allowedTypes.includes("image") ? (
        <ImageBlockEditor
          blocks={imageBlocks}
          onAdd={() => onAddBlock("image")}
          onPatch={onUpdateBlock}
          onRemove={onRemoveBlock}
        />
      ) : null}

      {allowedTypes.includes("chart_desc") ? (
        <ChartDescBlockEditor
          blocks={chartDescBlocks}
          onAdd={() => onAddBlock("chart_desc")}
          onPatch={onUpdateBlock}
          onRemove={onRemoveBlock}
        />
      ) : null}

      {allowedTypes.includes("table") ? (
        <TableBlockEditor
          blocks={tableBlocks}
          onAdd={() => onAddBlock("table")}
          onPatch={onUpdateBlock}
          onRemove={onRemoveBlock}
        />
      ) : null}
    </div>
  );
}
