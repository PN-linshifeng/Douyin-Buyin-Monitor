const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto-js');
const statsRouter = require('./routes/stats');
const initDB = require('./init_db');
const User = require('./models/User');
const Admin = require('./models/Admin');

const app = express();
const PORT = 3308;
const SECRET_KEY = 'your_secret_key_here'; // 在实际生产中应放在环境变量

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
app.use('/api/extension', statsRouter);

// Helper: 加密/解密 (AES)
function encrypt(text) {
	return crypto.AES.encrypt(text, SECRET_KEY).toString();
}

function decrypt(cipherText) {
	const bytes = crypto.AES.decrypt(cipherText, SECRET_KEY);
	return bytes.toString(crypto.enc.Utf8);
}

// API: 扩展端登录
app.post('/api/extension/login', async (req, res) => {
	const {phone, buyinId, fingerprint} = req.body;
	if (!phone) {
		return res.status(400).json({success: false, message: 'Phone is required'});
	}
	if (!fingerprint) {
		return res
			.status(400)
			.json({success: false, message: 'Fingerprint is required'});
	}

	try {
		const users = await User.findAll();
		let foundUser = null;

		for (const u of users) {
			try {
				const dbPhone = decrypt(u.phone);
				if (dbPhone === phone) {
					foundUser = u;
					break;
				}
			} catch (e) {
				console.error('Decryption error for user:', u.id);
			}
		}

		if (!foundUser) {
			return res
				.status(401)
				.json({success: false, message: '用户不存在或未授权'});
		}

		// 检查过期时间
		if (foundUser.expirationTime) {
			const now = new Date();
			const exp = new Date(foundUser.expirationTime);
			if (now > exp) {
				return res.status(403).json({success: false, message: '授权已过期'});
			}
		}

		let updated = false;

		// 检查/绑定 指纹
		if (!foundUser.fingerprint) {
			// 第一次登录，绑定指纹
			foundUser.fingerprint = fingerprint;
			updated = true;
		} else {
			// 对比指纹
			if (foundUser.fingerprint !== fingerprint) {
				return res.status(403).json({
					success: false,
					message: '设备环境发生变化，请使用之前的设备登录',
				});
			}
		}

		// 更新 buyinId
		if (buyinId && (!foundUser.buyinId || foundUser.buyinId !== buyinId)) {
			foundUser.buyinId = buyinId;
			updated = true;
		}

		if (updated) {
			await foundUser.save();
		}

		// 生成 Token
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
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({success: false, message: 'Login failed'});
	}
});

app.get('/api/extension/check-auth', async (req, res) => {
	const authHeader = req.headers.authorization;
	const fingerprint = req.headers['x-device-fingerprint'];
	console.log(
		'[Debug] Check-Auth Header:',
		authHeader,
		'Fingerprint:',
		fingerprint
	);

	if (authHeader) {
		const token = authHeader.split(' ')[1]; // Bearer <token>
		try {
			const payloadStr = decrypt(token);
			console.log('[Debug] Decrypted Payload:', payloadStr);

			if (payloadStr) {
				const payload = JSON.parse(payloadStr);

				// 查库验证最新状态
				const dbUser = await User.findByPk(payload.userId);

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

				// 检查指纹
				if (dbUser.fingerprint) {
					if (!fingerprint || dbUser.fingerprint !== fingerprint) {
						return res.status(403).json({
							success: false,
							message: '设备环境发生变化，请重新登录',
						});
					}
				} else {
					// 如果库里没指纹，强制重新登录以绑定
					return res.status(403).json({
						success: false,
						message: '安全升级，请重新登录以绑定设备',
					});
				}

				const baseUrl = `${req.protocol}://${req.get('host')}`;
				return res.json({
					success: true,
					user: {
						id: dbUser.id,
						phone: dbUser.phone, // Return encrypted? Or decrypted? Front end usually doesn't need phone, but original code returned whole user object.
						buyinId: dbUser.buyinId,
						fingerprint: dbUser.fingerprint,
						expirationTime: dbUser.expirationTime,
					},
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
app.post('/api/admin/login', async (req, res) => {
	const {username, password} = req.body;

	try {
		const admin = await Admin.findOne({where: {username}});
		let isAuthenticated = false;

		if (admin) {
			try {
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
	} catch (e) {
		console.error('Admin login error:', e);
		res.status(500).json({success: false, message: 'Login Error'});
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
app.get('/api/admin/users', requireAdmin, async (req, res) => {
	try {
		const users = await User.findAll();
		// 解密手机号返回前端展示
		const safeUsers = users.map((u) => {
			let displayPhone = u.phone;
			try {
				displayPhone = decrypt(u.phone);
			} catch (e) {}
			return {
				id: u.id,
				phone: displayPhone,
				buyinId: u.buyinId,
				createTime: u.createdAt,
				updateTime: u.updatedAt,
				expirationTime: u.expirationTime,
				fingerprint: u.fingerprint || '',
			};
		});
		res.json({success: true, data: safeUsers});
	} catch (e) {
		res.status(500).json({success: false, message: 'Fetch users failed'});
	}
});

// 5. 新增用户
app.post('/api/admin/users', requireAdmin, async (req, res) => {
	const {phone, expirationTime} = req.body;
	if (!phone)
		return res.status(400).json({success: false, message: '手机号必填'});

	try {
		const users = await User.findAll();
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

		const newUser = await User.create({
			phone: encrypt(phone),
			buyinId: '',
			expirationTime: expirationTime || '',
		});

		res.json({success: true, data: newUser});
	} catch (e) {
		res.status(500).json({success: false, message: 'Create failed'});
	}
});

// 6. 修改用户 (主要是过期时间)
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	const {expirationTime, fingerprint} = req.body;

	try {
		const user = await User.findByPk(id);
		if (!user)
			return res.status(404).json({success: false, message: '用户未找到'});

		if (expirationTime !== undefined) {
			user.expirationTime = expirationTime;
		}
		if (fingerprint !== undefined) {
			user.fingerprint = fingerprint;
		}

		await user.save();
		res.json({success: true});
	} catch (e) {
		res.status(500).json({success: false, message: 'Update failed'});
	}
});

// 7. 删除用户
app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	try {
		const result = await User.destroy({where: {id}});
		if (!result)
			return res.status(404).json({success: false, message: '用户未找到'});

		res.json({success: true});
	} catch (e) {
		res.status(500).json({success: false, message: 'Delete failed'});
	}
});

// 启动服务 (Database sync first)
initDB().then(() => {
	const server = app.listen(PORT, () => {
		console.log(`Backend server running on http://localhost:${PORT}`);
	});
	// Prevent 502 errors from Nginx/Load Balancer timeouts
	server.keepAliveTimeout = 65000; // Ensure it's higher than Nginx's keepalive_timeout (usually 60s)
	server.headersTimeout = 66000; // Should be higher than keepAliveTimeout
});
