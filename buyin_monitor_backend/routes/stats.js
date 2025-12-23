const express = require('express');
const router = express.Router();
const crypto = require('crypto-js');
const User = require('../models/User');

const SECRET_KEY = 'your_secret_key_here'; // 保持与 server.js 一致

// Helper: 解密
function decrypt(cipherText) {
	const bytes = crypto.AES.decrypt(cipherText, SECRET_KEY);
	return bytes.toString(crypto.enc.Utf8);
}

// 简单的内存缓存
const tokenCache = new Map();
const CACHE_TTL = 60 * 1000; // 1分钟缓存

function getCachedUser(token) {
	const cached = tokenCache.get(token);
	if (!cached) return null;
	if (Date.now() > cached.expiry) {
		tokenCache.delete(token);
		return null;
	}
	return cached.user;
}

function setCachedUser(token, user) {
	tokenCache.set(token, {
		user: user,
		expiry: Date.now() + CACHE_TTL,
	});
	// 简单的清理逻辑：如果缓存过大，清空
	if (tokenCache.size > 1000) {
		tokenCache.clear();
	}
}

// 中间件：Token 校验
async function verifyToken(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return res.status(401).json({success: false, message: '未提供 Token'});
	}

	const token = authHeader.split(' ')[1]; // Bearer <token>
	if (!token) {
		return res.status(401).json({success: false, message: '无效的 Token 格式'});
	}

	try {
		const payloadStr = decrypt(token);
		if (!payloadStr) {
			return res.status(403).json({success: false, message: 'Token 无效'});
		}

		const payload = JSON.parse(payloadStr);

		// Check cache first
		const cachedUser = getCachedUser(token);
		let user;

		if (cachedUser) {
			user = cachedUser;
		} else {
			// 查库验证用户状态
			user = await User.findByPk(payload.userId);
			if (user) {
				setCachedUser(token, user);
			}
		}

		if (!user) {
			return res.status(403).json({success: false, message: '用户不存在'});
		}

		// 检查过期
		if (user.expirationTime) {
			const now = new Date();
			const exp = new Date(user.expirationTime);
			if (now > exp) {
				return res.status(403).json({success: false, message: '账号已过期'});
			}
		}

		// 将用户信息附在请求上
		req.user = user;
		next();
	} catch (e) {
		console.error('Token verify error:', e);
		return res.status(403).json({success: false, message: 'Token 验证失败'});
	}
}

// ==========================================
// 综合选品配置 (从前端 product_info.js 移植)
// ==========================================
const SELECTION_CONFIG = {
	// 1. 商品卡销量占比 (D2) 配置
	cardShare: {
		rules: [
			{max: 13, msg: '该品的商品卡销量占比过低'},
			{max: 40, msg: '该品的商品卡占比还不错'},
			{max: Infinity, msg: '该品的商品卡占比优秀'},
		],
		// 定义"绿色"状态的阈值 (占比大于多少算好/绿色? 规则未明确定义颜色的阈值，这里假设 > 40 为优秀/绿色)
		greenThreshold: 40,
		// 定义"红色"状态的阈值 (占比小于多少算差/红色?)
		redThreshold: 13,
	},

	// 2. 商品卡日均销售单数 (E2) 配置
	cardDaily: {
		rules: [
			{max: 100, msg: '商品卡日销量较低', color: '#ff4d4f'}, // 红色
			{max: 300, msg: '商品卡日销量为一般'},
			{max: 500, msg: '商品卡日销量不错'},
			{max: Infinity, msg: '商品卡日销量很好'},
		],
		// 特殊绿色逻辑 (满足任一条件即为绿色)
		greenConditions: [
			{shareMax: 13, dailyMin: 500}, // 占比 < 13% 且 日销量 > 500
			{shareMin: 13, dailyMin: 200}, // 占比 >= 13% 且 日销量 > 200
		],
	},

	// 3. 直播出单规格 (specDiff) 配置
	// y值占位符: {y} 会被替换为实际计算出的y值
	liveSpec: {
		rules: [
			// 负数区间 (亏损/低规格)
			// "小于-5" (<= -5) -> 包含最大值: true
			{
				max: -5,
				includeMax: true,
				msg: '出单大部分严重亏损，佣金高于{y}元，才能盈利，请谨慎选品。',
				color: '#ff4d4f',
			}, // 红色
			// "大于-5且小于等于-2" -> 不包含最小值 (默认), 包含最大值: true
			{
				min: -5,
				max: -2,
				includeMax: true,
				msg: '出单大部分为低规格，且亏损，佣金高于{y}元，才能盈利，请谨慎选品',
			},
			// "大于-2且小于0" -> 默认开区间 (不包含端点)
			{min: -2, max: 0, msg: '出单大部分为低规格，佣金高于{y}元，才能盈利。'},

			// 正数区间 (利润品)
			// "大于4且小于10" -> 默认开区间 (不包含端点)
			{
				min: 4,
				max: 10,
				msg: '出单大部分为中等规格，可作为利润品',
				color: '#25c260',
			}, // 绿色
			// "大于等于10且小于20" -> 包含最小值: true
			{
				min: 10,
				max: 20,
				includeMin: true,
				msg: '出单大部分为高规格，可作为利润品。',
				color: '#25c260',
			}, // 绿色
			// "大于等于20" -> 包含最小值: true
			{
				min: 20,
				includeMin: true,
				msg: '出单大部分为超高规格，可作为高额利润品。',
				color: '#25c260',
			}, // 绿色
		],
	},

	// 4. 综合评价配置
	overall: {
		good: {
			html: '<span style="color:#25c260; font-weight:bold;">👍 带利润的好品！</span>',
			status: 'good',
		},
		passed: {
			html: '<span style="color:#25c260; font-weight:bold;">✅ 已通过初筛</span>',
			status: 'passed',
		},
		bad: {
			html: '<span style="color:#ff4d4f; font-weight:bold;">⚠️ 出单少且亏，请谨慎选择！</span>',
			status: 'bad',
		},
	},
};

/**
 * 计算选品数据统计
 * @param {Object} data 原始数据
 * @param {Number} days 天数
 * @param {Number|String} productPrice 商品价格
 * @param {String} promotionId 推广ID
 * @returns {Object} 统计结果
 */
function calculateStats(data, days, productPrice, promotionId) {
	const promo = data?.model?.promotion_data?.calculate_data || {};
	const content = data?.model?.content_data?.calculate_data || {};

	// A4: 总销量
	const totalSales = promo.sales || 0;
	// sales_amount: 总销售额
	const totalAmount = promo.sales_amount || 0;

	// C3-C6: 各渠道销量
	const liveSales = content.live_sales || 0;
	const videoSales = content.video_sales || 0;
	const imageTextSales = content.image_text_sales || 0;
	const bindShopSales = content.bind_shop_sales || 0;

	// C2: 商品卡销量 = A4 - C3 - C4 - C5 - C6
	const productCardSales =
		totalSales - liveSales - videoSales - imageTextSales - bindShopSales;

	// C3-C6 销售额: 各渠道销售额
	const liveAmount = content.live_sales_amount || 0;
	const videoAmount = content.video_sales_amount || 0;
	const imageTextAmount = content.image_text_sales_amount || 0;
	const bindShopAmount = content.bind_shop_sales_amount || 0;

	const productCardAmount =
		totalAmount - liveAmount - videoAmount - imageTextAmount - bindShopAmount;

	// 除法辅助函数 (被除数为0时返回0)
	const safeDiv = (a, b) => (b === 0 ? 0 : a / b);

	// D列: 销售占比 (销量 / 总销量 A4)
	const getShare = (val) => safeDiv(val, totalSales);
	const getSharePct = (val) => (getShare(val) * 100).toFixed(2) + '%';

	// E列: 日均销量 (销量 / 天数)
	const getDaily = (val) => safeDiv(val, days);
	const getDailyStr = (val) => getDaily(val).toFixed(2);

	// F列: 平均客单价 (销售额 / 销量)
	const getPriceNum = (amount, vol) => safeDiv(amount / 100, vol);
	const getPriceStr = (amount, vol) => getPriceNum(amount, vol).toFixed(2);

	// 表格所需数据
	const stats = {
		card: {
			vol: productCardSales,
			share: getShare(productCardSales), // 原始比率
			daily: getDaily(productCardSales), // 原始数值
			price: getPriceNum(productCardAmount, productCardSales),
		},
		live: {
			vol: liveSales,
			daily: getDaily(liveSales),
			price: getPriceNum(liveAmount, liveSales),
		},
		// ... 其他用于循环的数据
	};

	// 1. 直播出单规格 (specDiff) 逻辑
	const liveMatchOrderNum = content.live_match_order_num || 0;
	const liveSalesDiff = safeDiv(liveSales, liveMatchOrderNum);

	// 2. 规格计算 (y值)
	let productPriceRaw = productPrice || 0;
	if (typeof productPriceRaw === 'string') {
		productPriceRaw = parseFloat(productPriceRaw.replace(/[^\d.]/g, '')) || 0;
	}
	productPriceRaw = productPriceRaw; // 转换为元

	const livePriceVal = stats.live.price;
	// "直播出单规格" 对应变量 specDiff
	const specDiff = livePriceVal - productPriceRaw;

	// 计算 y 值
	const yValue = (0 - specDiff) / 0.9;
	const yStr = yValue.toFixed(2);

	// 选品建议逻辑
	let adviceList = [];
	let goodSignals = 0;
	let badSignals = 0;

	// --- 1. 商品卡销量占比 (D2) 逻辑 ---
	const d2Pct = stats.card.share * 100;
	let d2Msg = '';

	// 查找符合 D2 的规则
	for (const rule of SELECTION_CONFIG.cardShare.rules) {
		if (d2Pct < rule.max) {
			d2Msg = rule.msg;
			break;
		}
	}
	adviceList.push({msg: d2Msg, type: 'share'});

	// 确定用于综合逻辑的占比颜色状态
	const isD2Green = d2Pct > SELECTION_CONFIG.cardShare.greenThreshold;
	const isD2Red = d2Pct < SELECTION_CONFIG.cardShare.redThreshold;

	// --- 2. 商品卡日均销售单数 (E2) 逻辑 ---
	const e2 = stats.card.daily;
	let e2Msg = '';
	let e2Color = '#e0e0e0';

	// 查找符合 E2 的规则
	for (const rule of SELECTION_CONFIG.cardDaily.rules) {
		if (e2 < rule.max) {
			e2Msg = rule.msg;
			if (rule.color) {
				e2Color = rule.color;
				if (rule.color === '#ff4d4f') badSignals++;
			}
			break;
		}
	}

	// 基于特殊条件计算 E2 绿色逻辑
	let isE2Green = false;
	for (const cond of SELECTION_CONFIG.cardDaily.greenConditions) {
		// 检查条件是否匹配
		// 条件: { shareMax: 13, dailyMin: 500 } -> 如果 d2 < 13 且 e2 > 500
		// 条件: { shareMin: 13, dailyMin: 200 } -> 如果 d2 >= 13 且 e2 > 200

		let match = true;
		if (cond.shareMax !== undefined && d2Pct >= cond.shareMax) match = false;
		if (cond.shareMin !== undefined && d2Pct < cond.shareMin) match = false;
		if (cond.dailyMin !== undefined && e2 <= cond.dailyMin) match = false;

		if (match) {
			isE2Green = true;
			break;
		}
	}

	if (isE2Green) {
		e2Color = '#25c260'; // 绿色
		goodSignals++;
	}

	const isE2Red = e2Color === '#ff4d4f'; // 已在规则循环中确定
	adviceList.push({msg: e2Msg, type: 'daily'});

	// --- 3. 直播出单规格 (specDiff) 逻辑 ---
	let specMsg = '';
	let specColor = '#e0e0e0';
	let isSpecGreen = false;
	let isSpecRed = false;

	// 查找符合规格的规则
	for (const rule of SELECTION_CONFIG.liveSpec.rules) {
		let matchMin = true;
		let matchMax = true;

		if (rule.min !== undefined) {
			// 默认不包含最小值 (> min)，除非指定 includeMin: true
			if (rule.includeMin) {
				if (specDiff < rule.min) matchMin = false;
			} else {
				if (specDiff <= rule.min) matchMin = false;
			}
		}

		if (rule.max !== undefined) {
			// 默认不包含最大值 (< max)，除非指定 includeMax: true
			if (rule.includeMax) {
				if (specDiff > rule.max) matchMax = false;
			} else {
				if (specDiff >= rule.max) matchMax = false;
			}
		}

		if (matchMin && matchMax) {
			specMsg = rule.msg.replace('{y}', yStr);
			if (rule.color) {
				specColor = rule.color;
				if (rule.color === '#ff4d4f') {
					isSpecRed = true;
					badSignals++;
				}
				if (rule.color === '#25c260') {
					isSpecGreen = true;
					goodSignals++;
				}
			}
			break; // 找到匹配规则
		}
	}

	// 兜底逻辑
	if (!specMsg) specMsg = `直播出单规格: ${specDiff.toFixed(2)}`;
	adviceList.push({msg: specMsg, type: 'spec', color: specColor || ''});

	// --- 4. 综合推荐逻辑 ---
	let overallHtml = '';
	let overallStatus = 'normal';

	// 新增状态：已通过初筛 (直播人均出单数 > 10 && 直播出单规格 > 0)
	const isPassedInitial = liveSalesDiff > 10 && specDiff > 0;

	if (isD2Green && isE2Green && isSpecGreen) {
		overallHtml = SELECTION_CONFIG.overall.good.html;
		overallStatus = SELECTION_CONFIG.overall.good.status;
	} else if (isPassedInitial) {
		overallHtml = SELECTION_CONFIG.overall.passed.html;
		overallStatus = SELECTION_CONFIG.overall.passed.status;
	} else if (isD2Red && isE2Red && isSpecRed) {
		overallHtml = SELECTION_CONFIG.overall.bad.html;
		overallStatus = SELECTION_CONFIG.overall.bad.status;
	}

	return {
		totalSales,
		days,
		channels: [
			{
				name: '商品卡',
				vol: stats.card.vol,
				share: getSharePct(stats.card.vol),
				daily: stats.card.daily.toFixed(2),
				dailyColor: e2Color,
				price: stats.card.price.toFixed(2),
			},
			{
				name: '直播',
				vol: liveSales,
				share: getSharePct(liveSales),
				daily: getDailyStr(liveSales),
				price: getPriceStr(liveAmount, liveSales),
			},
			{
				name: '短视频',
				vol: videoSales,
				share: getSharePct(videoSales),
				daily: getDailyStr(videoSales),
				price: getPriceStr(videoAmount, videoSales),
			},
			{
				name: '图文',
				vol: imageTextSales,
				share: getSharePct(imageTextSales),
				daily: getDailyStr(imageTextSales),
				price: getPriceStr(imageTextAmount, imageTextSales),
			},
			{
				name: '橱窗',
				vol: bindShopSales,
				share: getSharePct(bindShopSales),
				daily: getDailyStr(bindShopSales),
				price: getPriceStr(bindShopAmount, bindShopSales),
			},
		],
		extraStats: {
			liveSalesDiff: {
				val: liveSalesDiff.toFixed(2),
				formula: `${liveSales} / ${liveMatchOrderNum}`,
			},
			specStat: {
				val: specDiff,
				y: yValue,
				formula: `${livePriceVal.toFixed(2)} - ${productPriceRaw.toFixed(2)}`,
			},
		},
		advice: adviceList,
		overallHtml,
		overallStatus,
	};
}

// 定义路由
router.post('/calculate_stats', verifyToken, (req, res) => {
	try {
		// 解构请求体参数
		const {data, days, productPrice, promotionId} = req.body;

		// 简单参数校验
		if (!data) {
			return res.status(400).json({success: false, message: 'Missing data'});
		}

		const result = calculateStats(data, days, productPrice, promotionId);
		res.json({success: true, data: result});
	} catch (error) {
		console.error('API calculate_stats error:', error);
		res.status(500).json({success: false, message: 'Internal Server Error'});
	}
});

module.exports = router;
