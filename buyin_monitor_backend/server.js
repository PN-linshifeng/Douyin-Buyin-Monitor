const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto-js');

const app = express();
const PORT = 3308;
const SECRET_KEY = 'your_secret_key_here'; // 在实际生产中应放在环境变量

// 中间件
app.use(
	cors({
		origin: function (origin, callback) {
			// 允许所有 origin，或者只允许特定的
			// 为了开发方便，且支持 credentials，我们反射请求的 origin
			// 如果 origin 不存在 (如服务端请求)，也允许
			callback(null, true);
		},
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization'],
	})
);
app.use(bodyParser.json());
app.use(
	session({
		secret: 'session_secret',
		resave: false,
		saveUninitialized: true,
		cookie: {secure: false}, // 开发环境 false
	})
);
app.use(express.static(path.join(__dirname, 'public')));

// 数据文件路径
const USER_FILE = path.join(__dirname, 'user.json');
const ADMIN_FILE = path.join(__dirname, 'admin.json');

// Helper: 读取/写入 JSON
function readJson(file) {
	if (!fs.existsSync(file)) return [];
	try {
		const data = fs.readFileSync(file, 'utf8');
		return JSON.parse(data);
	} catch (e) {
		return [];
	}
}

function writeJson(file, data) {
	fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Helper: 加密/解密 (AES)
function encrypt(text) {
	return crypto.AES.encrypt(text, SECRET_KEY).toString();
}

function decrypt(cipherText) {
	const bytes = crypto.AES.decrypt(cipherText, SECRET_KEY);
	return bytes.toString(crypto.enc.Utf8);
}

// API: 扩展端登录
app.post('/api/extension/login', (req, res) => {
	const {phone, buyinId} = req.body;
	if (!phone) {
		return res.status(400).json({success: false, message: 'Phone is required'});
	}

	const users = readJson(USER_FILE);
	// 查找用户 (需解密比对)
	let userIndex = -1;
	let foundUser = null;

	for (let i = 0; i < users.length; i++) {
		const u = users[i];
		try {
			const dbPhone = decrypt(u.phone);
			if (dbPhone === phone) {
				userIndex = i;
				foundUser = u;
				break;
			}
		} catch (e) {
			console.error('Decryption error for user:', u);
		}
	}

	if (!foundUser) {
		return res
			.status(401)
			.json({success: false, message: '用户不存在或未授权'});
	}

	// 检查过期时间 (简单示例，具体格式需约定)
	if (foundUser.expirationTime) {
		const now = new Date();
		const exp = new Date(foundUser.expirationTime);
		if (now > exp) {
			return res.status(403).json({success: false, message: '授权已过期'});
		}
	}

	// 更新 buyinId
	let updated = false;
	if (buyinId && (!foundUser.buyinId || foundUser.buyinId !== buyinId)) {
		users[userIndex].buyinId = buyinId;
		users[userIndex].updateTime = new Date().toISOString();
		writeJson(USER_FILE, users);
		updated = true;
	}

	// 生成 Token (简单加密用户信息和时间戳)
	// 实际生产应使用 JWT
	const tokenPayload = JSON.stringify({
		userId: foundUser.id,
		phone: phone,
		ts: Date.now(),
	});
	const token = encrypt(tokenPayload);

	// 返回 JS 文件路径
	const baseUrl = `${req.protocol}://${req.get('host')}`;
	res.json({
		success: true,
		message: 'Login successful',
		token: token,
		scripts: [
			`${baseUrl}/extension/product_info.js`,
			`${baseUrl}/extension/product_list.js`,
		],
	});
});

app.get('/api/extension/check-auth', (req, res) => {
	const authHeader = req.headers.authorization;
	console.log('[Debug] Check-Auth Header:', authHeader);

	if (authHeader) {
		const token = authHeader.split(' ')[1]; // Bearer <token>
		try {
			const payloadStr = decrypt(token);
			console.log('[Debug] Decrypted Payload:', payloadStr);

			if (payloadStr) {
				const payload = JSON.parse(payloadStr);

				// 查库验证最新状态 (防止 Token 未过期但后台把用户封了或改了过期时间)
				const users = readJson(USER_FILE);
				const dbUser = users.find((u) => {
					// 1. 尝试匹配 ID (转为字符串比较以防类型差异)
					if (String(u.id) === String(payload.userId)) return true;
					// 2. 尝试匹配手机号 (需解密)
					try {
						const dbPhone = decrypt(u.phone);
						if (dbPhone === payload.phone) return true;
					} catch (e) {}
					return false;
				});

				if (!dbUser) {
					return res.status(401).json({success: false, message: '用户不存在'});
				}

				// 检查过期时间
				if (dbUser.expirationTime) {
					const now = new Date();
					const exp = new Date(dbUser.expirationTime);
					if (now > exp) {
						return res.status(403).json({success: false, message: '账号过期'});
					}
				}

				const baseUrl = `${req.protocol}://${req.get('host')}`;
				return res.json({
					success: true,
					user: dbUser, // 返回最新用户数据
					scripts: [
						`${baseUrl}/extension/product_info.js`,
						`${baseUrl}/extension/product_list.js`,
					],
				});
			}
		} catch (e) {
			console.error('Token validation failed:', e);
		}
	}

	// Cookie 方式作为备选 (兼容)
	if (req.session && req.session.user) {
		const baseUrl = `${req.protocol}://${req.get('host')}`;
		return res.json({
			success: true,
			user: req.session.user,
			scripts: [
				`${baseUrl}/extension/product_info.js`,
				`${baseUrl}/extension/product_list.js`,
			],
		});
	}

	res.json({success: false});
});

// ===========================
// 管理员后台 API
// ===========================

// Middleware: 检查管理员权限
function requireAdmin(req, res, next) {
	if (req.session && req.session.admin) {
		return next();
	}
	res.status(401).json({success: false, message: '未授权，请登录'});
}

// 1. 管理员登录
app.post('/api/admin/login', (req, res) => {
	const {username, password} = req.body;
	const admins = readJson(ADMIN_FILE);

	// 简单验证：实际应用中密码应哈希存储
	const admin = admins.find((a) => a.username === username);

	// 这里的 admin.password 目前是 'encrypted_password_placeholder'
	// 为了方便演示，我们暂时硬编码一个可用的账号，或者假设 admin.json 里存的是明文/简单加密
	// 假设: 默认密码是 'admin123'，存的是 encrypt('admin123')
	// 在生产环境中，应该比对 hash。这里为了匹配 "加密" 的描述:
	// 如果 password 匹配解密后的值

	let isAuthenticated = false;
	if (admin) {
		try {
			// 尝试解密存储的密码进行比对，或者反过来
			// 简化逻辑：如果是默认占位符，允许 admin/admin 通过
			if (
				admin.password === 'encrypted_password_placeholder' &&
				password === 'admin'
			) {
				isAuthenticated = true;
			} else {
				const decryptedPass = decrypt(admin.password);
				if (decryptedPass === password) isAuthenticated = true;
			}
		} catch (e) {
			// 如果解密失败（可能是旧数据或哈希），回退简单比对
			if (admin.password === password) isAuthenticated = true;
		}
	}

	if (isAuthenticated) {
		req.session.admin = {username: admin.username};
		res.json({success: true});
	} else {
		res.status(401).json({success: false, message: '用户名或密码错误'});
	}
});

// 2. 检查登录状态
app.get('/api/admin/check-auth', (req, res) => {
	if (req.session && req.session.admin) {
		res.json({success: true, user: req.session.admin});
	} else {
		res.json({success: false});
	}
});

// 3. 退出登录
app.post('/api/admin/logout', (req, res) => {
	req.session.destroy();
	res.json({success: true});
});

// 4. 获取用户列表
app.get('/api/admin/users', requireAdmin, (req, res) => {
	const users = readJson(USER_FILE);
	// 解密手机号返回前端展示
	const safeUsers = users.map((u) => {
		let displayPhone = u.phone;
		try {
			displayPhone = decrypt(u.phone);
		} catch (e) {}
		return {
			...u,
			phone: displayPhone,
		};
	});
	res.json({success: true, data: safeUsers});
});

// 5. 新增用户
app.post('/api/admin/users', requireAdmin, (req, res) => {
	const {phone, expirationTime} = req.body;
	if (!phone)
		return res.status(400).json({success: false, message: '手机号必填'});

	const users = readJson(USER_FILE);

	// 查重
	const exists = users.some((u) => {
		try {
			return decrypt(u.phone) === phone;
		} catch (e) {
			return false;
		}
	});
	if (exists)
		return res.status(400).json({success: false, message: '该手机号已存在'});

	const newUser = {
		id: Date.now(), // 简单ID
		phone: encrypt(phone),
		buyinId: '', // 扩展端登录时自动填充
		createTime: new Date().toISOString(),
		updateTime: new Date().toISOString(),
		expirationTime: expirationTime || '', // 空代表不过期
	};

	users.push(newUser);
	writeJson(USER_FILE, users);
	res.json({success: true, data: newUser});
});

// 6. 修改用户 (主要是过期时间)
app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
	const {id} = req.params;
	const {expirationTime} = req.body;

	const users = readJson(USER_FILE);
	const index = users.findIndex((u) => String(u.id) === String(id));

	if (index === -1)
		return res.status(404).json({success: false, message: '用户未找到'});

	users[index].expirationTime = expirationTime;
	users[index].updateTime = new Date().toISOString();

	writeJson(USER_FILE, users);
	res.json({success: true});
});

// 7. 删除用户
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
	const {id} = req.params;
	const users = readJson(USER_FILE);
	const newUsers = users.filter((u) => String(u.id) !== String(id));

	if (users.length === newUsers.length)
		return res.status(404).json({success: false, message: '用户未找到'});

	writeJson(USER_FILE, newUsers);
	res.json({success: true});
});

// 启动服务
app.listen(PORT, () => {
	console.log(`Backend server running on http://localhost:${PORT}`);
});
