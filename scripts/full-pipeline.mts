import { writeFileSync, mkdirSync } from "node:fs";
import { DeterministicGenerationProvider } from "../src/lib/deterministic";
import {
  createPageSourceSet,
  createOverviewOllamaTextFragments,
  createSummaryOllamaTextFragments,
  createDataOllamaTextFragments,
  createCaseOllamaTextFragments,
  createFeatureOllamaTextFragments,
} from "../src/lib/pageSources";
import { createPageIntent, createPageContentPlan, fillContractToPageModel, renderPageModelToHtml } from "../src/lib/pageModel";
import {
  generateOverviewContractInput,
  generateSummaryContractInput,
  generateDataContractInput,
  generateCaseContractInput,
} from "../src/lib/realContent";
import type { Page } from "../src/types/domain";

const provider = new DeterministicGenerationProvider();
const prompt = "请生成一份关于 2024 年 AI 大模型落地情况的报告，至少 6 页";
const plan = await provider.generateOutlinePlan({ taskType: "report", prompt, normalizedInstruction: "", desiredPageCount: 6 }, { stage: "outline" });

const pages: Page[] = plan.pages.map((p, i) => ({
  id: `page-${i + 1}`,
  taskId: "task-x",
  index: i + 1,
  renderSeed: 0,
  pageKind: "content" as const,
  pageRole: (p.suggestedPageRole === "data" ? "feature" : p.suggestedPageRole === "case-study" ? "case-study" : p.suggestedPageRole) as Page["pageRole"],
  pageType: p.title,
  outlineText: p.outlineText,
  sourceMode: "system" as const,
  expressionMode: p.expressionMode,
  styleText: p.styleText,
  userConstraints: p.userConstraints,
  isConfirmed: false,
  isSaved: false,
  userProvidedContentBlocks: [],
  coverMeta: null,
}));

for (const p of plan.pages) {
  const page = pages.find((pg) => pg.pageType === p.title)!;
  if (p.suggestedPageRole === "data" && p.tableData) {
    page.userProvidedContentBlocks = [
      { id: "b1", type: "text", text: p.sourceNeeds || "" },
      { id: "b2", type: "chart_desc", description: p.chartHint || p.sourceNeeds || "", chartTypeHint: "bar" },
      { id: "b3", type: "table", rawInput: "", columns: p.tableData.columns, rows: p.tableData.rows },
    ];
  } else if (p.suggestedPageRole === "case-study") {
    page.userProvidedContentBlocks = [
      { id: "b1", type: "image", imageUrl: "", altText: p.visualCaption || "", caption: p.visualCaption || "" },
      { id: "b2", type: "text", text: p.sourceNeeds || "" },
    ];
  }
}

const results: { index: number; role: string; title: string; html: string }[] = [];

for (const page of pages) {
  const role = page.pageRole;
  const isData = page.pageType.includes("数据");
  const isCase = role === "case-study" || page.pageType.includes("案例");
  const isFeature = role === "feature" && !isData && !isCase;

  let fragments;
  if (role === "summary") {
    fragments = createSummaryOllamaTextFragments(page, await provider.generateSummaryDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  } else if (isData) {
    fragments = createDataOllamaTextFragments(page, await provider.generateDataDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  } else if (isCase) {
    fragments = createCaseOllamaTextFragments(page, await provider.generateCaseDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  } else if (isFeature) {
    fragments = createFeatureOllamaTextFragments(page, await provider.generateFeatureDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  } else {
    fragments = createOverviewOllamaTextFragments(page, await provider.generateOverviewDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  }

  const sourceSet = createPageSourceSet(page, { generatedTextFragments: fragments });
  const pageIntent = createPageIntent(page);
  if (!pageIntent) continue;
  const contentPlan = createPageContentPlan(page, pageIntent, sourceSet);

  let contract;
  if (isCase) contract = generateCaseContractInput(page, "V1", pageIntent, contentPlan, sourceSet);
  else if (isData) contract = generateDataContractInput(page, "V1", pageIntent, contentPlan, sourceSet);
  else if (role === "summary") contract = generateSummaryContractInput(page, "V1", pageIntent, contentPlan, sourceSet);
  else contract = generateOverviewContractInput(page, "V1", pageIntent, contentPlan, sourceSet);

  if (!contract) continue;
  const pageModel = fillContractToPageModel(contract, 0);
  results.push({ index: page.index, role: pageModel.pageType, title: page.pageType, html: renderPageModelToHtml(pageModel) });
}

mkdirSync("preview", { recursive: true });
const scale = 0.66;
for (const r of results) {
  writeFileSync(`preview/${String(r.index).padStart(2, "0")}-${sanitize(r.title)}.html`, wrap(r, results, scale));
}

// 合集索引页
const links = results
  .map((r) => `<a class="card" href="${String(r.index).padStart(2, "0")}-${sanitize(r.title)}.html"><span class="idx">${r.index}</span><span class="tt">${r.title}</span><span class="role">${r.role}</span></a>`)
  .join("");
const index = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>PagesCut 确定性引擎 · 示例报告预览</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef1f6;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif;color:#14161b;padding:48px 24px}
h1{font-size:26px;margin:0 0 4px}h1 .tag{font-size:12px;background:#14161b;color:#fff;border-radius:999px;padding:3px 10px;vertical-align:middle;margin-left:10px;letter-spacing:.05em}
p.sub{color:#6b7280;margin:0 0 28px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;max-width:1100px}
.card{display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;text-decoration:none;color:inherit;transition:transform .12s,box-shadow .12s}
.card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(15,23,42,.1)}
.idx{width:26px;height:26px;border-radius:8px;background:#14161b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700}
.tt{font-size:15px;font-weight:600}
.role{font-size:12px;color:#9aa3b2;text-transform:uppercase;letter-spacing:.06em}
</style></head><body>
<h1>PagesCut 确定性内容引擎 <span class="tag">Demo</span></h1>
<p class="sub">主题：「请生成一份关于 2024 年 AI 大模型落地情况的报告，至少 6 页」 · 无外部 LLM · 全部内容由确定性引擎生成</p>
<div class="grid">${links}</div>
</body></html>`;
writeFileSync("preview/index.html", index);
console.log(`\n共生成 ${results.length} 个页面预览 + index.html -> preview/`);

function sanitize(s: string) { return s.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""); }

function wrap(r: (typeof results)[number], all: typeof results, scale: number) {
  const nav = all.map((x) => `<a href="${String(x.index).padStart(2, "0")}-${sanitize(x.title)}.html" style="${x.index === r.index ? "background:#14161b;color:#fff" : "background:#fff;color:#14161b"};display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;border:1px solid #e2e8f0;text-decoration:none;font-size:13px;font-weight:700">${x.index}</a>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${r.title}</title>
<style>body{margin:0;background:#e8edf3;font-family:-apple-system,"PingFang SC","Noto Sans SC",sans-serif}.bar{position:sticky;top:0;display:flex;gap:8px;align-items:center;padding:14px 24px;background:rgba(238,241,246,.92);backdrop-filter:blur(6px);border-bottom:1px solid #e2e8f0;z-index:10}.bar .tt{font-weight:600;font-size:14px;margin-left:8px}.stage{display:flex;justify-content:center;padding:40px 16px}.page{transform:scale(${scale});transform-origin:top center;box-shadow:0 24px 60px rgba(15,23,42,.2);border-radius:28px}.scalewrap{width:${Math.round(920 * scale)}px;height:${Math.round(1301 * scale)}px;overflow:hidden}</style></head>
<body><div class="bar"><a href="index.html" style="font-size:13px;color:#14161b">← 目录</a>${nav}<span class="tt">${r.index} · ${r.title}</span></div>
<div class="stage"><div class="scalewrap"><div class="page">${r.html}</div></div></div></body></html>`;
}
