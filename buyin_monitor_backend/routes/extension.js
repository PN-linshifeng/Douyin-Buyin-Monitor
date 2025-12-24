const express = require('express');
const router = express.Router();
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const {encrypt, decrypt} = require('../utils/crypto');

// API: 扩展端登录
router.post('/login', async (req, res) => {
	const {phone, buyinId, fingerprint} = req.body;
	if (!phone) {
		return res.status(400).json({success: false, message: '需要手机号'});
	}
	if (!fingerprint) {
		return res.status(400).json({success: false, message: '需要设备指纹'});
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
				console.error('用户解密错误 ID:', u.id);
			}
		}

		if (!foundUser) {
			return res
				.status(401)
				.json({success: false, message: '用户不存在或未授权'});
		}

		// 保存旧指纹快照
		const currentDbFingerprint = foundUser.fingerprint;

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
				// 严格模式：指纹不匹配则拒绝登录
				console.warn(
					`[安全警告] 用户 ${foundUser.id} 指纹不匹配! 库内: ${foundUser.fingerprint}, 请求: ${fingerprint}`
				);
				try {
					const clientIpRaw =
						req.headers['x-forwarded-for'] ||
						req.socket.remoteAddress ||
						req.ip;
					const clientIp =
						typeof clientIpRaw === 'string'
							? clientIpRaw.split(',')[0].replace(/^::ffff:/, '')
							: clientIpRaw;
					const userAgent = req.headers['user-agent'];
					await LoginLog.create({
						userId: foundUser.id,
						phone: foundUser.phone,
						buyinId: foundUser.buyinId,
						fingerprint: fingerprint,
						oldFingerprint: currentDbFingerprint,
						ip: clientIp,
						userAgent: userAgent || '',
						status: 'MISMATCH',
					});
				} catch (e) {
					console.error('Failed to log mismatch:', e);
				}
				return res.status(403).json({
					success: false,
					message: '设备环境发生变化，请使用之前的设备登录，或联系管理员重置',
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

		// Record Login Log
		try {
			const clientIpRaw =
				req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
			const clientIp =
				typeof clientIpRaw === 'string'
					? clientIpRaw.split(',')[0].replace(/^::ffff:/, '')
					: clientIpRaw;
			const userAgent = req.headers['user-agent'];

			await LoginLog.create({
				userId: foundUser.id,
				phone: foundUser.phone, // Store encrypted snapshot
				buyinId: foundUser.buyinId,
				fingerprint: fingerprint, // The one from request (now bound)
				oldFingerprint: currentDbFingerprint,
				ip: clientIp,
				userAgent: userAgent || '',
				status: 'SUCCESS',
			});
		} catch (logErr) {
			console.error('Failed to log login:', logErr);
			// Non-blocking
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
			message: '登录成功',
			token: token,
			scripts: [
				// `${baseUrl}/extension/main.js`,
				`${baseUrl}/extension/product_info.js`,
				`${baseUrl}/extension/product_list.js`,
				`${baseUrl}/extension/coupon_sniffer.js`,
			],
		});
	} catch (error) {
		console.error('登录错误:', error);
		res.status(500).json({success: false, message: '登录失败'});
	}
});

// API: 检查授权状态
router.get('/check-auth', async (req, res) => {
	const authHeader = req.headers.authorization;
	const fingerprint = req.headers['x-device-fingerprint'];
	console.log('[调试] 检查授权 Header:', authHeader, '指纹:', fingerprint);

	if (authHeader) {
		const token = authHeader.split(' ')[1]; // Bearer <token>
		try {
			const payloadStr = decrypt(token);
			console.log('[调试] 解密载荷:', payloadStr);

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
						console.warn(
							`[安全警告] CheckAuth 用户 ${dbUser.id} 指纹不匹配! 库内: ${dbUser.fingerprint}, 请求: ${fingerprint}`
						);
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
						phone: dbUser.phone,
						buyinId: dbUser.buyinId,
						fingerprint: dbUser.fingerprint,
						expirationTime: dbUser.expirationTime,
					},
					scripts: [
						// `${baseUrl}/extension/main.js`,
						`${baseUrl}/extension/product_info.js`,
						`${baseUrl}/extension/product_list.js`,
						`${baseUrl}/extension/coupon_sniffer.js`,
					],
				});
			}
		} catch (e) {
			console.error('Token 验证失败:', e);
		}
	}

	// Cookie 方式作为备选 (兼容)
	if (req.session && req.session.user) {
		const baseUrl = `${req.protocol}://${req.get('host')}`;
		return res.json({
			success: true,
			user: req.session.user,
			scripts: [
				// `${baseUrl}/extension/main.js`,
				`${baseUrl}/extension/product_info.js`,
				`${baseUrl}/extension/product_list.js`,
				`${baseUrl}/extension/coupon_sniffer.js`,
			],
		});
	}

	res.json({success: false});
});

module.exports = router;
