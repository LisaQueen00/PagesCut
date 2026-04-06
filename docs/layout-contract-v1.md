# Layout Contract V1

## 1. 文档目标

PagesCut 需要 `Layout Contract`，是因为当前产品已经不再只是“先拼一些 mock HTML 看效果”，而是要逐步进入稳定的页面生成与渲染链路。

如果页面预览继续依赖散乱的 `previewHtml`：

- 不同页型很难建立统一的运行语义
- Stage 1 页面定义很难向后施加结构化约束
- 预览、最终编排、Assets、导出链会各自吃不同形态的数据
- 页面比例、整页缩放、页型差异等规则无法稳定复用

因此，当前 V1 的目标不是一次性做完所有 pageType，而是先验证一条最小可运行主链，并把 Stage 1 的页面表达意图正式接到后续页面生成中：

`Stage 1 页面定义 -> PageIntent -> PageContentPlan -> Layout Contract -> PageModel -> Preview Renderer`

这条链当前已经用于已验证的 `overview` / `data` / `case` / `summary` 页型，并且已经证明：

- 页面可以先形成统一运行对象
- 预览可以不再依赖散乱 HTML 作为主逻辑
- Stage 1 的表达意图与内容规划可以正式向后约束页面生成
- 整页缩放与页型差异可以在统一链路中成立

## 2. 当前 V1 总模型

当前最小运行链是：

`Stage 1 页面定义 -> PageIntent -> PageContentPlan -> Layout Contract -> PageModel -> Preview Renderer`

当前各层职责分别是：

- `Stage 1 页面定义`
  - 保存页型、表达形式倾向、内容来源、用户提供内容块与页级约束
  - 回答“这页是什么页、想怎么表达、已经有什么原始内容”

- `PageIntent`
  - 是 Stage 1 页面定义和后续 layout 生成之间的第一层桥接
  - 回答“这页想怎么表达”
  - 当前承接：
    - `expressionMode`
    - `visualPriority`
    - `preferredImageCount`
    - `preferredChartCount`
    - `textDensity`
    - `requiredContentAreas`
    - `allowDegrade`

- `PageContentPlan`
  - 是内容组织 schema 与装配状态层
  - 回答“这页需要哪些内容单元、最终承接多少、实际填了多少、slot 绑定了什么来源”

- `Layout Contract`
  - 描述某一页型在当前阶段真正需要的结构化输入
  - 它不是任意页面 JSON，也不是最终渲染结果
  - 它回答“这类页面需要什么最小结构化输入”

- `PageModel`
  - 是当前统一运行对象
  - 它接收 contract 的结果，组织成稳定的页面结构、区域和 block
  - 预览渲染器当前直接消费它

- `Preview Renderer`
  - 当前已迁移页型直接消费 `PageModel`
  - 它直接渲染 `PageModel`
  - 负责把固定设计尺寸的页面 component 以整页缩放方式展示出来

当前这条链的重点不是做“完整模板系统”，而是先让：

- 页型语义
- 页面表达意图
- 内容单元 schema
- 页面运行对象
- 预览规则

进入同一条稳定主链。

## 3. 当前已验证的核心对象

### 3.1 Layout Contract

当前 `Layout Contract` 是页型相关的最小输入定义，见 [src/types/pageModel.ts](../src/types/pageModel.ts)。

它当前已经验证过四类：

- `GeneratedOverviewContractInput`
- `ManualDataContractInput`
- `GeneratedCaseContractInput`
- `GeneratedSummaryContractInput`

这说明：

- contract 不是“统一大而全输入”
- 而是“每种 pageType 有自己的最小输入边界”

### 3.2 PageModel

`PageModel` 是当前统一运行对象，见 [src/types/pageModel.ts](../src/types/pageModel.ts)。

它当前承接了这些职责：

- 页面级 identity
- `pageType`
- `layoutKey`
- `sourceKind`
- `aspectRatio`
- `theme`
- `regions`

其中 `regions` 当前固定为：

- `hero`
- `main`
- `aside`

block 当前支持：

- `hero`
- `metrics`
- `rich-text`
- `bullet-list`
- `chart`
- `table`
- `callout`
- `signal-list`
- `visual`
- `content-slots`

其中：

- `hero / metrics / rich-text / bullet-list / callout` 可以视为当前已相对稳定的共用能力
- `visual` 当前明确是阶段性粗粒度抽象，主要用于先承接案例页里的视觉入口与图文关系，不代表最终 block 细分已经定型
- `content-slots` 当前也是阶段性开发态验证表达，主要用于显式验证 `PageContentPlan` 是否已经被页面主体承接，不代表最终产品 UI 已定型

`PageModel` 当前之所以是统一运行对象，是因为：

- 不同来源输入最终都收敛到它
- renderer 当前直接吃它
- 它已经能承接 `overview / data / case / summary` 四种页型的结构差异

### 3.3 Renderer

renderer 当前主要在 [src/lib/pageModel.tsx](../src/lib/pageModel.tsx)。

它现在做的是：

- 先渲染固定设计尺寸的完整页面 component
- 再在预览层对整页做统一缩放

它与旧 `previewHtml` 的关系是：

- `overview / data / case / summary` 当前默认走 `PageModel`
- `previewHtml` 目前只保留给尚未迁移的 pageType 作为 fallback
- 新接 pageType 的默认目标路径应是 `Layout Contract -> PageModel -> Preview Renderer`

## 4. 当前已支持的 pageType

当前只写已经实际实现并验证过的：

- `overview`
- `data`
- `case`
- `summary`

### 4.1 overview

页型职责：

- 综述页 / 判断页
- 负责主题进入、总体判断、阅读校准
- 不是图表主导页

当前 contract 的关键输入：

- `title`
- `outline`
- `tone`
- `openingNote`
- `highlights`
- `signalItems`
- `signalMetrics`
- `viewpointCards`
- `supportPoints`

当前 renderer 的主要阅读节奏：

- hero：主题进入
- main：关键信号 + 正文解释
- aside：本页判断 + 页内摘要指标 + 延展观点

它不是“同一个壳子换内容”的原因：

- contract 输入本身偏向判断、综述、主题进入
- renderer 的主角是摘要、观点和解释，不是图表或表格

### 4.2 data

页型职责：

- 数据页 / 支撑页
- 负责图表、指标、表格与说明的结构化承载
- 不是一般综述页换成几个数字

当前 contract 的关键输入：

- `title`
- `summary`
- `metrics`
- `chartTitle`
- `chartSeries`
- `chartSummary`
- `chartExplanationPairs`
- `chartExplanationPairStatus`
- `tableTitle`
- `table`
- `sourceNote`
- `sourceLines`
- `dataTakeaways`
- `notes`

当前 renderer 的主要阅读节奏：

- hero：标题与摘要引入
- main：图表 -> 图表说明复合单元 -> 图表说明 -> 表格
- aside：关键指标 -> 读图提示 -> 来源 / 备注

它不是“同一个壳子换内容”的原因：

- contract 输入偏向指标、图表、表格、来源说明
- renderer 的主角区域是图表和数据支撑，不是观点块

### 4.3 case

页型职责：

- 案例页 / 叙事页
- 负责把案例对象、场景、做法、结果与启示讲完整
- 不是总结页，也不是弱化版数据页

当前 contract 的关键输入：

- `title`
- `subject`
- `scenario`
- `challenge`
- `actionSteps`
- `resultSummary`
- `takeaway`
- `visualCaption`
- `imageTextPairs`
- `imageTextPairStatus`
- `outcomeMetrics`

当前 renderer 的主要阅读节奏：

- hero：案例对象 + 视觉入口
- main：背景 / 问题 -> 图文单元槽位 -> 关键做法 / 过程
- aside：结果 / 成效 -> 指标 -> 启示

它不是“同一个壳子换内容”的原因：

- contract 输入偏向案例对象、过程与结果链路
- renderer 的主角是叙事主轴，不是总览判断，也不是图表主区

### 4.4 summary

页型职责：

- 收束页 / 结论页
- 负责最终判断、关键结论点、建议行动与风险提醒
- 不是 `overview` 的缩水版

当前 contract 的关键输入：

- `title`
- `finalJudgment`
- `conclusionPoints`
- `recommendations`
- `cautions`
- `closingNote`
- `evidenceMetrics`

当前 renderer 的主要阅读节奏：

- hero：最终判断 + 收束判断
- main：关键结论 -> 下一步建议
- aside：收束摘要 -> 风险提醒 -> 结束语

它不是“同一个壳子换内容”的原因：

- contract 输入偏向结论收束、建议行动与边界提醒
- renderer 的主角是收束与行动，不是主题进入，也不是图表支撑或案例叙事

### 4.5 当前四页型覆盖面

这四个页型合起来，当前 V1 已经覆盖了四类典型页面组织方式：

- `overview`：判断驱动
- `data`：数据驱动
- `case`：叙事驱动
- `summary`：收束驱动

## 5. 当前预览机制的固定规则

当前已验证通过的规则如下：

- page 是固定设计尺寸的完整页面 component
- 内部 panel / region 是 page 的子节点
- 预览机制是“整页先成立，再整体缩放”
- 不是局部裁切，不是 viewport 看一块更大的页面
- 不是 page 外壳缩小、内部内容自己重新排版

当前页面比例规则：

- 月刊 / 报告类当前按 `A4` 竖版比例
- 固定常量在 [src/lib/pageModel.tsx](../src/lib/pageModel.tsx)：
  - `A4_PORTRAIT_RATIO = 210 / 297`

当前预览缩放规则：

- `PageModelRenderer` 先形成固定设计尺寸 page
- `PageModelPreview` 再根据父容器可用宽度整体 `scale`

这意味着：

- Stage 2 中心候选预览已经是整页缩放结果
- 缩略图与后续放大预览也应继续遵守同一比例逻辑
- 不允许为了填满容器而任意拉伸页面宽高比

## 6. 当前已验证的内容规划与装配状态

当前 V1 已经不只验证页型 contract 和 page model，还补出了页面表达意图与内容规划层。

### 6.1 PageIntent

`PageIntent` 当前已经开始把 Stage 1 页面定义向后收敛成结构化约束。

它当前重点回答：

- 这页偏 `text-led / image-text / chart-led / mixed` 哪一种表达模式？
- 视觉和文字优先级是什么？
- 希望有多少图片 / 图表？
- 页面是否允许降级？

### 6.2 PageContentPlan

`PageContentPlan` 当前重点回答：

- 这页需要哪些内容单元？
- 各类单元 `requested / resolved / filled` 各是多少？
- 单元之间是 standalone / paired / grouped 哪一种？
- 哪些 slot 已绑定来源，哪些还没绑定？

### 6.3 当前已验证的内容单元

当前已经明确进入 `PageContentPlan` 并完成最小验证的内容单元包括：

- 原子单元：
  - `image`
  - `text`
  - `chart`
  - `metric`
  - `table`
- 复合单元：
  - `imageTextPair`
  - `chartExplanationPair`

其中当前已经做过前端显式槽位验证的是：

- `case -> imageTextPair`
- `data -> chartExplanationPair`

### 6.4 当前已验证的状态闭环

当前 `PageContentPlan` 已经明确区分三类数量 / 状态：

- `requested`
- `resolved`
- `filled`

它们分别回答：

- `requested`
  - 需求侧想要多少内容单元
- `resolved`
  - 系统最终承接多少
- `filled`
  - 最终实际填了多少真实内容

当前开发态已经验证过理想场景和非一致场景，而不是只停留在 `3 / 3 / 3` 这类理想状态。

### 6.5 当前已验证的 source binding

当前已经补出最小可用的 source binding：

- `case -> imageTextPair`
  - `image slot -> image source`
  - `text slot -> text source`
- `data -> chartExplanationPair`
  - `chart slot -> chart source`
  - `explanation slot -> explanation text source`

当前已支持的最小 missing reason 包括：

- `missing-image-source`
- `missing-text-source`
- `missing-chart-source`
- `missing-explanation-source`

## 7. 当前 V1 的边界

当前 V1 明确不做这些内容：

- 用户自定义模板编辑器
- 模板市场 / 模板验收 UI
- 已有作品反向解析为 contract / page model
- 全量 `pageType` 支持
- 更复杂的导出整合
- 把模板式来源和生成式来源混成同一套重系统

当前范围只验证：

- 统一 `PageIntent`
- 统一 `PageContentPlan`
- 统一 contract
- 统一 page model
- 统一 preview renderer
- `overview / data / case / summary` 四种已验证页型

当前仍应明确视为阶段性抽象或尚未打满的包括：

- `visual` 仍是阶段性粗粒度 block
- `content-slots` 仍偏开发态验证表达，不是最终产品 UI
- `PageContentPlan` 还未独立持久化
- `overview / summary` 还没有像 `case / data` 一样深入使用内容单元 schema
- 严格槽位系统与完整 source system 还未做完

## 8. 当前已知的下一步扩展方向

在当前 V1 已验证结果之上，后续最自然的方向包括：

- 把 `PageContentPlan` 和 source binding 继续推进成更严格的槽位兑现规则
- 接入更多 `pageType`
  - 例如 `cover` / `toc`
- 让 `FinalComposition` 逐步承接 `PageModel`
- 让 Assets / 导出链逐步吃 `PageModel`

这里的顺序重点不再是“先扩更多页型”，而是：

- 先把内容装配链收严
- 再继续扩更多页型与后续链路

## 9. 当前结论

当前 `Layout Contract V1` 已经完成的不是“概念设计”，而是一条已运行、已验证的最小闭环：

- Stage 1 页面定义已经开始正式进入页面生成主链
- `PageIntent -> PageContentPlan -> Layout Contract -> PageModel -> Renderer` 已成立
- `overview / data / case / summary` 四种页型已经接入主路径
- 两类复合单元已经完成最小验证：
  - `imageTextPair`
  - `chartExplanationPair`
- `requested / resolved / filled` 已经进入正式状态建模
- `slot -> source` 与 `missing reason` 已经进入最小 source binding 验证
- 当前主链中，`previewHtml` 已经明确退居未迁移页型 fallback

因此，当前 V1 可以视为：

- 页型 contract 已成立
- 页面表达意图桥接已成立
- 内容单元 schema 已成立
- 最小装配状态闭环已成立
- 统一运行对象已成立
- 整页预览规则已成立

后续应在这个基础上继续收紧，而不是回退到旧的页面拼接方式。
