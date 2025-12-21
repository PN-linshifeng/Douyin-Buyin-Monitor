# 数据库操作指南

本项目已从基于 JSON 文件的存储迁移到 **SQLite** 数据库，并使用 **Sequelize** ORM 进行管理。本指南将介绍如何管理和操作数据库。

## 1. 数据库概览

*   **数据库类型**: SQLite
*   **数据库文件**: `database/db.sqlite` (自动生成)
*   **ORM 框架**: Sequelize
*   **管理工具**: 推荐使用 [DB Browser for SQLite](https://sqlitebrowser.org/) 或 VS Code 插件 (如 SQLite Viewer)。

## 2. 项目结构

与数据库相关的文件结构如下：

```text
buyin_monitor_backend/
├── database/
│   ├── connection.js    # 数据库连接配置
│   └── db.sqlite        # 实际的数据库文件 (运行后生成)
├── models/
│   ├── User.js          # 用户模型 (对应原 user.json)
│   └── Admin.js         # 管理员模型 (对应原 admin.json)
├── init_db.js           # 数据库初始化及数据迁移脚本
└── server.js            # 后端主程序 (集成数据库调用)
```

## 3. 查看和管理数据

由于 SQLite 是一个通过文件存储的数据库，您可以直接使用任何支持 SQLite 的 GUI 工具打开 `database/db.sqlite` 文件来查看和编辑数据。

### 使用 GUI 工具 (推荐)
1.  下载并安装 [DB Browser for SQLite](https://sqlitebrowser.org/)。
2.  点击 "Open Database"，选择项目目录下的 `database/db.sqlite`。
3.  切换到 "Browse Data" 标签页，选择 `Users` 或 `Admins` 表即可查看和修改数据。
4.  **注意**: 修改数据后记得点击 "Write Changes" 保存。

### 使用命令行 (需安装 sqlite3)
```bash
# 进入数据库目录
cd database/

# 打开数据库
sqlite3 db.sqlite

# 查看所有表
.tables

# 查询用户
SELECT * FROM Users;

# 退出
.quit
```

## 4. 代码开发指南

在代码中，请通过 `models` 目录下的 Sequelize 模型进行操作，而不是直接写 SQL 语句。

### 引入模型
```javascript
const User = require('./models/User');
const Admin = require('./models/Admin');
```

### 常用操作示例

**1. 查询所有用户**
```javascript
const users = await User.findAll();
```

**2. 根据 ID 查询用户**
```javascript
const user = await User.findByPk(1);
```

**3. 条件查询 (例如查找特定手机号)**
```javascript
// 需要引入加密函数进行解密比对，或者直接存储明文(当前逻辑是存储加密后的密文)
// 假设这里是根据已知的加密字符串查找
const user = await User.findOne({ 
    where: { phone: 'encrypted_phone_string' } 
});
```

**4. 创建新用户**
```javascript
const newUser = await User.create({
    phone: 'encrypted_string',
    buyinId: '123456',
    expirationTime: '2025-12-31T00:00:00.000Z'
});
```

**5. 更新用户**
```javascript
const user = await User.findByPk(1);
if (user) {
    user.buyinId = 'new_id';
    await user.save();
}

// 或者直接更新
await User.update({ buyinId: 'new_id' }, {
    where: { id: 1 }
});
```

**6. 删除用户**
```javascript
await User.destroy({
    where: { id: 1 }
});
```

## 5. 数据备份与恢复

SQLite 数据库只是一个文件，备份非常简单。

*   **备份**: 直接复制 `database/db.sqlite` 文件到安全的地方。
*   **恢复**: 将备份文件覆盖回 `database/db.sqlite`，重启服务即可。

## 6. 常见问题

**Q: 为什么我看不到 `db.sqlite` 文件？**
A: 该文件会在第一次运行 `npm run dev` 或 `node server.js` 后自动生成。如果项目刚克隆下来，请先运行服务。

**Q: 我可以直接修改 `user.json` 来更新数据吗？**
A: **不行**。迁移后，系统不再读取 `user.json`。该文件仅作为历史备份存在，或者在数据库文件丢失并重新初始化时作为数据源被一次性导入。所有数据操作请直接对数据库进行。
