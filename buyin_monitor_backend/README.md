# Douyin Buyin Monitor Backend

## 简介
这是抖音选品插件的后端服务，负责用户登录鉴权和动态脚本分发。

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
**前台启动 (推荐开发调试)**：
```bash
npm start
```
服务默认运行在 `http://localhost:3000`。

**后台启动**：
```bash
nohup npm start > server.log 2>&1 &
```

### 3. 数据初始化
如果需要重置测试数据（包含加密的手机号 13800138000）：
```bash
node init_data.js
```

## API 接口
- `POST /api/extension/login`: 插件登录
- `GET /api/admin/users`: 获取用户列表 (TODO)

## 目录结构
- `server.js`: 服务入口
- `public/`: 存放动态下发的插件脚本 (product_info.js, product_list.js)
- `admin.json`, `user.json`: 数据存储
