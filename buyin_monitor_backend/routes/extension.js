const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {encrypt, decrypt} = require('../utils/crypto');

// API: 扩展端登录
router.post('/login', async (req, res) => {
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
				// `${baseUrl}/extension/main.js`,
				`${baseUrl}/extension/product_info.js`,
				`${baseUrl}/extension/product_list.js`,
				`${baseUrl}/extension/coupon_sniffer.js`,
			],
		});
	} catch (error) {
		console.error('Login error:', error);
		res.status(500).json({success: false, message: 'Login failed'});
	}
});

// API: 检查授权状态
router.get('/check-auth', async (req, res) => {
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
