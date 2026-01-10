const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const statsRouter = require('./routes/stats');
const adminRouter = require('./routes/admin'); // 引入 Admin 路由
const extensionRouter = require('./routes/extension'); // 引入 Extension 路由
const mailRouter = require('./routes/mail'); // 引入 Mail 路由
const initDB = require('./init_db');
// User 已移至 routes/extension.js 和 routes/admin.js，此处不再需要
// Admin, Config 已移至 routes/admin.js，此处不再需要

const app = express();
const PORT = 3308;
// SECRET_KEY 已移至 utils/crypto.js

// 中间件
app.use(
	cors({
		origin: function (origin, callback) {
			callback(null, true);
		},
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization', 'x-device-fingerprint'],
	})
);
app.use(bodyParser.json({limit: '50mb'}));
app.use(
	session({
		secret: 'session_secret',
		resave: false,
		saveUninitialized: true,
		cookie: {secure: false}, // 开发环境 false
	})
);
app.use(express.static(path.join(__dirname, 'public')));

// 注册统计路由 (API: /api/extension/calculate_stats)
// 注意：Extension Router 也处理 /api/extension 下的 login 和 check-auth
// Express 允许这样做，或者我们可以合并
app.use('/api/extension', statsRouter);
app.use('/api/extension', extensionRouter);

// 注册管理员路由 (API: /api/admin/*)
app.use('/api/admin', adminRouter);

// 注册邮件路由 (API: /api/mail/send)
app.use('/api/mail', mailRouter);

// ===========================
// Admin API 已移至 routes/admin.js
// ===========================

// 启动服务 (Database sync first)
initDB().then(() => {
	const server = app.listen(PORT, () => {
		console.log(`Backend server running on http://localhost:${PORT}`);
	});
	// Prevent 502 errors from Nginx/Load Balancer timeouts
	server.keepAliveTimeout = 65000; // Ensure it's higher than Nginx's keepalive_timeout (usually 60s)
	server.headersTimeout = 66000; // Should be higher than keepAliveTimeout
});
