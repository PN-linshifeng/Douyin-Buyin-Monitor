# 上下文
文件名：2025-12-20_extension_fingerprint.md
创建于：2025-12-20
创建者：Antigravity
关联协议：RIPER-5 + Multidimensional + Agent Protocol

# 任务描述
扩展登录和检查鉴权状态 API，新增用户浏览器指纹参数逻辑。
1.  **登录时**：获取浏览器指纹。
    *   第一次登录（或指纹为空时）：保存指纹。
    *   后续登录：对比指纹，不一致提示“请使用之前的设备登录”。
2.  **检查鉴权时**：验证对比指纹。

# 项目概述
Chrome 扩展 (`content.js`) 与后端 (`server.js`) 交互，使用 `user.json` 存储用户数据。

---
*以下部分由 AI 在协议执行过程中维护*
---

# 分析 (由 RESEARCH 模式填充)
- **后端 (`server.js`)**:
  - `/api/extension/login`: 目前只验证 phone 和 expiration。
  - `/api/extension/check-auth`: 验证 token。
  - 数据存储在 `user.json`。
- **前端 (`content.js`)**:
  - 登录时调用 `/login`。
  - 自动检查时调用 `/check-auth`。
  - 需新增指纹生成逻辑。
- **限制**:
  - 指纹字段需要新增到 `user.json`。
  - 鉴权检查时也需要验证指纹，意味着前端 `checkLoginState` 需要发送指纹，后端需要校验。

# 提议的解决方案 (由 INNOVATE 模式填充)
- **指纹生成**: 使用 `Canvas` 指纹 + 基本 `Navigator` 信息生成哈希，确保唯一性足够且不依赖外部复杂库。
- **API 变更**:
  - `POST /login`: Body 增加 `fingerprint`。
  - `GET /check-auth`: Header 增加 `x-device-fingerprint`。
- **逻辑流程**:
  - 登录: 查库 -> (无指纹? 存 : 对比? (通过: 报错)) -> 颁发 Token。
  - 鉴权: 解密 Token -> 查库 -> 对比指纹 -> (通过: 报错(虽然Token有效但设备不对)) -> 返回结果。

# 实施计划 (由 PLAN 模式生成)

## 实施检查清单

### 后端开发 (server.js)
1.  修改 `/api/extension/login` 接口：
    - [ ] 获取请求体中的 `fingerprint` 参数。
    - [ ] 验证用户成功后，检查 `user.fingerprint`。
    - [ ] 如果 `user.fingerprint` 不存在，更新用户数据写入该指纹。
    - [ ] 如果 `user.fingerprint` 存在，对比请求的指纹。如果不一致，返回 403 错误，提示“请使用之前的设备登录”。
2.  修改 `/api/extension/check-auth` 接口：
    - [ ] 获取请求头 `x-device-fingerprint`。
    - [ ] 在验证 Token 和用户存在后，检查 `user.fingerprint`。
    - [ ] 如果 `user.fingerprint` 存在且与请求头中的指纹不一致，返回 403 错误，提示“设备不一致，请重新登录”。
    - [ ] (可选优化) 如果 `user.fingerprint` 不存在，返回 401/403 强制前端重新登录以完成指纹绑定。

### 前端开发 (content.js)
3.  新增 `generateFingerprint` 函数：
    - [ ] 实现基于 Canvas 和 Navigator 信息的指纹生成逻辑。
4.  修改 `createLoginModal` 中的登录逻辑：
    - [ ] 在点击登录时调用 `generateFingerprint`。
    - [ ] 将 `fingerprint` 添加到 `/api/extension/login` 的 POST 请求体中。
5.  修改 `checkLoginState` 逻辑：
    - [ ] 调用 `generateFingerprint`。
    - [ ] 在 `/api/extension/check-auth` 请求头中添加 `x-device-fingerprint`。

