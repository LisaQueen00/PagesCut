import { formatTime } from "@/lib/format";
import { useAppStore } from "@/store/appStore";

export function AssetsPage() {
  const assets = useAppStore((state) => state.assets);

  return (
    <div className="rounded-[28px] bg-transparent p-2">
      <section className="rounded-[32px] border border-line/70 bg-white px-6 py-6 shadow-panel">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted">Assets</p>
            <h2 className="mt-2 text-3xl font-semibold text-ink">最终产物列表</h2>
          </div>
          <span className="rounded-full bg-[#f3f5f8] px-4 py-2 text-sm text-muted">{assets.length} items</span>
        </div>

        <div className="mt-6 grid gap-4">
          {assets.map((asset) => (
            <article key={asset.id} className="rounded-[24px] border border-line/70 bg-[#f8fafc] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-ink">{asset.fileName}</h3>
                  <p className="mt-2 text-sm text-muted">
                    {asset.workType === "magazine" ? "刊物 / PDF" : "报告 / PPT"} · {formatTime(asset.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-white px-3 py-2 text-sm text-muted">
                    {asset.status === "completed" ? "已完成" : asset.status === "processing" ? "转换中" : "失败"}
                  </span>
                  <a
                    href={asset.downloadUrl}
                    className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
                  >
                    下载占位
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
