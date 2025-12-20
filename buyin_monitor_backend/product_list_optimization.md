# 上下文
文件名：product_list_optimization.md
创建于：2025-12-20
创建者：Antigravity
关联协议：RIPER-5

# 任务描述
优化 `buyin_monitor_backend/public/extension/product_list.js` 中的代码，将“获取选品数据按钮”和“批量分析本页商品”的公共逻辑去重并合并。

# 核心分析
- **现状**:
    - `handleGetSelectionData` (L70): 处理单个按钮点击。查找 `promotionId` -> `analyzeAndShow` (带弹窗) -> `calculateStats` -> 更新单个按钮 UI。
    - `handleBatchAnalyze` (L176): 处理批量按钮点击。遍历 `savedPromotions` -> `analyzeAndShow` (无弹窗) -> `calculateStats` -> 查找并更新对应单个按钮 UI。
- **痛点**:
    - 分析逻辑和 UI 更新逻辑重复。
    - 如果未来修改了 UI 状态逻辑 (比如增加了新的状态颜色)，需要改两处。

# 提议的解决方案
1.  **提取 UI 更新函数**: `updateButtonStatus(btn, status, error = false)`。
2.  **提取核心分析函数**: `executeAnalysis(promotionId, isBatch)`，返回分析结果。但考虑到 `analyzeAndShow` 已经封装了请求，我们更需要封装的是 **"请求 + 数据处理 + UI更新"** 的这个流程。
3.  **最终封装方案**:
    - 创建 `analyzeProduct(promo, btn, isBatch)` 函数。
    - `promo`: 商品信息对象 (包含 `promotionId` 和 `name`)。
    - `btn`: 对应的单个商品按钮 DOM 元素。
    - `isBatch`: 布尔值，控制是否静默模式 (无弹窗) 以及可能的其他批处理特定逻辑。
# 当前执行步骤 (由 EXECUTE 模式在开始执行某步骤时更新)
> 正在执行: "添加按钮复用检测逻辑"

# 任务进度 (由 EXECUTE 模式在每步完成后追加)
*   2025-12-20
    *   步骤：1. 定义 `updateButtonState(btn, type)` 函数
    *   修改：`product_list.js` 添加了 `updateButtonState`。
    *   更改摘要：实现了统一的按钮状态更新函数。
    *   原因：执行计划步骤 1。
    *   阻碍：无。
    *   状态：成功。
    *   修改：`product_list.js` 添加了 `updateButtonState`。
    *   更改摘要：实现了统一的按钮状态更新函数。
    *   原因：执行计划步骤 1。
    *   阻碍：无。
    *   状态：成功。
*   2025-12-20
    *   步骤：2. 定义 `runProductAnalysis` 异步核心函数
    *   修改：`product_list.js` 添加了 `runProductAnalysis`。
    *   更改摘要：实现了核心分析逻辑，包含参数准备、API调用、状态计算和UI更新。
    *   原因：执行计划步骤 2。
    *   阻碍：无。
    *   状态：成功。
*   2025-12-20
    *   步骤：3. 重构 `handleGetSelectionData`
    *   修改：`product_list.js` 中 `handleGetSelectionData` 已被简化。
    *   更改摘要：删除了冗余代码，调用新封装的 `runProductAnalysis`。
    *   原因：执行计划步骤 3。
    *   阻碍：无。
    *   状态：成功。
*   2025-12-20
    *   步骤：4. 重构 `handleBatchAnalyze`
    *   修改：`product_list.js` 中 `handleBatchAnalyze` 已被简化。
    *   更改摘要：删除了冗余代码，使用 `runProductAnalysis` 处理每个商品。
    *   原因：执行计划步骤 4。
    *   阻碍：无。
    *   状态：成功。

# 最终审查 (由 REVIEW 模式填充)
重构任务已完成。代码逻辑已简化，去除了重复的分析代码。`runProductAnalysis` 和 `updateButtonState` 两个公共函数现在处理所有与分析和UI更新相关的逻辑。已通过静态代码审查，逻辑正确。
1. 定义 `updateButtonState(btn, type)` 函数
   - 统一处理按钮的样式和文本变化。
   - 类型包括: 'analyzing', 'good', 'bad', 'normal', 'error', 'default'。
2. 定义 `runProductAnalysis(promo, btn, isBatch)` 异步核心函数
   - 接收商品信息对象 `promo`。

*   2025-12-20
    *   步骤：6. (新增) 优化 `injectButtons`，如果检测到按钮 `name` 与当前商品 `name` 不一致（复用），则移除旧按钮并重新创建。
    *   修改：`product_list.js` 中的 `injectButtons` 函数。
    *   更改摘要：添加了检查逻辑 `if (btn && btn.getAttribute('name') !== name)`，如果为真则移除旧按钮。并使用 `updateButtonState(btn, 'default')` 初始化新按钮。
    *   原因：解决 DOM 节点复用导致按钮状态（如“推荐”）错误残留的问题。
    *   阻碍：无。
    *   状态：成功。
*   2025-12-20
    *   步骤：7. 支持表格视图注入
    *   修改：`product_list.js` 中的 `injectButtons`，新增了 `checkAndInject` 辅助函数。
    *   更改摘要：新增了对 `.auxo-table-body tr` 的遍历逻辑，在每行的第二个 `td` 插入按钮。并针对表格样式进行了适配（更紧凑）。
    *   原因：响应用户需求，支持表格模式下的选品数据分析。
    *   阻碍：无。
    *   状态：成功。

# 实施计划 (由 PLAN 模式生成)
实施检查清单：
1. 定义 `updateButtonState(btn, type)` 函数 [已完成]
2. 定义 `runProductAnalysis(promo, btn, isBatch)` 异步核心函数 [已完成]
3. 重构 `handleGetSelectionData` [已完成]
4. 重构 `handleBatchAnalyze` [已完成]
5. 清理旧代码 [已完成]
6. 优化 `injectButtons` 复用逻辑 [已完成]
7. 支持表格视图 [已完成]
8. (新增) 引入 `MutationObserver` 监听 DOM 变化
   - 原因：单页应用切换视图（如卡片/表格切换）或滚动加载时，可能不会触发网络请求监听，导致按钮不显示。
   - 方案：监听 `document.body` 的 `childList` 和 `subtree`，防抖调用 `injectButtons`。
9. (新增) 增强选择器健壮性
   - 原因：CSS Module 的 Hash 后缀（如 `___dadac`）不稳定。
   - 方案：使用属性选择器 `[class*="index_module__wrapper"]` 进行模糊匹配。

# 最终审查 (由 REVIEW 模式填充)
实施已完成。
1. 重构了代码，去除了重复逻辑，提取了 `runProductAnalysis` 和 `updateButtonState`。
2. 修复了按钮复用的状态残留问题。
3. 扩展了对表格视图（`.auxo-table-body`）的支持。
4. 增强了DOM注入的稳定性，使用了 Fuzzy Class Selector 和 MutationObserver。
代码逻辑清晰，功能完整。
