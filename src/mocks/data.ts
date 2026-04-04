import type { Asset, Page, PageVersion, Project, Task, WorkType } from "@/types/domain";

interface SeedTaskResult {
  project: Project;
  task: Task;
  pages: Page[];
  pageVersions: PageVersion[];
  assets: Asset[];
}

interface MockSeedOptions {
  mockPageCount?: number;
}

interface MockPageBlueprint {
  pageKind: Page["pageKind"];
  pageRole: Page["pageRole"];
  pageType: string;
  outlineText: string;
  sourceMode: Page["sourceMode"];
  expressionMode: Page["expressionMode"];
  styleText: string;
  userConstraints: string;
  userProvidedContentBlocks: Page["userProvidedContentBlocks"];
  coverMeta: Page["coverMeta"];
}

// This list is intentionally a mock example set for UI validation only.
// It is not the real product rule for page count, nor the final page structure.
const MOCK_INITIAL_PAGE_BLUEPRINTS: MockPageBlueprint[] = [
  {
    pageKind: "content",
    pageRole: "overview",
    pageType: "趋势综述",
    outlineText: "总结本月重要模型发布、应用落地与行业资本动态，形成概览页。",
    sourceMode: "system",
    expressionMode: "text",
    styleText: "信息密度高但排版克制",
    userConstraints: "控制在 3 个核心观点内。",
    userProvidedContentBlocks: [],
    coverMeta: null,
  },
  {
    pageKind: "content",
    pageRole: "case-study",
    pageType: "案例页",
    outlineText: "选取 2 个 AI 商业化案例，突出场景、收益与可复用启示。",
    sourceMode: "user",
    expressionMode: "hybrid",
    styleText: "图文结合，强调案例块结构",
    userConstraints: "保留一个图表区域。",
    userProvidedContentBlocks: [
      {
        id: createId("block"),
        type: "text",
        text: "案例 1：企业内部知识库助手上线后，检索效率提升。",
      },
      {
        id: createId("block"),
        type: "image",
        imageUrl: "",
        altText: "案例配图占位",
        caption: "这里后续可替换成真实图片上传结果。",
      },
      {
        id: createId("block"),
        type: "chart_desc",
        description: "希望展示两个案例的投入产出对比。",
        chartTypeHint: "bar",
      },
      {
        id: createId("block"),
        type: "table",
        rawInput: "指标,案例A,案例B\n上线周期,2周,3周\n效率提升,35%,28%",
        columns: ["指标", "案例A", "案例B"],
        rows: [
          ["上线周期", "2周", "3周"],
          ["效率提升", "35%", "28%"],
        ],
      },
    ],
    coverMeta: null,
  },
  {
    pageKind: "content",
    pageRole: "feature",
    pageType: "专题拆解",
    outlineText: "围绕一个重点议题做更深入的结构化拆解，形成专题说明页。",
    sourceMode: "system",
    expressionMode: "mixed-media",
    styleText: "专题化、重点突出",
    userConstraints: "需要保留一块关键信息框。",
    userProvidedContentBlocks: [],
    coverMeta: null,
  },
  {
    pageKind: "content",
    pageRole: "summary",
    pageType: "结语页",
    outlineText: "总结全刊重点，并给出面向读者的收尾观点与后续关注方向。",
    sourceMode: "system",
    expressionMode: "text",
    styleText: "简洁、有收束感",
    userConstraints: "语气克制，避免口号式结尾。",
    userProvidedContentBlocks: [],
    coverMeta: null,
  },
];

const MOCK_DEFERRED_PAGE_BLUEPRINTS: MockPageBlueprint[] = [
  {
    pageKind: "packaging",
    pageRole: "cover",
    pageType: "封面页",
    outlineText: "",
    sourceMode: "system",
    expressionMode: "mixed-media",
    styleText: "冷静、专业、科技感留白",
    userConstraints: "封面页属于包装页，不纳入内容大纲覆盖范围。",
    userProvidedContentBlocks: [],
    coverMeta: {
      title: "AI 产业趋势月刊",
      subtitle: "聚焦模型发布、应用落地与商业化信号",
      issueLabel: "2026 / 04",
      heroLabel: "本期主题：生成式产品进入结构化落地阶段",
      brandLabel: "PagesCut Research",
      kicker: "Monthly Brief",
    },
  },
  {
    pageKind: "packaging",
    pageRole: "toc",
    pageType: "目录页",
    outlineText: "",
    sourceMode: "system",
    expressionMode: "text",
    styleText: "结构清晰、目录层级明确",
    userConstraints: "目录页在内容结构和标题稳定后生成。",
    userProvidedContentBlocks: [],
    coverMeta: null,
  },
];

export const DEFAULT_MOCK_PAGE_COUNT = 3;
const INITIAL_MOCK_VERSION_COUNT = 3;

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

const variantLeadTexts = [
  [
    "本版先把最重要的判断与摘要放到最上方，让读者在进入正文前先完成一轮快速理解。",
    "页面开头直接给出概括性观点和主标题摘要，更适合刊物开篇或趋势综述场景。",
    "阅读路径从标题到摘要再到支撑块，整体节奏更稳、更像一页完整的刊物正文。",
  ],
  [
    "本版把具体案例区域抬到更靠前的位置，让读者先通过场景理解页面主题，再回看抽象判断。",
    "页面主视觉与案例内容合并为主体内容区，适合把真实使用片段作为阅读入口。",
    "阅读路径先进入图文案例，再回到摘要和数据块，整体更像专题案例展开页。",
  ],
  [
    "本版先让读者看到结论与重点判断，再通过较短的支撑块补全上下文，适合快速浏览。",
    "页面采用更强的结果导向结构，把核心结论、关键数字和可带走观点放在最显眼的位置。",
    "阅读路径更短，读者第一眼就能抓住落点，然后再选择是否继续查看细节。",
  ],
];

const variantSectionSets = [
  ["本页摘要", "延展信息", "结论提示"],
  ["案例主区", "案例说明", "配套数据"],
  ["核心结论", "支撑要点", "关键数字"],
];

const variantCardBodies = [
  [
    "这一版把摘要块做成页面主视觉，正文模块退到辅助位置，帮助读者先建立整体理解。",
    "中段信息块更像对摘要的支撑说明，适合承载二级观点和补充背景。",
    "结尾落在一个收束明确的结论块上，使页面完成度更高。",
  ],
  [
    "案例内容区被放大处理，页面第一眼会先进入具体场景与图文块，而不是抽象概括。",
    "中部采用案例卡片和数据辅助区并列的方式，让案例叙述成为主线。",
    "结尾保留一个较短的案例启示区，作为页面收束。",
  ],
  [
    "页面顶部直接给出可以被带走的判断，减少前置铺垫，适合读者快速扫读。",
    "中段只保留最必要的支撑信息块，把阅读负担压到最低。",
    "结论区被再次放大，强化页面最后的观点记忆点。",
  ],
];

const variantChartCaptions = ["摘要数据", "案例数据", "关键指标"];
const variantImageCaptions = ["版面主视觉", "案例主图", "结果对照"];
const variantSummaries = [
  "摘要优先版：标题和摘要区更突出，阅读路径更稳",
  "案例展开版：案例区更靠前，图文主体感更强",
  "结论强化版：结论区更突出，适合快速浏览抓重点",
];

function getVariantFamily(variant: number) {
  return variant % INITIAL_MOCK_VERSION_COUNT;
}

export function getMockVersionStrategySummary(family: number) {
  return variantSummaries[family] ?? variantSummaries[0];
}

function renderSummaryFirstLayout(params: {
  page: Page;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  titleVariant: string[];
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
  imageCaption: string;
  chartCaption: string;
  headlineSuffix: string;
}) {
  const { page, palette, versionLabel, titleVariant, leadText, chosenTitles, cardBodies, imageCaption, chartCaption, headlineSuffix } = params;
  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <header style="display:grid;grid-template-columns:minmax(0,1.45fr) 280px;gap:18px;align-items:stretch;">
        <div style="border-radius:24px;background:${palette.soft};padding:24px;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${titleVariant[0]}</div>
          <h1 style="margin:12px 0 0;font-size:32px;line-height:1.18;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
          <p style="margin:14px 0 0;font-size:16px;line-height:1.9;color:#1f2937;">${leadText}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="display:flex;justify-content:flex-end;"><div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div></div>
          <div style="flex:1;border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${imageCaption}</div>
            <div style="margin-top:14px;height:100%;min-height:154px;border-radius:18px;background:linear-gradient(140deg, ${palette.soft} 0%, white 100%);display:flex;align-items:flex-end;padding:16px;">
              <p style="margin:0;font-size:14px;line-height:1.8;color:#374151;">${headlineSuffix}</p>
            </div>
          </div>
        </div>
      </header>
      <section style="margin-top:18px;display:grid;grid-template-columns:1.2fr 0.8fr;gap:14px;">
        <div style="border-radius:22px;border:1px solid ${palette.border};padding:20px;background:white;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[1]}</div>
          <p style="margin:12px 0 0;font-size:15px;line-height:1.9;color:#4b5563;">${page.outlineText}</p>
        </div>
        <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:${palette.soft};">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chartCaption}</div>
          <div style="margin-top:14px;height:112px;border-radius:16px;background:white;display:flex;align-items:flex-end;justify-content:center;gap:10px;padding:14px;">
            <div style="width:22%;height:56%;background:${palette.accent};border-radius:10px;opacity:0.92;"></div>
            <div style="width:22%;height:80%;background:${palette.accent};border-radius:10px;opacity:0.82;"></div>
            <div style="width:22%;height:66%;background:${palette.accent};border-radius:10px;opacity:0.72;"></div>
          </div>
        </div>
      </section>
      <section style="margin-top:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">
        ${cardBodies
          .map(
            (body, index) => `
          <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:${index === 2 ? palette.soft : "white"};">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${index === 2 ? chosenTitles[2] : titleVariant[index + 1]}</div>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${body}</p>
          </div>
        `,
          )
          .join("")}
      </section>
    </article>
  `;
}

function renderCoverPreviewLayout(params: {
  page: Page;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  variant: number;
  family: number;
}) {
  const { page, palette, versionLabel, variant, family } = params;
  const coverMeta = page.coverMeta ?? {
    title: "PagesCut",
    subtitle: "Page-based generation workspace",
    issueLabel: "Issue",
    heroLabel: "封面主视觉占位",
    brandLabel: "PagesCut",
    kicker: "Cover",
  };
  const coverHeroNotes = [
    "主视觉偏冷静留白，强调标题识别和主题入口。",
    "主视觉偏图文聚焦，强调封面信息与主题场景联动。",
    "主视觉偏结果导向，强调结论感和第一眼识别强度。",
  ];
  const coverNote = coverHeroNotes[(variant + family) % coverHeroNotes.length];

  if (family === 1) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <div style="display:grid;grid-template-columns:1.05fr 0.95fr;gap:18px;height:100%;">
          <section style="border-radius:24px;background:${palette.accent};padding:24px;color:white;display:flex;flex-direction:column;justify-content:space-between;min-height:580px;">
            <div>
              <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.76;">${coverMeta.kicker}</div>
              <h1 style="margin:18px 0 0;font-size:42px;line-height:1.08;font-weight:700;">${coverMeta.title}</h1>
              <p style="margin:18px 0 0;font-size:17px;line-height:1.9;opacity:0.9;">${coverMeta.subtitle}</p>
            </div>
            <div style="padding-top:18px;border-top:1px solid rgba(255,255,255,0.14);">
              <p style="margin:0;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.72;">${coverMeta.issueLabel}</p>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.9;opacity:0.9;">${coverMeta.heroLabel}</p>
            </div>
          </section>
          <section style="display:grid;grid-template-rows:1fr auto;gap:18px;">
            <div style="border-radius:24px;background:linear-gradient(145deg, ${palette.soft} 0%, white 100%);border:1px solid ${palette.border};padding:24px;display:flex;align-items:flex-end;">
              <div>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">主视觉区域</div>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.85;color:#4b5563;">${coverMeta.heroLabel}</p>
              </div>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
              <div>
                <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${coverMeta.brandLabel}</p>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.8;color:#4b5563;">${coverNote}</p>
              </div>
              <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
            </div>
          </section>
        </div>
      </article>
    `;
  }

  if (family === 2) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#6b7280;">${coverMeta.kicker}</div>
            <h1 style="margin:16px 0 0;font-size:40px;line-height:1.08;font-weight:700;color:${palette.accent};">${coverMeta.title}</h1>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.85;color:#4b5563;">${coverMeta.subtitle}</p>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
        </header>
        <section style="margin-top:22px;display:grid;grid-template-columns:1.2fr 0.8fr;gap:16px;">
          <div style="border-radius:24px;background:linear-gradient(145deg, ${palette.soft} 0%, white 100%);border:1px solid ${palette.border};padding:24px;min-height:360px;display:flex;align-items:flex-end;">
            <div>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">案例式主视觉</div>
              <p style="margin:12px 0 0;font-size:18px;line-height:1.8;color:#374151;">${coverMeta.heroLabel}</p>
            </div>
          </div>
          <div style="display:grid;grid-template-rows:auto 1fr;gap:14px;">
            <div style="border-radius:22px;background:${palette.soft};padding:18px;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">期次信息</div>
              <p style="margin:10px 0 0;font-size:15px;line-height:1.8;color:#374151;">${coverMeta.issueLabel}</p>
            </div>
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">品牌信息</div>
                <p style="margin:10px 0 0;font-size:15px;line-height:1.8;color:#374151;">${coverMeta.brandLabel}</p>
              </div>
              <p style="margin:18px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${coverNote}</p>
            </div>
          </div>
        </section>
      </article>
    `;
  }

  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <div style="display:grid;grid-template-columns:0.88fr 1.12fr;gap:18px;align-items:stretch;height:100%;">
        <section style="border-radius:24px;background:${palette.soft};padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#6b7280;">${coverMeta.issueLabel}</div>
            <h1 style="margin:16px 0 0;font-size:38px;line-height:1.08;font-weight:700;color:${palette.accent};">${coverMeta.title}</h1>
            <p style="margin:16px 0 0;font-size:15px;line-height:1.85;color:#374151;">${coverMeta.subtitle}</p>
          </div>
          <div style="padding-top:16px;border-top:1px solid ${palette.border};">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${coverMeta.brandLabel}</div>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${coverNote}</p>
          </div>
        </section>
        <section style="display:grid;grid-template-rows:auto 1fr auto;gap:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">Cover Direction</div>
              <p style="margin:8px 0 0;font-size:15px;line-height:1.8;color:#4b5563;">${coverMeta.kicker}</p>
            </div>
            <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
          </div>
          <div style="border-radius:24px;border:1px solid ${palette.border};background:linear-gradient(145deg, white 0%, ${palette.soft} 100%);padding:24px;display:flex;align-items:flex-end;min-height:380px;">
            <div>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">结论导向主视觉</div>
              <p style="margin:12px 0 0;font-size:20px;line-height:1.75;color:${palette.accent};font-weight:600;">${coverMeta.heroLabel}</p>
            </div>
          </div>
          <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">少量引导文案：${coverMeta.subtitle}</p>
        </section>
      </div>
    </article>
  `;
}

function renderTocPreviewLayout(params: {
  page: Page;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  variant: number;
  family: number;
  contentPages: Page[];
}) {
  const { page, palette, versionLabel, variant, family, contentPages } = params;
  const entries = contentPages.map((contentPage, index) => ({
    order: index + 1,
    title: contentPage.pageType,
    subtitle:
      contentPage.outlineText.length > 28 ? `${contentPage.outlineText.slice(0, 28)}...` : contentPage.outlineText || "待补充目录说明",
  }));
  const layoutHints = [
    "层级式目录：突出页序和主题名称。",
    "分组式目录：强调主题分组和阅读入口。",
    "结果导向目录：突出最后可带走的重点线索。",
  ];
  const hint = layoutHints[(variant + family) % layoutHints.length];

  if (family === 1) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">目录结构</div>
            <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.8;color:#4b5563;">${hint}</p>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
        </header>
        <section style="margin-top:20px;display:grid;grid-template-columns:1.1fr 0.9fr;gap:16px;">
          <div style="display:grid;gap:12px;">
            ${entries
              .map(
                (entry) => `
              <div style="border-radius:20px;border:1px solid ${palette.border};padding:16px;background:white;display:grid;grid-template-columns:56px 1fr;gap:14px;">
                <div style="font-size:24px;line-height:1;font-weight:700;color:${palette.accent};">${entry.order}</div>
                <div>
                  <div style="font-size:15px;line-height:1.5;font-weight:600;color:#111827;">${entry.title}</div>
                  <p style="margin:6px 0 0;font-size:13px;line-height:1.75;color:#4b5563;">${entry.subtitle}</p>
                </div>
              </div>
            `,
              )
              .join("")}
          </div>
          <div style="border-radius:24px;background:${palette.soft};padding:20px;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">阅读导航</div>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.9;color:#1f2937;">目录页基于当前已确认的内容页顺序、标题和主题重心生成，用于建立全刊阅读入口。</p>
          </div>
        </section>
      </article>
    `;
  }

  if (family === 2) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:grid;grid-template-columns:0.85fr 1.15fr;gap:16px;">
          <div style="border-radius:24px;background:${palette.accent};padding:22px;color:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.72;">目录导引</div>
            <h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;font-weight:700;">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:14px;line-height:1.85;opacity:0.9;">${hint}</p>
          </div>
          <div style="display:flex;justify-content:flex-end;"><div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div></div>
        </header>
        <section style="margin-top:18px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">
          ${entries
            .map(
              (entry) => `
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:${entry.order === entries.length ? palette.soft : "white"};">
              <div style="font-size:12px;font-weight:700;color:${palette.accent};">0${entry.order}</div>
              <div style="margin-top:10px;font-size:15px;line-height:1.5;font-weight:600;color:#111827;">${entry.title}</div>
              <p style="margin:8px 0 0;font-size:13px;line-height:1.75;color:#4b5563;">${entry.subtitle}</p>
            </div>
          `,
            )
            .join("")}
        </section>
      </article>
    `;
  }

  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">目录概览</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.8;color:#4b5563;">${hint}</p>
        </div>
        <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
      </header>
      <section style="margin-top:20px;border-radius:24px;background:${palette.soft};padding:22px;">
        <div style="display:grid;gap:12px;">
          ${entries
            .map(
              (entry) => `
            <div style="display:grid;grid-template-columns:44px 1fr;gap:14px;align-items:start;border-bottom:1px solid ${palette.border};padding-bottom:12px;">
              <div style="font-size:16px;font-weight:700;color:${palette.accent};">${entry.order}</div>
              <div>
                <div style="font-size:15px;line-height:1.5;font-weight:600;color:#111827;">${entry.title}</div>
                <p style="margin:6px 0 0;font-size:13px;line-height:1.75;color:#4b5563;">${entry.subtitle}</p>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
    </article>
  `;
}

function renderCaseExpandedLayout(params: {
  page: Page;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  titleVariant: string[];
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
  imageCaption: string;
  chartCaption: string;
  headlineSuffix: string;
}) {
  const { page, palette, versionLabel, titleVariant, leadText, chosenTitles, cardBodies, imageCaption, chartCaption, headlineSuffix } = params;
  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <header style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${titleVariant[0]}</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.2;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
        </div>
        <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
      </header>
      <section style="margin-top:18px;display:grid;grid-template-columns:1.15fr 0.85fr;gap:16px;">
        <div style="border-radius:24px;border:1px solid ${palette.border};padding:18px;background:white;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[0]}</div>
          <div style="margin-top:14px;min-height:250px;border-radius:22px;background:linear-gradient(145deg, ${palette.soft} 0%, white 100%);padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <h2 style="margin:0;font-size:24px;line-height:1.35;font-weight:650;color:${palette.accent};">${titleVariant[1]}</h2>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.9;color:#374151;">${leadText}</p>
            </div>
            <div>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${imageCaption}</div>
              <p style="margin:8px 0 0;font-size:14px;line-height:1.8;color:#4b5563;">${headlineSuffix}</p>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-rows:auto 1fr;gap:14px;">
          <div style="border-radius:22px;background:${palette.soft};padding:18px;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[1]}</div>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${page.outlineText}</p>
          </div>
          <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chartCaption}</div>
            <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <div style="border-radius:16px;background:${palette.soft};padding:14px;">
                <div style="font-size:12px;color:#6b7280;">案例 A</div>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.8;color:#374151;">${cardBodies[0]}</p>
              </div>
              <div style="border-radius:16px;background:${palette.soft};padding:14px;">
                <div style="font-size:12px;color:#6b7280;">案例 B</div>
                <p style="margin:8px 0 0;font-size:13px;line-height:1.8;color:#374151;">${cardBodies[1]}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section style="margin-top:16px;border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
        <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[2]}</div>
        <p style="margin:10px 0 0;font-size:14px;line-height:1.9;color:#4b5563;">${cardBodies[2]}</p>
      </section>
    </article>
  `;
}

function renderConclusionFirstLayout(params: {
  page: Page;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  titleVariant: string[];
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
  imageCaption: string;
  chartCaption: string;
}) {
  const { page, palette, versionLabel, titleVariant, leadText, chosenTitles, cardBodies, imageCaption, chartCaption } = params;
  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <header style="display:grid;grid-template-columns:0.85fr 1.15fr;gap:18px;align-items:stretch;">
        <div style="border-radius:24px;background:${palette.accent};padding:22px;color:white;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.72;">${chosenTitles[0]}</div>
            <h1 style="margin:14px 0 0;font-size:28px;line-height:1.2;font-weight:700;">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.85;opacity:0.9;">${leadText}</p>
          </div>
          <div style="margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,0.16);font-size:13px;line-height:1.8;opacity:0.9;">${cardBodies[2]}</div>
        </div>
        <div style="display:grid;grid-template-rows:auto 1fr;gap:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${titleVariant[0]}</div>
              <h2 style="margin:8px 0 0;font-size:24px;line-height:1.3;font-weight:650;color:${palette.accent};">${titleVariant[3]}</h2>
            </div>
            <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
          </div>
          <div style="display:grid;grid-template-columns:0.9fr 1.1fr;gap:14px;">
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:${palette.soft};">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[2]}</div>
              <div style="margin-top:14px;height:104px;border-radius:16px;background:white;display:flex;align-items:flex-end;justify-content:center;gap:9px;padding:14px;">
                <div style="width:22%;height:46%;background:${palette.accent};border-radius:10px;opacity:0.78;"></div>
                <div style="width:22%;height:76%;background:${palette.accent};border-radius:10px;opacity:0.88;"></div>
                <div style="width:22%;height:92%;background:${palette.accent};border-radius:10px;opacity:0.96;"></div>
              </div>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.8;color:#4b5563;">${chartCaption}</p>
            </div>
            <div style="display:grid;grid-template-rows:1fr 1fr;gap:14px;">
              <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[1]}</div>
                <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[0]}</p>
              </div>
              <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${imageCaption}</div>
                <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${page.outlineText}</p>
              </div>
            </div>
          </div>
        </div>
      </header>
    </article>
  `;
}

function renderOverviewPageLayout(params: {
  page: Page;
  family: number;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
  imageCaption: string;
  chartCaption: string;
}) {
  const { page, family, palette, versionLabel, leadText, chosenTitles, cardBodies, imageCaption, chartCaption } = params;

  if (family === 1) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">总览入口</div>
            <h1 style="margin:10px 0 0;font-size:32px;line-height:1.15;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.9;color:#4b5563;">${leadText}</p>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
        </header>
        <section style="margin-top:20px;display:grid;grid-template-columns:1.15fr 0.85fr;gap:16px;">
          <div style="border-radius:24px;background:linear-gradient(145deg, ${palette.soft} 0%, white 100%);border:1px solid ${palette.border};padding:20px;min-height:300px;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[0]}</div>
            <p style="margin:14px 0 0;font-size:16px;line-height:1.95;color:#1f2937;">${page.outlineText}</p>
          </div>
          <div style="display:grid;grid-template-rows:1fr 1fr;gap:14px;">
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${imageCaption}</div>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[0]}</p>
            </div>
            <div style="border-radius:22px;background:${palette.soft};padding:18px;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chartCaption}</div>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[1]}</p>
            </div>
          </div>
        </section>
        <section style="margin-top:16px;border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[2]}</div>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.9;color:#4b5563;">${cardBodies[2]}</p>
        </section>
      </article>
    `;
  }

  if (family === 2) {
    return renderConclusionFirstLayout({
      page,
      palette,
      versionLabel,
      titleVariant: ["结论强化版", "快速判断", "支撑信息", "最终结论"],
      leadText,
      chosenTitles,
      cardBodies,
      imageCaption,
      chartCaption,
    });
  }

  return renderSummaryFirstLayout({
    page,
    palette,
    versionLabel,
    titleVariant: ["摘要优先版", "核心摘要", "延展信息", "读者结论"],
    leadText,
    chosenTitles,
    cardBodies,
    imageCaption,
    chartCaption,
    headlineSuffix: "本页先建立全局理解，再进入支撑信息。",
  });
}

function renderCaseStudyPageLayout(params: {
  page: Page;
  family: number;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
  imageCaption: string;
  chartCaption: string;
}) {
  const { page, family, palette, versionLabel, leadText, chosenTitles, cardBodies, imageCaption, chartCaption } = params;

  if (family === 0) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">案例摘要</div>
            <h1 style="margin:10px 0 0;font-size:30px;line-height:1.18;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.9;color:#4b5563;">${leadText}</p>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
        </header>
        <section style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="border-radius:24px;background:${palette.soft};padding:20px;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">案例 A</div>
            <p style="margin:12px 0 0;font-size:15px;line-height:1.9;color:#1f2937;">${page.outlineText}</p>
          </div>
          <div style="border-radius:24px;border:1px solid ${palette.border};padding:20px;background:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">案例 B</div>
            <p style="margin:12px 0 0;font-size:14px;line-height:1.9;color:#4b5563;">${cardBodies[0]}</p>
          </div>
        </section>
        <section style="margin-top:16px;display:grid;grid-template-columns:0.8fr 1.2fr;gap:14px;">
          <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chartCaption}</div>
            <p style="margin:10px 0 0;font-size:13px;line-height:1.8;color:#4b5563;">${cardBodies[1]}</p>
          </div>
          <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[2]}</div>
            <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[2]}</p>
          </div>
        </section>
      </article>
    `;
  }

  if (family === 2) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:grid;grid-template-columns:0.78fr 1.22fr;gap:16px;">
          <div style="border-radius:24px;background:${palette.accent};padding:22px;color:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.72;">关键结论</div>
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.15;font-weight:700;">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.85;opacity:0.9;">${leadText}</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div style="border-radius:22px;background:${palette.soft};padding:18px;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">案例表现</div>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#374151;">${cardBodies[0]}</p>
            </div>
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chartCaption}</div>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[1]}</p>
            </div>
          </div>
        </header>
        <section style="margin-top:16px;border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${imageCaption}</div>
          <p style="margin:10px 0 0;font-size:15px;line-height:1.95;color:#4b5563;">${page.outlineText}</p>
        </section>
      </article>
    `;
  }

  return renderCaseExpandedLayout({
    page,
    palette,
    versionLabel,
    titleVariant: ["案例展开版", "案例切片", "场景延展", "案例结论"],
    leadText,
    chosenTitles,
    cardBodies,
    imageCaption,
    chartCaption,
    headlineSuffix: "该版型强调案例主区先于抽象总结出现。",
  });
}

function renderFeaturePageLayout(params: {
  page: Page;
  family: number;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
}) {
  const { page, family, palette, versionLabel, leadText, chosenTitles, cardBodies } = params;

  if (family === 1) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">专题主线</div>
            <h1 style="margin:10px 0 0;font-size:31px;line-height:1.16;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
        </header>
        <section style="margin-top:20px;display:grid;grid-template-columns:0.9fr 1.1fr;gap:16px;">
          <div style="display:grid;grid-template-rows:repeat(3,minmax(0,1fr));gap:12px;">
            ${cardBodies
              .map(
                (body, index) => `
              <div style="border-radius:20px;border:1px solid ${palette.border};padding:16px;background:${index === 1 ? palette.soft : "white"};">
                <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">专题节点 ${index + 1}</div>
                <p style="margin:10px 0 0;font-size:13px;line-height:1.8;color:#4b5563;">${body}</p>
              </div>
            `,
              )
              .join("")}
          </div>
          <div style="border-radius:24px;background:linear-gradient(145deg, ${palette.soft} 0%, white 100%);border:1px solid ${palette.border};padding:22px;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">专题展开</div>
            <p style="margin:12px 0 0;font-size:16px;line-height:1.95;color:#1f2937;">${page.outlineText}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${leadText}</p>
          </div>
        </section>
      </article>
    `;
  }

  if (family === 2) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:grid;grid-template-columns:1.25fr 0.75fr;gap:16px;">
          <div style="border-radius:24px;background:${palette.accent};padding:22px;color:white;">
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.72;">专题结论</div>
            <h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;font-weight:700;">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.85;opacity:0.9;">${leadText}</p>
          </div>
          <div style="display:flex;justify-content:flex-end;"><div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;height:max-content;">${versionLabel}</div></div>
        </header>
        <section style="margin-top:18px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
          ${cardBodies
            .map(
              (body, index) => `
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:${index === 0 ? palette.soft : "white"};">
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">${chosenTitles[Math.min(index, chosenTitles.length - 1)]}</div>
              <p style="margin:10px 0 0;font-size:14px;line-height:1.85;color:#4b5563;">${body}</p>
            </div>
          `,
            )
            .join("")}
        </section>
        <section style="margin-top:16px;border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
          <p style="margin:0;font-size:15px;line-height:1.95;color:#4b5563;">${page.outlineText}</p>
        </section>
      </article>
    `;
  }

  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">专题摘要</div>
          <h1 style="margin:10px 0 0;font-size:31px;line-height:1.16;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
        </div>
        <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
      </header>
      <section style="margin-top:18px;border-radius:24px;background:${palette.soft};padding:22px;">
        <p style="margin:0;font-size:16px;line-height:1.95;color:#1f2937;">${leadText}</p>
      </section>
      <section style="margin-top:16px;display:grid;grid-template-columns:0.95fr 1.05fr;gap:14px;">
        <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">专题脉络</div>
          <p style="margin:10px 0 0;font-size:14px;line-height:1.9;color:#4b5563;">${page.outlineText}</p>
        </div>
        <div style="display:grid;grid-template-rows:repeat(2,minmax(0,1fr));gap:14px;">
          <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
            <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[0]}</p>
          </div>
          <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
            <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[1]}</p>
          </div>
        </div>
      </section>
    </article>
  `;
}

function renderSummaryPageLayout(params: {
  page: Page;
  family: number;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  leadText: string;
  cardBodies: string[];
}) {
  const { page, family, palette, versionLabel, leadText, cardBodies } = params;

  if (family === 1) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
          <div>
            <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">收束页</div>
            <h1 style="margin:10px 0 0;font-size:31px;line-height:1.16;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
            <p style="margin:14px 0 0;font-size:15px;line-height:1.9;color:#4b5563;">${leadText}</p>
          </div>
          <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
        </header>
        <section style="margin-top:20px;display:grid;grid-template-columns:1.1fr 0.9fr;gap:16px;">
          <div style="border-radius:24px;background:${palette.soft};padding:22px;">
            <p style="margin:0;font-size:18px;line-height:1.9;color:#1f2937;">${page.outlineText}</p>
          </div>
          <div style="display:grid;grid-template-rows:repeat(2,minmax(0,1fr));gap:14px;">
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
              <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[0]}</p>
            </div>
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
              <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[1]}</p>
            </div>
          </div>
        </section>
      </article>
    `;
  }

  if (family === 2) {
    return `
      <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
        <section style="border-radius:26px;background:${palette.accent};padding:28px;color:white;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div>
              <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.72;">最终结论页</div>
              <h1 style="margin:12px 0 0;font-size:34px;line-height:1.12;font-weight:700;">${page.pageType}</h1>
            </div>
            <div style="padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.12);font-size:12px;white-space:nowrap;">${versionLabel}</div>
          </div>
          <p style="margin:18px 0 0;font-size:18px;line-height:1.95;opacity:0.95;">${leadText}</p>
        </section>
        <section style="margin-top:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;">
          ${cardBodies
            .map(
              (body) => `
            <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
              <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${body}</p>
            </div>
          `,
            )
            .join("")}
        </section>
      </article>
    `;
  }

  return `
    <article style="height:100%;border:1px solid ${palette.border};border-radius:28px;background:white;padding:28px;box-shadow:0 18px 34px rgba(15,23,42,0.06);font-family:'Avenir Next','PingFang SC','Noto Sans SC',sans-serif;color:#111827;">
      <header style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;">
        <div>
          <div style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;">收束摘要</div>
          <h1 style="margin:10px 0 0;font-size:31px;line-height:1.16;font-weight:700;color:${palette.accent};">${page.pageType}</h1>
        </div>
        <div style="padding:10px 14px;border-radius:999px;background:${palette.soft};font-size:12px;color:${palette.accent};white-space:nowrap;">${versionLabel}</div>
      </header>
      <section style="margin-top:20px;border-radius:24px;background:${palette.soft};padding:24px;">
        <p style="margin:0;font-size:18px;line-height:1.95;color:#1f2937;">${leadText}</p>
      </section>
      <section style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
          <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${page.outlineText}</p>
        </div>
        <div style="border-radius:22px;border:1px solid ${palette.border};padding:18px;background:white;">
          <p style="margin:0;font-size:14px;line-height:1.85;color:#4b5563;">${cardBodies[2]}</p>
        </div>
      </section>
    </article>
  `;
}

function renderContentPreviewLayout(params: {
  page: Page;
  family: number;
  palette: { accent: string; soft: string; border: string };
  versionLabel: string;
  leadText: string;
  chosenTitles: string[];
  cardBodies: string[];
  imageCaption: string;
  chartCaption: string;
}) {
  const { page, family, palette, versionLabel, leadText, chosenTitles, cardBodies, imageCaption, chartCaption } = params;

  if (page.pageRole === "case-study") {
    return renderCaseStudyPageLayout({
      page,
      family,
      palette,
      versionLabel,
      leadText,
      chosenTitles,
      cardBodies,
      imageCaption,
      chartCaption,
    });
  }

  if (page.pageRole === "summary") {
    return renderSummaryPageLayout({
      page,
      family,
      palette,
      versionLabel,
      leadText,
      cardBodies,
    });
  }

  if (page.pageRole === "feature") {
    return renderFeaturePageLayout({
      page,
      family,
      palette,
      versionLabel,
      leadText,
      chosenTitles,
      cardBodies,
    });
  }

  return renderOverviewPageLayout({
    page,
    family,
    palette,
    versionLabel,
    leadText,
    chosenTitles,
    cardBodies,
    imageCaption,
    chartCaption,
  });
}

export function buildMockPreviewHtml(page: Page, versionLabel: string, _promptNote: string, variant = 0, familyOverride?: number) {
  const palettes = [
    { accent: "#111827", soft: "#f5f7fb", border: "#dbe3ef" },
    { accent: "#0f4c81", soft: "#eef6fc", border: "#c9ddf1" },
    { accent: "#4a3f35", soft: "#f8f3ee", border: "#eadbcd" },
    { accent: "#14532d", soft: "#edf8f0", border: "#cfe8d5" },
  ];
  const palette = palettes[variant % palettes.length];
  const family = familyOverride ?? getVariantFamily(variant);
  const chosenTitles = variantSectionSets[family];
  const leadText = variantLeadTexts[family][variant % variantLeadTexts[family].length];
  const cardBodies = variantCardBodies[family];
  const imageCaption = variantImageCaptions[family];
  const chartCaption = variantChartCaptions[family];

  if (page.pageRole === "cover" || page.pageKind === "packaging") {
    return renderCoverPreviewLayout({
      page,
      palette,
      versionLabel,
      variant,
      family,
    });
  }

  return renderContentPreviewLayout({
    page,
    family,
    palette,
    versionLabel,
    leadText,
    chosenTitles,
    cardBodies,
    imageCaption,
    chartCaption,
  });
}

export function buildPackagingPreviewHtml(
  page: Page,
  contentPages: Page[],
  versionLabel: string,
  variant = 0,
  familyOverride?: number,
) {
  const palettes = [
    { accent: "#111827", soft: "#f5f7fb", border: "#dbe3ef" },
    { accent: "#0f4c81", soft: "#eef6fc", border: "#c9ddf1" },
    { accent: "#4a3f35", soft: "#f8f3ee", border: "#eadbcd" },
    { accent: "#14532d", soft: "#edf8f0", border: "#cfe8d5" },
  ];
  const palette = palettes[variant % palettes.length];
  const family = familyOverride ?? getVariantFamily(variant);

  if (page.pageRole === "toc") {
    return renderTocPreviewLayout({
      page,
      palette,
      versionLabel,
      variant,
      family,
      contentPages,
    });
  }

  return renderCoverPreviewLayout({
    page,
    palette,
    versionLabel,
    variant,
    family,
  });
}

function buildSchemePreviewMap(pages: Page[], versionLabel: string, promptNote: string, variantSeed = 0, familyOverride?: number) {
  return Object.fromEntries(
    pages.map((page, index) => [
      page.id,
      buildMockPreviewHtml(page, versionLabel, promptNote, variantSeed + index, familyOverride),
    ]),
  );
}

function createMockVersionSet(taskId: string, pages: Page[], variantSeed = 0): PageVersion[] {
  const now = Date.now();
  return Array.from({ length: INITIAL_MOCK_VERSION_COUNT }, (_, index) => {
    const versionLabel = `V${index + 1}`;
    const promptNote = index === 0 ? "初版候选结果" : `候选偏向：${variantSummaries[index]}`;
    return {
      id: createId("version"),
      taskId,
      versionLabel,
      promptNote,
      variantSummary: getMockVersionStrategySummary(index),
      derivedFromVersionId: null,
      previewsByPageId: buildSchemePreviewMap(pages, versionLabel, promptNote, variantSeed + index, index),
      isSelected: index === 0,
      isApproved: false,
      createdAt: new Date(now + index * 1000).toISOString(),
    };
  });
}

export function createInitialPageVersions(taskId: string, pages: Page[]): PageVersion[] {
  return createMockVersionSet(taskId, pages, 0);
}

export function createDeferredPackagingPages(taskId: string, startIndex: number): Page[] {
  return MOCK_DEFERRED_PAGE_BLUEPRINTS.map((blueprint, index) => ({
    id: createId("page"),
    taskId,
    index: startIndex + index,
    renderSeed: 0,
    pageKind: blueprint.pageKind,
    pageRole: blueprint.pageRole,
    pageType: blueprint.pageType,
    outlineText: blueprint.outlineText,
    sourceMode: blueprint.sourceMode,
    expressionMode: blueprint.expressionMode,
    styleText: blueprint.styleText,
    userConstraints: blueprint.userConstraints,
    isConfirmed: false,
    isSaved: false,
    userProvidedContentBlocks: blueprint.userProvidedContentBlocks,
    coverMeta: blueprint.coverMeta,
  }));
}

function createMockPages(taskId: string, mockPageCount: number): Page[] {
  // Directory / TOC is intentionally excluded from the initial mock page structure.
  // In the real workflow it should be derived after structure confirmation, not hardcoded up front.
  return MOCK_INITIAL_PAGE_BLUEPRINTS.slice(0, mockPageCount).map((blueprint, index) => ({
    id: createId("page"),
    taskId,
    index: index + 1,
    renderSeed: 0,
    pageKind: blueprint.pageKind,
    pageRole: blueprint.pageRole,
    pageType: blueprint.pageType,
    outlineText: blueprint.outlineText,
    sourceMode: blueprint.sourceMode,
    expressionMode: blueprint.expressionMode,
    styleText: blueprint.styleText,
    userConstraints: blueprint.userConstraints,
    isConfirmed: false,
    isSaved: index === 0,
    userProvidedContentBlocks: blueprint.userProvidedContentBlocks,
    coverMeta: blueprint.coverMeta,
  }));
}

export function createSeedTask(
  prompt = "我想生成一期 3 月人工智能趋势月刊",
  workType: WorkType = "magazine",
  options: MockSeedOptions = {},
): SeedTaskResult {
  const projectId = "project-default";
  const taskId = createId("task");
  const now = new Date().toISOString();
  const mockPageCount = Math.max(1, Math.min(options.mockPageCount ?? DEFAULT_MOCK_PAGE_COUNT, MOCK_INITIAL_PAGE_BLUEPRINTS.length));
  const pages = createMockPages(taskId, mockPageCount);

  const task: Task = {
    id: taskId,
    projectId,
    title: prompt.length > 18 ? `${prompt.slice(0, 18)}...` : prompt,
    prompt,
    workType,
    plannedPageCount: mockPageCount,
    hasGeneratedCoverPage: false,
    hasDerivedTocPage: false,
    packagingStageStatus: "pending",
    currentStage: "outline",
    selectedPageId: pages[0].id,
    pageIds: pages.map((page) => page.id),
    status: "in_progress",
    createdAt: now,
  };

  const pageVersions: PageVersion[] = createInitialPageVersions(taskId, pages).map((version) => ({
    ...version,
    createdAt: now,
  }));

  const assets: Asset[] = [
    {
      id: createId("asset"),
      taskId,
      fileName: workType === "magazine" ? "PagesCut_AI_Monthly_March.pdf" : "PagesCut_Project_Report.pptx",
      workType,
      createdAt: now,
      downloadUrl: "#",
      status: "completed",
    },
  ];

  return {
    project: {
      id: projectId,
      name: "default project",
      taskIds: [taskId],
      isDefault: true,
    },
    task,
    pages,
    pageVersions,
    assets,
  };
}
