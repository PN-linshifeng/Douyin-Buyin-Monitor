const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Admin = require('../models/Admin');
const Config = require('../models/Config');
const {encrypt, decrypt} = require('../utils/crypto');

// Middleware: 检查管理员权限
function requireAdmin(req, res, next) {
	if (req.session && req.session.admin) {
		return next();
	}
	res.status(401).json({success: false, message: '未授权，请登录'});
}

// ===========================
// 管理员认证
// ===========================

// 1. 管理员登录
router.post('/login', async (req, res) => {
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
router.get('/check-auth', (req, res) => {
	if (req.session && req.session.admin) {
		res.json({success: true, user: req.session.admin});
	} else {
		res.json({success: false});
	}
});

// 3. 退出登录
router.post('/logout', (req, res) => {
	req.session.destroy();
	res.json({success: true});
});

// ===========================
// 用户管理 (Users)
// ===========================

// 4. 获取用户列表
router.get('/users', requireAdmin, async (req, res) => {
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
router.post('/users', requireAdmin, async (req, res) => {
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
router.put('/users/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	const {expirationTime, fingerprint} = req.body;

	try {
		const user = await User.findByPk(id);
		if (!user)
			return res.status(404).json({success: false, message: '用户未找到'});

		// if (expirationTime !== undefined) {
		// 	user.expirationTime = expirationTime;
		// }
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
router.delete('/users/:id', requireAdmin, async (req, res) => {
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

// ===========================
// 配置管理 (Configs)
// ===========================

// 8. 获取配置列表
router.get('/configs', requireAdmin, async (req, res) => {
	try {
		const configs = await Config.findAll();
		res.json({success: true, data: configs});
	} catch (e) {
		res.status(500).json({success: false, message: 'Fetch configs failed'});
	}
});

// 9. 新增配置
router.post('/configs', requireAdmin, async (req, res) => {
	const {key, value, description} = req.body;
	if (!key)
		return res.status(400).json({success: false, message: '配置键(key)必填'});

	try {
		const newConfig = await Config.create({key, value, description});
		res.json({success: true, data: newConfig});
	} catch (e) {
		if (e.name === 'SequelizeUniqueConstraintError') {
			return res.status(400).json({success: false, message: '键名已存在'});
		}
		res.status(500).json({success: false, message: 'Create config failed'});
	}
});

// 10. 修改配置
router.put('/configs/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	const {key, value, description} = req.body;

	try {
		const config = await Config.findByPk(id);
		if (!config)
			return res.status(404).json({success: false, message: '配置项未找到'});

		if (key !== undefined && key !== config.key) {
			config.key = key;
		}
		if (value !== undefined) config.value = value;
		if (description !== undefined) config.description = description;

		await config.save();
		res.json({success: true});
	} catch (e) {
		if (e.name === 'SequelizeUniqueConstraintError') {
			return res.status(400).json({success: false, message: '键名已存在'});
		}
		res.status(500).json({success: false, message: 'Update config failed'});
	}
});

// 11. 删除配置
router.delete('/configs/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	try {
		const result = await Config.destroy({where: {id}});
		if (!result)
			return res.status(404).json({success: false, message: '配置项未找到'});

		res.json({success: true});
	} catch (e) {
		res.status(500).json({success: false, message: 'Delete config failed'});
	}
});

// ===========================
// 管理员账户管理 (Admins)
// ===========================

// 12. 获取管理员列表
router.get('/admins', requireAdmin, async (req, res) => {
	try {
		const admins = await Admin.findAll();
		// 隐藏密码
		const safeAdmins = admins.map((a) => ({
			id: a.id,
			username: a.username,
			createdAt: a.createdAt,
			updatedAt: a.updatedAt,
		}));
		res.json({success: true, data: safeAdmins});
	} catch (e) {
		res.status(500).json({success: false, message: 'Fetch admins failed'});
	}
});

// 13. 新增管理员
router.post('/admins', requireAdmin, async (req, res) => {
	const {username, password} = req.body;
	if (!username || !password)
		return res
			.status(400)
			.json({success: false, message: 'Username and password required'});

	try {
		// 加密密码
		const encryptedPassword = encrypt(password);
		const newAdmin = await Admin.create({
			username,
			password: encryptedPassword,
		});
		res.json({
			success: true,
			data: {id: newAdmin.id, username: newAdmin.username},
		});
	} catch (e) {
		if (e.name === 'SequelizeUniqueConstraintError') {
			return res.status(400).json({success: false, message: 'Username exists'});
		}
		res.status(500).json({success: false, message: 'Create admin failed'});
	}
});

// 14. 修改管理员密码
router.put('/admins/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	const {password} = req.body;

	if (!password)
		return res.status(400).json({success: false, message: 'Password required'});

	try {
		const admin = await Admin.findByPk(id);
		if (!admin)
			return res.status(404).json({success: false, message: 'Admin not found'});

		admin.password = encrypt(password);
		await admin.save();
		res.json({success: true});
	} catch (e) {
		res.status(500).json({success: false, message: 'Update admin failed'});
	}
});

// 15. 删除管理员
router.delete('/admins/:id', requireAdmin, async (req, res) => {
	const {id} = req.params;
	// 防止删除自己 (Optional safety check)
	try {
		const result = await Admin.destroy({where: {id}});
		if (!result)
			return res.status(404).json({success: false, message: 'Admin not found'});

		res.json({success: true});
	} catch (e) {
		res.status(500).json({success: false, message: 'Delete admin failed'});
	}
});

module.exports = router;
