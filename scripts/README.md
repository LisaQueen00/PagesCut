# PagesCut 验证与预览脚本

这个目录包含两个**开发/验证用**脚本，用于在不启动浏览器的情况下，验证「确定性内容引擎」产出的页面内容，并导出预览产物。它们**不是**产品运行时依赖。

## 依赖

两个脚本都通过 `tsx` 运行（已列入 `devDependencies`）：

```bash
npm install          # 安装 tsx 等 devDependencies
```

## 1. `full-pipeline.mts` — 真实渲染管线验证（推荐）

用**产品自身的渲染管线**（`createPageIntent → createPageContentPlan → generate*ContractInput → fillContractToPageModel → renderPageModelToHtml`）端到端跑一遍确定性引擎，并输出：

- 每页的真实 HTML（`preview/NN-*.html`）
- 一个可点击导航的目录页（`preview/index.html`）

这是最接近真实产物的验证（HTML 就是 `renderPageModelToHtml` 的直接输出，不含 mock 残留）。

```bash
npx tsx --tsconfig tsconfig.app.json scripts/full-pipeline.mts
```

## 2. `render-png.mts` — PNG 预览（近似渲染）

> ⚠️ 注意：这是一个**独立的手写 SVG 渲染器**，用于在无浏览器的环境里生成 PNG 预览图。
> 它是对产品 React 渲染器（`PageModelRenderer`）的**近似还原，不是逐像素一致**。
> 以 `full-pipeline.mts` 的 HTML 输出、以及真实应用（`npm run dev`）为最终 ground truth。

它额外需要两个可选依赖 + 中文字体（不进入 `package.json`，因为体积大/含原生二进制）：

```bash
npm install -D sharp opentype.js
# 下载 Noto Sans SC 字体放到 scripts/ 下（或任何可用的 CJK 字体）：
#   scripts/NotoSansSC-Regular.ttf
#   scripts/NotoSansSC-Bold.ttf
npx tsx --tsconfig tsconfig.app.json scripts/render-png.mts
```

输出：

- `preview/png/NN-*.png` — 每页 PNG
- `preview/variant-comparison.png` — 同一页 3 个表达变体的对比图

`preview/` 与 `scripts/*.ttf` 已加入 `.gitignore`，不会进入版本库。

## 3. `smoke-webllm.mts` — WebLLM 逻辑冒烟测试

在不依赖浏览器 WebGPU 的前提下，验证 WebLLM 增强层的非推理逻辑：状态机、grounding 上下文、角色列表、未启用时的回退行为、Node 环境下的 `unsupported` 判定。

```bash
npx tsx --tsconfig tsconfig.app.json scripts/smoke-webllm.mts
```

> 真正的模型推理需要浏览器 WebGPU，无法在 Node 沙箱验证；请在 Chrome / Edge 113+ 中通过应用内的「启用本地模型」按钮验证。
