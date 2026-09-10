import { writeFileSync, mkdirSync } from "node:fs";
import sharp from "sharp";
import { DeterministicGenerationProvider } from "../src/lib/deterministic";
import {
  createPageSourceSet,
  createOverviewOllamaTextFragments,
  createSummaryOllamaTextFragments,
  createDataOllamaTextFragments,
  createCaseOllamaTextFragments,
  createFeatureOllamaTextFragments,
} from "../src/lib/pageSources";
import { createPageIntent, createPageContentPlan, fillContractToPageModel } from "../src/lib/pageModel";
import {
  generateOverviewContractInput,
  generateSummaryContractInput,
  generateDataContractInput,
  generateCaseContractInput,
  generateCoverContent,
  generateTocContent,
} from "../src/lib/realContent";
import type { Page, Task } from "../src/types/domain";
import { renderPage, textEl, wrap, W, H } from "./render-png.mts";

/* ==================================================================== *
 * 完整成品展示：封面 + 目录 + 6 内容页 + 多版本对比，拼成一张全览海报
 * 主题：2024 年 AI 大模型落地情况（报告，至少 6 页）
 * ==================================================================== */

const provider = new DeterministicGenerationProvider();
const prompt = "请生成一份关于 2024 年 AI 大模型落地情况的报告，至少 6 页";

// 1) 大纲
const plan = await provider.generateOutlinePlan({ taskType: "report", prompt, normalizedInstruction: "", desiredPageCount: 6 }, { stage: "outline" });

// 2) 构造 Page（与 services/index.ts 的 buildTaskFromOutlinePlan 同构）
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

// 3) 逐页生成 PageModel → SVG
const contracts: { index: number; type: string; title: string; data: Record<string, any> }[] = [];

for (const page of pages) {
  const role = page.pageRole;
  const isData = page.pageType.includes("数据");
  const isCase = role === "case-study" || page.pageType.includes("案例");
  const isFeature = role === "feature" && !isData && !isCase;

  let fragments;
  if (role === "summary") fragments = createSummaryOllamaTextFragments(page, await provider.generateSummaryDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  else if (isData) fragments = createDataOllamaTextFragments(page, await provider.generateDataDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  else if (isCase) fragments = createCaseOllamaTextFragments(page, await provider.generateCaseDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  else if (isFeature) fragments = createFeatureOllamaTextFragments(page, await provider.generateFeatureDraft({ page, promptNote: "" }, { stage: "page-generation" }));
  else fragments = createOverviewOllamaTextFragments(page, await provider.generateOverviewDraft({ page, promptNote: "" }, { stage: "page-generation" }));

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

  fillContractToPageModel(contract, 0); // 触发类型校验（忽略返回值，renderPage 用 contract 原始数据）
  const data = contract as unknown as Record<string, any>;
  data.title = page.pageType;
  contracts.push({ index: page.index, type: contract.pageType, title: page.pageType, data });
}

// 4) 封面 + 目录（复用产品真实逻辑 generateCoverContent / generateTocContent）
const task: Task = {
  id: "task-x", projectId: "project-default", title: "AI 大模型落地", prompt,
  workType: "report", plannedPageCount: 6, hasGeneratedCoverPage: true, hasDerivedTocPage: true,
  packagingStageStatus: "approved", currentStage: "packaging", preferredExportFormat: "pdf",
  selectedPageId: pages[0].id, pageIds: pages.map((p) => p.id), status: "ready_for_export", createdAt: new Date().toISOString(),
};
const coverMetaPage: Page = { ...pages[0], pageRole: "cover", pageKind: "packaging", pageType: "封面", index: 0 };
const coverContent = generateCoverContent(task, coverMetaPage, pages, "初版封面候选");
const tocContent = generateTocContent(coverMetaPage, pages, "初版目录候选");

// 5) 渲染封面 / 目录
const coverSvg = renderCover(coverContent);
const tocSvg = renderToc(tocContent);

// 6) 输出：单页 PNG + 完整全览海报
mkdirSync("preview/final", { recursive: true });

const safe = (s: string) => s.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
const coverPng = await sharp(Buffer.from(coverSvg)).png().toBuffer();
const tocPng = await sharp(Buffer.from(tocSvg)).png().toBuffer();
writeFileSync("preview/final/00-封面.png", coverPng);
writeFileSync("preview/final/00-目录.png", tocPng);

const pagePngs: Buffer[] = [];
for (const c of contracts) {
  const png = await sharp(Buffer.from(renderPage(c.type, c.data))).png().toBuffer();
  writeFileSync(`preview/final/${String(c.index).padStart(2, "0")}-${safe(c.title)}.png`, png);
  pagePngs.push(png);
}

console.log(`✓ 封面 + 目录 + ${contracts.length} 内容页 -> preview/final/`);

// 7) 全览海报：封面 + 目录 + 6 页，3 列 x 3 行
const allPages = [coverPng, tocPng, ...pagePngs];
await makePoster(allPages, "preview/final/完整成品全览.png", 3, 3);

// 8) 变体对比（同一页 overview 3 个表达变体）
console.log("生成 3 变体对比图...");
const ovPage = pages[0];
const variantPngs: Buffer[] = [];
for (let v = 0; v < 3; v++) {
  const vpage = { ...ovPage, renderSeed: v };
  const draft = await provider.generateOverviewDraft({ page: vpage, promptNote: "" }, { stage: "page-generation" });
  const fragments = createOverviewOllamaTextFragments(vpage, draft);
  const sourceSet = createPageSourceSet(vpage, { generatedTextFragments: fragments });
  const pageIntent = createPageIntent(vpage)!;
  const contentPlan = createPageContentPlan(vpage, pageIntent, sourceSet);
  const contract = generateOverviewContractInput(vpage, `V${v + 1}`, pageIntent, contentPlan, sourceSet);
  const data = contract as unknown as Record<string, any>;
  data.title = ovPage.pageType;
  variantPngs.push(await sharp(Buffer.from(renderPage("overview", data))).png().toBuffer());
}
await makePoster(variantPngs, "preview/final/变体对比.png", 3, 1, ["表达变体 1 · 数据一致", "表达变体 2 · 数据一致", "表达变体 3 · 数据一致"]);

console.log("完成。成品在 preview/final/");

/* ---------------- 封面渲染 ---------------- */
function renderCover(content: ReturnType<typeof generateCoverContent>): string {
  const accent = "#14161b";
  const soft = "#eef1f6";
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="white"/>`;
  // 顶部装饰条
  svg += `<rect width="${W}" height="14" fill="${accent}"/>`;
  // kicker + issue label
  svg += textEl(content.kicker, 64, 130, 14, "#6b7280", "bold");
  svg += textEl(content.issueLabel, W - 64 - (content.issueLabel.length * 14), 130, 14, "#6b7280", "bold");
  // 主视觉：左侧大色块 + 标题
  svg += `<rect x="64" y="220" width="${W - 128}" height="520" rx="28" fill="${soft}"/>`;
  svg += `<circle cx="${W - 160}" cy="360" r="140" fill="none" stroke="#d7dde7" stroke-width="2"/>`;
  svg += `<circle cx="${W - 160}" cy="360" r="90" fill="none" stroke="#d7dde7" stroke-width="1.5"/>`;
  // 主标题（居中偏上，自动换行）
  const titleLines = wrap(content.title, W - 128 - 96, 48, "bold");
  let ty = 320;
  for (const line of titleLines) {
    svg += textEl(line, 108, ty, 48, accent, "bold");
    ty += 64;
  }
  // 副标题
  ty += 16;
  const subLines = wrap(content.subtitle, W - 128 - 96, 18);
  for (const line of subLines.slice(0, 3)) {
    svg += textEl(line, 108, ty, 18, "#4b5563");
    ty += 30;
  }
  // heroLabel
  const heroLines = wrap(content.heroLabel, W - 128 - 96, 15);
  ty += 14;
  for (const line of heroLines.slice(0, 2)) {
    svg += textEl(line, 108, ty, 15, "#6b7280");
    ty += 24;
  }
  // 底部 footer
  svg += `<line x1="64" y1="${H - 140}" x2="${W - 64}" y2="${H - 140}" stroke="#e2e8f0"/>`;
  svg += textEl(content.footerNote, 64, H - 96, 15, "#374151", "bold");
  svg += textEl(content.brandLabel, W - 64 - content.brandLabel.length * 13, H - 96, 13, "#6b7280");
  svg += `</svg>`;
  return svg;
}

/* ---------------- 目录渲染 ---------------- */
function renderToc(content: ReturnType<typeof generateTocContent>): string {
  const accent = "#14161b";
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="white"/>`;
  svg += `<rect width="${W}" height="14" fill="${accent}"/>`;
  svg += textEl(content.subtitle, 64, 110, 13, "#6b7280", "bold");
  const titleLines = wrap(content.title, W - 128, 40, "bold");
  let ty = 160;
  for (const line of titleLines) {
    svg += textEl(line, 64, ty, 40, accent, "bold");
    ty += 54;
  }
  // 条目列表
  ty += 40;
  content.tocEntries.forEach((entry, i) => {
    const num = String(i + 1).padStart(2, "0");
    svg += `<rect x="64" y="${ty - 34}" width="44" height="44" rx="12" fill="#f1f4f8"/>`;
    svg += textEl(num, 64 + 12, ty - 4, 16, accent, "bold");
    svg += textEl(entry, 128, ty, 18, "#1f2937", "bold");
    svg += `<line x1="64" y1="${ty + 14}" x2="${W - 64}" y2="${ty + 14}" stroke="#eef1f6"/>`;
    ty += 64;
  });
  // guidance note
  const guideLines = wrap(content.guidanceNote, W - 128, 13);
  ty += 30;
  svg += textEl("说明", 64, ty, 13, "#6b7280", "bold");
  ty += 24;
  for (const line of guideLines.slice(0, 2)) {
    svg += textEl(line, 64, ty, 13, "#9aa3b2");
    ty += 22;
  }
  svg += textEl(content.footerNote, 64, H - 96, 13, "#6b7280");
  svg += `</svg>`;
  return svg;
}

/* ---------------- 海报拼接 ---------------- */
async function makePoster(pngs: Buffer[], outPath: string, cols: number, rows: number, labels?: string[]) {
  const cellW = 320;
  const cellH = Math.round(cellW * (H / W));
  const gap = 20;
  const labelH = labels ? 46 : 0;
  const posterW = cols * cellW + (cols + 1) * gap;
  const posterH = labelH + rows * cellH + (rows + 1) * gap;

  const composites: sharp.OverlayOptions[] = [];
  let i = 0;
  for (const png of pngs) {
    const resized = await sharp(png).resize(cellW, cellH).png().toBuffer();
    const col = i % cols;
    const row = Math.floor(i / cols);
    composites.push({ input: resized, left: gap + col * (cellW + gap), top: labelH + gap + row * (cellH + gap) });
    i++;
  }

  if (labels) {
    const labelSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${posterW}" height="${labelH}">` +
        labels
          .map((label, li) => {
            const x = gap + li * (cellW + gap) + 10;
            return textEl(label, x, labelH - 18, 20, "#14161b", "bold");
          })
          .join("") +
        `</svg>`,
    );
    const labelPng = await sharp(labelSvg).png().toBuffer();
    composites.push({ input: labelPng, left: 0, top: 0 });
  }

  await sharp({ create: { width: posterW, height: posterH, channels: 4, background: { r: 232, g: 237, b: 243, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(outPath);
  console.log(`✓ ${outPath}`);
}
