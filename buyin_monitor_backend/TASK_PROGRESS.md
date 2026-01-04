[MODE: EXECUTE]
- 步骤：1. 后端支持 selectionConfig 字段的读写和默认配置获取
- 修改：routes/admin.js
- 更改摘要：添加了获取默认配置的接口，并在用户列表和修改接口中支持 selectionConfig 字段。

[MODE: EXECUTE]
- 步骤：2. 前端 dashboard 添加配置编辑功能
- 修改：public/dashboard.html
- 更改摘要：在用户编辑弹窗中增加了配置编辑区域，支持加载默认配置和 JSON 格式化，并更新了相关的保存逻辑。

[MODE: REVIEW]
实施与最终计划完全匹配。无需进一步操作。
