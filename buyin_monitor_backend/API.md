# 后端 API 文档

本文档描述了 Douyin Monitor Backend 提供的所有 API 接口。

**基础 URL**: `http://localhost:3000` (开发环境)

## 扩展插件 API

这些接口供 Chrome 扩展插件调用，用于鉴权和获取核心脚本。

### 1. 扩展登录
使用手机号和 buyinId 进行登录验证。手机号必须已存在于后台用户列表中。

- **URL**: `/api/extension/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
      "phone": "13800138000",
      "buyinId": "12345678" // 可选
  }
  ```
- **Response**:
  - **200 OK**:
    ```json
    {
        "success": true,
        "message": "Login successful",
        "token": "encrypt_token_string...",
        "scripts": [
            "http://localhost:3000/product_info.js",
            "http://localhost:3000/product_list.js"
        ]
    }
    ```
  - **401 Unauthorized**: 用户不存在或未授权。
  - **403 Forbidden**: 用户授权已过期。

### 2. 检查鉴权状态 (Token 验证)
用于插件启动时自动检查登录状态并获取脚本。

- **URL**: `/api/extension/check-auth`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer <token>` (从登录接口获取的 token)
- **Response**:
  - **200 OK**:
    ```json
    {
        "success": true,
        "user": { ... },
        "scripts": [ ... ]
    }
    ```
  - **200 OK (But Failed)**:
    ```json
    {
        "success": false
    }
    ```

---

## 管理员后台 API

这些接口供管理员前端页面 (`admin.html`, `dashboard.html`) 使用，受 Session 保护。

### 1. 管理员登录
- **URL**: `/api/admin/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
      "username": "admin",
      "password": "password"
  }
  ```
- **Response**: `{ "success": true }` 或 `{ "success": false, "message": "..." }`

### 2. 检查管理员鉴权
- **URL**: `/api/admin/check-auth`
- **Method**: `GET`
- **Response**: `{ "success": true, "user": { "username": "admin" } }`

### 3. 获取用户列表
- **URL**: `/api/admin/users`
- **Method**: `GET`
- **Response**:
  ```json
  {
      "success": true,
      "data": [
          {
              "id": 123456,
              "phone": "138****0000", // 解密后的明文
              "buyinId": "...",
              "createTime": "...",
              "updateTime": "...",
              "expirationTime": "..." // ISO 格式，空表示不过期
          }
      ]
  }
  ```

### 4. 新增用户
- **URL**: `/api/admin/users`
- **Method**: `POST`
- **Body**:
  ```json
  {
      "phone": "13800138000",
      "expirationTime": "2025-12-31T23:59:59.000Z" // 可选
  }
  ```
- **Response**: `{ "success": true, "data": { ...newly created user... } }`

### 5. 修改用户 (过期时间)
- **URL**: `/api/admin/users/:id`
- **Method**: `PUT`
- **Body**:
  ```json
  {
      "expirationTime": "2026-01-01T00:00:00.000Z"
  }
  ```
- **Response**: `{ "success": true }`

### 6. 删除用户
- **URL**: `/api/admin/users/:id`
- **Method**: `DELETE`
- **Response**: `{ "success": true }`

### 7. 退出登录
- **URL**: `/api/admin/logout`
- **Method**: `POST`
- **Response**: `{ "success": true }`
