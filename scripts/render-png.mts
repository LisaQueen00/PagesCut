import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import opentype from "opentype.js";
import sharp from "sharp";
/**
 * ⚠️ 近似渲染器：本脚本是一个独立的手写 SVG 渲染器，用于在无浏览器环境里
 * 生成 PNG 预览。它是对产品 React 渲染器（PageModelRenderer）的近似还原，
 * 不是逐像素一致。以 full-pipeline.mts 的 HTML 输出与真实应用为准。
 *
 * 依赖：npm install -D sharp opentype.js，并在 scripts/ 下放置
 * NotoSansSC-Regular.ttf 与 NotoSansSC-Bold.ttf（见 scripts/README.md）。
 */
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
} from "../src/lib/realContent";
import type { Page } from "../src/types/domain";

/* ---------- 字体 ---------- */
const regular = opentype.parse(readFileSync("scripts/NotoSansSC-Regular.ttf") as unknown as ArrayBuffer);
const bold = opentype.parse(readFileSync("scripts/NotoSansSC-Bold.ttf") as unknown as ArrayBuffer);

function advance(text: string, size: number, weight: "regular" | "bold" = "regular") {
  return (weight === "bold" ? bold : regular).getAdvanceWidth(text, size);
}
function wrap(text: string, maxWidth: number, size: number, weight: "regular" | "bold" = "regular") {
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (advance(cur + ch, size, weight) > maxWidth) {
      if (cur) lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
function textEl(text: string, x: number, y: number, size: number, color: string, weight: "regular" | "bold" = "regular", opacity = 1) {
  const font = weight === "bold" ? bold : regular;
  const path = font.getPath(text, x, y, size);
  return `<path d="${path.toPathData(2)}" fill="${color}" ${opacity < 1 ? `fill-opacity="${opacity}"` : ""}/>`;
}

/* ---------- 主题色 ---------- */
const THEMES: Record<string, { accent: string; soft: string; border: string }> = {
  overview: { accent: "#2563eb", soft: "#eef4ff", border: "#dbe3ef" },
  data: { accent: "#0f766e", soft: "#ecf7f6", border: "#d5e7e5" },
  case: { accent: "#b45309", soft: "#fdf3e7", border: "#ead9c3" },
  summary: { accent: "#7c3aed", soft: "#f3effd", border: "#e2d9f5" },
};

const W = 920;
const H = 1301;
const PAD = 28;
const GAP = 16;

/* ---------- 卡片渲染 ---------- */
interface Card {
  x: number;
  y: number;
  w: number;
  h: number;
  svg: string;
}

function cardBg(x: number, y: number, w: number, h: number, fill: string, radius = 22) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}"/>`;
}

function cardTitle(x: number, y: number, title: string, accent: string, size = 12, letterSpace = 2) {
  // 小标题：加粗 + 拉字距
  const spaced = title;
  return textEl(spaced, x, y + size, size, accent, "bold");
}

function heroCard(t: { accent: string; soft: string }, x: number, y: number, w: number, h: number, eyebrow: string, title: string, summary: string): Card {
  let svg = cardBg(x, y, w, h, t.soft);
  const inner = 22;
  svg += textEl(eyebrow.toUpperCase(), x + inner, y + inner + 12, 11, "#6b7280", "bold");
  const titleLines = wrap(title, w - inner * 2, 30, "bold");
  let ty = y + inner + 48;
  for (const line of titleLines) {
    svg += textEl(line, x + inner, ty, 30, t.accent, "bold");
    ty += 38;
  }
  const summaryLines = wrap(summary, w - inner * 2, 16);
  ty += 8;
  for (const line of summaryLines.slice(0, 5)) {
    svg += textEl(line, x + inner, ty, 16, "#1f2937");
    ty += 27;
  }
  return { x, y, w, h, svg };
}

function titledCard(t: { accent: string; soft: string; border: string }, x: number, y: number, w: number, h: number, title: string, bodyLines: string[], bodySize = 14, bodyColor = "#374151"): Card {
  let svg = cardBg(x, y, w, h, "#ffffff");
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${t.border}"/>`;
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  let by = y + inner + 34;
  const lh = bodySize * 1.75;
  for (const line of bodyLines) {
    svg += textEl(line, x + inner, by, bodySize, bodyColor);
    by += lh;
  }
  return { x, y, w, h, svg };
}

function bulletCard(t: { accent: string; soft: string; border: string }, x: number, y: number, w: number, h: number, title: string, items: string[]): Card {
  let svg = cardBg(x, y, w, h, t.soft);
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  let by = y + inner + 34;
  for (const item of items) {
    const lines = wrap(item, w - inner * 2 - 16, 13);
    const lh = 13 * 1.7;
    svg += `<circle cx="${x + inner + 4}" cy="${by - 4}" r="3" fill="${t.accent}"/>`;
    for (const line of lines) {
      svg += textEl(line, x + inner + 16, by, 13, "#4b5563");
      by += lh;
    }
    by += 4;
  }
  return { x, y, w, h, svg };
}

function metricsCard(t: { accent: string; soft: string; border: string }, x: number, y: number, w: number, h: number, title: string, items: { label: string; value: string; detail: string }[]): Card {
  let svg = cardBg(x, y, w, h, "#ffffff");
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${t.border}"/>`;
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  const cols = items.length;
  const cw = (w - inner * 2) / cols;
  items.forEach((it, i) => {
    const cx = x + inner + i * cw;
    svg += textEl(it.value, cx, y + inner + 52, 22, t.accent, "bold");
    svg += textEl(it.label, cx, y + inner + 74, 11, "#6b7280");
    const dl = wrap(it.detail, cw - 4, 11);
    dl.slice(0, 3).forEach((line, li) => {
      svg += textEl(line, cx, y + inner + 96 + li * 17, 11, "#4b5563");
    });
  });
  return { x, y, w, h, svg };
}

function chartCard(t: { accent: string; soft: string; border: string }, x: number, y: number, w: number, h: number, title: string, series: { label: string; value: number }[]): Card {
  let svg = cardBg(x, y, w, h, "#ffffff");
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${t.border}"/>`;
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  const chartTop = y + inner + 40;
  const chartBottom = y + h - inner - 34;
  const chartH = chartBottom - chartTop;
  const max = Math.max(...series.map((s) => s.value), 1);
  const cols = series.length;
  const cw = (w - inner * 2) / cols;
  series.forEach((s, i) => {
    const cx = x + inner + i * cw + cw / 2;
    const bh = Math.max(24, (s.value / max) * (chartH - 40));
    const barW = Math.min(54, cw * 0.5);
    svg += `<rect x="${cx - barW / 2}" y="${chartBottom - bh}" width="${barW}" height="${bh}" rx="12" fill="${t.accent}" fill-opacity="0.9"/>`;
    svg += textEl(String(Math.round(s.value)), cx - advance(String(Math.round(s.value)), 13, "bold") / 2, chartBottom - bh - 8, 13, "#6b7280", "bold");
    const lbl = wrap(s.label, cw - 6, 12);
    lbl.forEach((line, li) => {
      svg += textEl(line, cx - advance(line, 12) / 2, chartBottom + 20 + li * 16, 12, "#374151");
    });
  });
  return { x, y, w, h, svg };
}

function tableCard(t: { accent: string; soft: string; border: string }, x: number, y: number, w: number, h: number, title: string, columns: string[], rows: string[][]): Card {
  let svg = cardBg(x, y, w, h, "#ffffff");
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${t.border}"/>`;
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  const tableTop = y + inner + 34;
  const cols = columns.length;
  const cw = (w - inner * 2) / cols;
  const rowH = 40;
  // header
  svg += `<rect x="${x + inner}" y="${tableTop}" width="${w - inner * 2}" height="${rowH}" rx="8" fill="${t.soft}"/>`;
  columns.forEach((c, i) => {
    svg += textEl(c, x + inner + i * cw + 12, tableTop + 26, 12, "#111827", "bold");
  });
  rows.forEach((row, ri) => {
    const ry = tableTop + rowH + ri * rowH;
    if (ri > 0) svg += `<line x1="${x + inner}" y1="${ry}" x2="${x + w - inner}" y2="${ry}" stroke="${t.border}"/>`;
    row.forEach((cell, ci) => {
      svg += textEl(cell, x + inner + ci * cw + 12, ry + 26, 12, "#374151");
    });
  });
  return { x, y, w, h, svg };
}

function visualCard(t: { accent: string; soft: string }, x: number, y: number, w: number, h: number, title: string, caption: string): Card {
  let svg = cardBg(x, y, w, h, "#ffffff");
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  const vh = h - inner * 2 - 40;
  svg += `<rect x="${x + inner}" y="${y + inner + 22}" width="${w - inner * 2}" height="${vh}" rx="18" fill="url(#grad-${x}-${y})"/>`;
  svg += `<defs><linearGradient id="grad-${x}-${y}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>`;
  svg += `<rect x="${x + inner + 14}" y="${y + inner + 36}" width="${w - inner * 2 - 28}" height="${vh - 28}" rx="14" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.5)"/>`;
  const capLines = wrap(caption, w - inner * 2, 13);
  capLines.slice(0, 2).forEach((line, li) => {
    svg += textEl(line, x + inner, y + h - inner + 6 + li * 20, 13, "#111827");
  });
  return { x, y, w, h, svg };
}

/* ---------- 布局辅助 ---------- */
function estH(lines: number[], size: number, hasTitle: boolean, extra = 0) {
  const lh = size * 1.75;
  const bodyH = lines.reduce((a, n) => a + n * lh, 0);
  return (hasTitle ? 40 : 18) + bodyH + extra;
}

function column(blocks: Card[], x: number, y0: number, w: number, maxH: number): Card[] {
  let y = y0;
  for (const b of blocks) {
    b.x = x;
    b.y = y;
    b.w = w;
    // clamp height
    b.h = Math.min(b.h, maxH - (y - y0));
    y += b.h + GAP;
  }
  return blocks;
}

/* ---------- 页面渲染 ---------- */
function renderPage(type: string, data: Record<string, any>): string {
  const theme = THEMES[type] ?? THEMES.overview;
  const contentW = W - PAD * 2;
  const mainW = Math.round(contentW * 0.56);
  const asideW = contentW - mainW - GAP;

  let cards: Card[] = [];
  const heroH = type === "data" ? 150 : type === "summary" ? 216 : type === "case" ? 150 : 246;
  if (type === "overview") {
    cards.push(heroCard(theme, PAD, PAD, contentW, heroH, "V1 · Overview", data.title, data.outline));
  } else if (type === "data") {
    cards.push(heroCard(theme, PAD, PAD, contentW, heroH, "V1 · Data", data.title, data.summary));
  } else if (type === "case") {
    cards.push(heroCard(theme, PAD, PAD, contentW, heroH, "V1 · Case", data.title, data.subject));
  } else if (type === "summary") {
    cards.push(heroCard(theme, PAD, PAD, contentW, heroH, "V1 · Summary", data.title, data.finalJudgment));
  }

  // 主体分栏
  const bodyTop = PAD + heroH + GAP;
  const bodyH = H - PAD - bodyTop;

  const mainCards: Card[] = [];
  const asideCards: Card[] = [];

  if (type === "overview") {
    const items = (data.signalItems ?? []).map((s: any) => ({ heading: s.heading, detail: s.detail }));
    mainCards.push(signalCard(theme, 0, 0, mainW, 0, "关键信号", items));
    const sp = (data.supportPoints ?? []).join("\n");
    mainCards.push(titledCard(theme, 0, 0, mainW, 0, "主题叙述", wrap(sp, mainW - 36, 14)));
    asideCards.push(titledCard(theme, 0, 0, asideW, 0, "读者价值", wrap(data.highlights?.[0] ?? data.openingNote, asideW - 36, 14)));
    asideCards.push(titledCard(theme, 0, 0, asideW, 0, "主题变化", wrap(data.openingNote, asideW - 36, 14)));
  } else if (type === "data") {
    mainCards.push(chartCard(theme, 0, 0, mainW, 0, data.chartTitle, data.chartSeries ?? []));
    mainCards.push(titledCard(theme, 0, 0, mainW, 0, "图表说明", wrap(data.chartSummary, mainW - 36, 14)));
    mainCards.push(tableCard(theme, 0, 0, mainW, 0, data.tableTitle, data.table.columns, data.table.rows));
    asideCards.push(metricsCard(theme, 0, 0, asideW, 0, "关键指标", data.metrics ?? []));
    asideCards.push(bulletCard(theme, 0, 0, asideW, 0, "读图提示", data.dataTakeaways ?? []));
    asideCards.push(titledCard(theme, 0, 0, asideW, 0, "来源 / 备注", wrap((data.sourceLines ?? []).join(" "), asideW - 36, 13)));
  } else if (type === "case") {
    mainCards.push(visualCard(theme, 0, 0, mainW, 0, "案例场景", data.visualCaption));
    mainCards.push(titledCard(theme, 0, 0, mainW, 0, "背景 / 问题", [...wrap(data.scenario, mainW - 36, 14), ...wrap(data.challenge, mainW - 36, 14)]));
    const steps = (data.actionSteps ?? []).map((s: string, i: number) => `${i + 1}. ${s}`);
    mainCards.push(bulletCard(theme, 0, 0, mainW, 0, "关键做法", steps));
    asideCards.push(titledCard(theme, 0, 0, asideW, 0, "结果 / 成效", wrap(data.resultSummary, asideW - 36, 14)));
    asideCards.push(metricsCard(theme, 0, 0, asideW, 0, "案例结果指标", data.outcomeMetrics ?? []));
    asideCards.push(bulletCard(theme, 0, 0, asideW, 0, "启示", [data.takeaway]));
  } else if (type === "summary") {
    const pts = (data.conclusionPoints ?? []).map((c: any) => `${c.heading}：${c.detail}`);
    mainCards.push(bulletCard(theme, 0, 0, mainW, 0, "判断余地", pts));
    asideCards.push(bulletCard(theme, 0, 0, asideW, 0, "读者带走", data.recommendations ?? []));
    asideCards.push(titledCard(theme, 0, 0, asideW, 0, "结束语", wrap(data.closingNote, asideW - 36, 14)));
    asideCards.push(titledCard(theme, 0, 0, asideW, 0, "后续观察", wrap(data.openingNote, asideW - 36, 14)));
  }

  // 按内容估算基准高度，再在列内等比分配剩余空间
  mainCards.forEach((b) => (b.h = b.h || 140));
  asideCards.forEach((b) => (b.h = b.h || 120));
  const layout = (blocks: Card[], maxH: number) => {
    const weights = blocks.map((b) => Math.max(1, Math.round(b.h || 1)));
    const total = weights.reduce((a, n) => a + n, 0);
    let y = 0;
    return blocks.map((b, i) => {
      const h = Math.max(60, Math.round((weights[i] / total) * (maxH - GAP * (blocks.length - 1))));
      const out = { ...b, y: y, h };
      y += h + GAP;
      return out;
    });
  };

  const laidMain = layout(mainCards, bodyH).map((b) => ({ ...b, x: PAD, y: bodyTop + b.y }));
  const laidAside = layout(asideCards, bodyH).map((b) => ({ ...b, x: PAD + mainW + GAP, y: bodyTop + b.y }));

  const all = [...cards, ...laidMain, ...laidAside];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  // 外框
  svg += `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="28" fill="none" stroke="${theme.border}"/>`;
  for (const c of all) svg += c.svg;
  svg += `</svg>`;
  return svg;
}

/* 其余 block 渲染器 */
function signalCard(t: { accent: string; soft: string; border: string }, x: number, y: number, w: number, h: number, title: string, items: { heading: string; detail: string }[]): Card {
  let svg = cardBg(x, y, w, h, "#ffffff");
  svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="none" stroke="${t.border}"/>`;
  const inner = 18;
  svg += cardTitle(x + inner, y + inner + 6, title, t.accent);
  let by = y + inner + 38;
  for (const it of items) {
    const head = `▍${it.heading}`;
    svg += textEl(head, x + inner, by, 13, t.accent, "bold");
    by += 22;
    const dl = wrap(it.detail, w - inner * 2, 13);
    for (const line of dl) {
      svg += textEl(line, x + inner, by, 13, "#4b5563");
      by += 21;
    }
    by += 8;
  }
  return { x, y, w, h, svg };
}

/* ---------- 主流程 ---------- */
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

mkdirSync("preview/png", { recursive: true });

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

  const pageModel = fillContractToPageModel(contract, 0);
  const type = pageModel.pageType;
  const data = contract as unknown as Record<string, any>;
  // feature 页型渲染为 overview，但标题用 page.pageType 更准确
  data.title = page.pageType;
  contracts.push({ index: page.index, type, title: page.pageType, data });
}

for (const c of contracts) {
  const svg = renderPage(c.type, c.data);
  const safe = c.title.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(`preview/png/${String(c.index).padStart(2, "0")}-${safe}.png`, png);
  console.log(`✓ ${String(c.index).padStart(2, "0")} [${c.type}] ${c.title} -> ${png.length} bytes`);
}

// 变体对比图：同一页 overview 的 3 个表达变体（数据一致，措辞不同）
console.log("\n生成 overview 3 变体对比图...");
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
const cellW = 340;
const cellH = Math.round(cellW * (H / W));
const labelH = 40;
const gap = 18;
const montageW = 3 * cellW + 4 * gap;
const montageH = labelH + cellH + 2 * gap;
const composites: sharp.OverlayOptions[] = [];
for (let i = 0; i < variantPngs.length; i++) {
  const resized = await sharp(variantPngs[i]).resize(cellW, cellH).png().toBuffer();
  composites.push({ input: resized, left: gap + i * (cellW + gap), top: labelH + gap });
}
const labels = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${montageW}" height="${labelH}">` +
    [0, 1, 2]
      .map((i) => {
        const x = gap + i * (cellW + gap);
        const lx = x + 8;
        return textEl(`变体 ${i + 1} · 表达不同，数据一致`, lx, 26, 20, "#14161b", "bold");
      })
      .join("") +
    `</svg>`,
);
const labeledLabels = await sharp(labels).png().toBuffer();
await sharp({ create: { width: montageW, height: montageH, channels: 4, background: { r: 232, g: 237, b: 243, alpha: 1 } } })
  .composite([{ input: labeledLabels, left: 0, top: 0 }, ...composites])
  .png()
  .toFile("preview/variant-comparison.png");
console.log(`✓ 变体对比图 -> preview/variant-comparison.png`);

console.log("\n完成。PNG 输出到 preview/png/ 与 preview/variant-comparison.png");
