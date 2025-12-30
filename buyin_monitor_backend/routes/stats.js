const express = require('express');
const router = express.Router();
const crypto = require('crypto-js');
const User = require('../models/User');

const SECRET_KEY = 'your_secret_key_here'; // 保持与 server.js 一致

// Helper: 解密
function decrypt(cipherText) {
	try {
		const bytes = crypto.AES.decrypt(cipherText, SECRET_KEY);
		return bytes.toString(crypto.enc.Utf8);
	} catch (e) {
		return null;
	}
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
// ==========================================
// 综合选品配置 (默认配置)
// ==========================================
const DEFAULT_SELECTION_CONFIG = {
	rules: [
		// --- 1. 商品卡销量占比 (D2) ---
		{
			target: 'cardShare',
			op: '<',
			val: 13,
			msg: '该品的商品卡销量占比过低',
			type: 'share',
			color: '#ff4d4f',
			status: 'bad',
		},
		{
			target: 'cardShare',
			op: '<',
			val: 40,
			msg: '该品的商品卡占比还不错',
			type: 'share',
		},
		{
			target: 'cardShare',
			op: '>=',
			val: 40,
			msg: '该品的商品卡占比优秀',
			type: 'share',
			color: '#25c260',
			status: 'good',
		},

		// --- 2. 商品卡日均销售单数 (E2) ---
		// 绿色特殊逻辑 (优先级较高，放在前面)
		{
			conditions: [
				{target: 'cardShare', op: '<', val: 13},
				{target: 'cardDaily', op: '>', val: 500},
			],
			msg: '商品卡日销量很不错',
			type: 'daily',
			color: '#25c260',
			status: 'good',
		},
		{
			conditions: [
				{target: 'cardShare', op: '>=', val: 13},
				{target: 'cardDaily', op: '>', val: 200},
			],
			msg: '商品卡日销量很不错',
			type: 'daily',
			color: '#25c260',
			status: 'good',
		},
		// 常规阈值逻辑
		{
			target: 'cardDaily',
			op: '<',
			val: 100,
			msg: '商品卡日销量较低',
			color: '#ff4d4f',
			status: 'bad',
			type: 'daily',
		},
		{
			target: 'cardDaily',
			op: '<',
			val: 300,
			msg: '商品卡日销量为一般',
			type: 'daily',
		},
		{
			target: 'cardDaily',
			op: '<',
			val: 500,
			msg: '商品卡日销量不错',
			type: 'daily',
		},
		{
			target: 'cardDaily',
			op: '>=',
			val: 500,
			msg: '商品卡日销量很好',
			type: 'daily',
		},

		// --- 3. 直播出单规格 (specDiff) ---
		{
			target: 'liveSpec',
			op: '<=',
			val: -5,
			msg: '出单大部分严重亏损，佣金高于{y}元，才能盈利，请谨慎选品。',
			color: '#ff4d4f',
			status: 'bad',
			type: 'spec',
		},
		{
			target: 'liveSpec',
			op: '<=',
			val: -2,
			msg: '出单大部分为低规格，且亏损，佣金高于{y}元，才能盈利，请谨慎选品',
			color: '#ff4d4f',
			status: 'bad',
			type: 'spec',
		},
		{
			target: 'liveSpec',
			op: '<',
			val: 0,
			msg: '出单大部分为低规格，佣金高于{y}元，才能盈利。',
			type: 'spec',
		},
		{
			conditions: [
				{target: 'liveSpec', op: '>', val: 4},
				{target: 'liveSpec', op: '<', val: 10},
			],
			msg: '出单大部分为中等规格，可作为利润品',
			color: '#25c260',
			status: 'good',
			type: 'spec',
		},
		{
			conditions: [
				{target: 'liveSpec', op: '>=', val: 10},
				{target: 'liveSpec', op: '<', val: 20},
			],
			msg: '出单大部分为高规格，可作为利润品。',
			color: '#25c260',
			status: 'good',
			type: 'spec',
		},
		{
			target: 'liveSpec',
			op: '>=',
			val: 20,
			msg: '出单大部分为超高规格，可作为高额利润品。',
			color: '#25c260',
			status: 'good',
			type: 'spec',
		},
	],
	overall_rules: [
		{
			result: 'good',
			criteria: {good: 3}, // 3 good signals
		},
		{
			result: 'passed',
			conditions: [
				{target: 'liveSalesDiff', op: '>', val: 10},
				{target: 'liveSpec', op: '>', val: 0},
			],
		},
		{
			result: 'bad',
			criteria: {bad: 3}, // 3 bad signals
		},
	],
	status_config: {
		good: {
			html: '<span style="color:#25c260; font-weight:bold;">👍 带利润的好品！</span>',
		},
		passed: {
			html: '<span style="color:#25c260; font-weight:bold;">✅ 已通过初筛</span>',
		},
		bad: {
			html: '<span style="color:#ff4d4f; font-weight:bold;">⚠️ 出单少且亏，请谨慎选择！</span>',
		},
		normal: {html: '<span></span>'},
	},
};

/**
 * 辅助：检查运算符
 */
function checkOp(val, op, threshold) {
	const v = parseFloat(val);
	const t = parseFloat(threshold);
	if (isNaN(v) || isNaN(t)) return false;

	switch (op) {
		case '<':
			return v < t;
		case '<=':
			return v <= t;
		case '>':
			return v > t;
		case '>=':
			return v >= t;
		case '=':
		case '==':
		case '===':
			return v === t;
		default:
			return false;
	}
}

/**
 * 通用统计评估引擎
 * @param {Object} metrics 统计指标
 * @param {Object} config 配置对象
 */
function evaluateStats(metrics, config) {
	if (!config) config = DEFAULT_SELECTION_CONFIG;

	const advice = [];
	const metricStatuses = [];
	const statusCounts = {good: 0, bad: 0, passed: 0};
	const colors = {}; // type/target -> color

	const matchedTargets = new Set();
	const rules = config.rules || [];

	// 1. 评估 Rules
	for (const rule of rules) {
		let isHit = true;
		const key = rule.type || rule.target;

		// 如果该维度已匹配高优先级规则，跳过
		if (key && matchedTargets.has(key)) continue;

		if (rule.conditions && Array.isArray(rule.conditions)) {
			// 复合条件 (AND)
			for (const cond of rule.conditions) {
				const val = metrics[cond.target];
				if (val === undefined || !checkOp(val, cond.op, cond.val)) {
					isHit = false;
					break;
				}
			}
		} else if (rule.target) {
			// 单一条件
			const val = metrics[rule.target];
			if (val === undefined || !checkOp(val, rule.op, rule.val)) {
				isHit = false;
			}
		} else {
			isHit = false;
		}

		if (isHit) {
			if (key) matchedTargets.add(key);

			// 记录状态
			if (rule.status) {
				metricStatuses.push(rule.status);
				if (statusCounts[rule.status] !== undefined)
					statusCounts[rule.status]++;
			}

			// 记录颜色
			if (rule.color && key) {
				colors[key] = rule.color;
			}

			// 记录建议
			if (rule.msg) {
				let msg = rule.msg;
				// 变量替换 {y} -> metrics['y']
				msg = msg.replace(/\{(\w+)\}/g, (_, v) => {
					return metrics[v] !== undefined
						? metrics[v]
						: metrics['extraStats'] && metrics['extraStats'][v] !== undefined
						? metrics['extraStats'][v]
						: `{${v}}`;
				});

				advice.push({
					msg: msg,
					type: rule.type || rule.target,
					color: rule.color,
				});
			}
		}
	}

	// 2. 评估 Overall Status
	let overallStatus = 'normal';
	const overallRules = config.overall_rules || [];

	for (const oRule of overallRules) {
		let meets = true;

		// 检查指标条件
		if (oRule.conditions) {
			for (const cond of oRule.conditions) {
				const val = metrics[cond.target];
				if (val === undefined || !checkOp(val, cond.op, cond.val)) {
					meets = false;
					break;
				}
			}
		}

		// 检查计数条件
		if (meets && oRule.criteria) {
			for (const [sKey, minCount] of Object.entries(oRule.criteria)) {
				if ((statusCounts[sKey] || 0) < minCount) {
					meets = false;
					break;
				}
			}
		}

		if (meets) {
			overallStatus = oRule.result;
			break; // 优先级顺序：第一个匹配的生效
		}
	}

	// 获取 HTML
	const statusCfg =
		config.status_config || DEFAULT_SELECTION_CONFIG.status_config;
	const overallHtml =
		(statusCfg[overallStatus] && statusCfg[overallStatus].html) || '';

	return {advice, overallStatus, overallHtml, metricStatuses, colors};
}

/**
 * 辅助：计算原始指标
 */
function calculateRawMetrics(data, days, productPrice) {
	const promo = data?.model?.promotion_data?.calculate_data || {};
	const content = data?.model?.content_data?.calculate_data || {};

	// 基础数据
	const totalSales = promo.sales || 0;
	const totalAmount = promo.sales_amount || 0;

	const liveSales = content.live_sales || 0;
	const videoSales = content.video_sales || 0;
	const imageTextSales = content.image_text_sales || 0;
	const bindShopSales = content.bind_shop_sales || 0;

	const productCardSales =
		totalSales - liveSales - videoSales - imageTextSales - bindShopSales;

	const liveAmount = content.live_sales_amount || 0;
	const videoAmount = content.video_sales_amount || 0;
	const imageTextAmount = content.image_text_sales_amount || 0;
	const bindShopAmount = content.bind_shop_sales_amount || 0;

	const productCardAmount =
		totalAmount - liveAmount - videoAmount - imageTextAmount - bindShopAmount;

	// 辅助
	const safeDiv = (a, b) => (b === 0 ? 0 : a / b);
	const getShare = (val) => safeDiv(val, totalSales); // ratio 0-1
	const getDaily = (val) => safeDiv(val, days);
	const getPriceNum = (amount, vol) => safeDiv(amount / 100, vol);

	// Live Spec
	const liveMatchOrderNum = content.live_match_order_num || 0;
	const liveSalesDiff = safeDiv(liveSales, liveMatchOrderNum);

	let productPriceRaw = productPrice || 0;
	if (typeof productPriceRaw === 'string') {
		productPriceRaw = parseFloat(productPriceRaw.replace(/[^\d.]/g, '')) || 0;
	}

	const livePriceVal = getPriceNum(liveAmount, liveSales);
	const specDiff = livePriceVal - productPriceRaw;

	// y value
	const yValue = (0 - specDiff) / 0.9;
	const yStr = yValue.toFixed(2);

	// 构建 Metrics
	// 包含 CamelCase 和 snake_case 以支持不同配置风格
	const metrics = {
		totalSales,
		days,
		liveSalesDiff,
		liveSpec: specDiff,
		y: yStr,
	};

	const channels = [
		{
			key: 'card',
			name: '商品卡',
			vol: productCardSales,
			amt: productCardAmount,
		},
		{key: 'live', name: '直播', vol: liveSales, amt: liveAmount},
		{key: 'video', name: '短视频', vol: videoSales, amt: videoAmount},
		{key: 'imageText', name: '图文', vol: imageTextSales, amt: imageTextAmount},
		{key: 'bindShop', name: '橱窗', vol: bindShopSales, amt: bindShopAmount},
	];

	const rawChannels = [];

	channels.forEach((ch) => {
		const shareRatio = getShare(ch.vol);
		const sharePct = shareRatio * 100;
		const daily = getDaily(ch.vol);
		const price = getPriceNum(ch.amt, ch.vol);

		// Populate metrics
		metrics[`${ch.key}Vol`] = ch.vol;
		metrics[`${ch.key}Share`] = sharePct;
		metrics[`${ch.key}Daily`] = daily;
		metrics[`${ch.key}Price`] = price;

		// snake_case aliases
		metrics[`${ch.key}_vol`] = ch.vol;
		metrics[`${ch.key}_share`] = sharePct;
		metrics[`${ch.key}_daily`] = daily;
		metrics[`${ch.key}_price`] = price;

		rawChannels.push({
			name: ch.name,
			key: ch.key,
			vol: ch.vol,
			share: sharePct.toFixed(2) + '%',
			daily: daily.toFixed(2),
			price: price.toFixed(2),
		});
	});

	// Alias for legacy support
	metrics.cardShare = metrics.card_share;
	metrics.cardDaily = metrics.card_daily;

	return {
		metrics,
		raw: {
			totalSales,
			days,
			channels: rawChannels,
			liveSalesDiff,
			liveMatchOrderNum,
			specDiff,
			yValue,
			livePriceVal,
			productPriceRaw,
		},
	};
}

/**
 * 辅助：格式化最终结果
 */
function formatStatsResult(metricsData, evalResult) {
	const {raw} = metricsData;
	const {colors} = evalResult;

	// 将颜色注入 channels
	raw.channels.forEach((ch) => {
		const types = ['vol', 'share', 'daily', 'price'];
		types.forEach((type) => {
			const targetKey = `${ch.key}_${type}`;
			if (colors[targetKey]) {
				ch[`${type}Color`] = colors[targetKey];
				ch[`${type}Style`] = `color: ${colors[targetKey]}; font-weight: bold;`;
			}
		});

		// Legacy: E2 'daily' color applies to card daily
		if (ch.key === 'card' && colors['daily']) {
			ch.dailyColor = colors['daily'];
		}
	});

	// Extra Stats
	const extraStats = {
		liveSalesDiff: {
			val: raw.liveSalesDiff.toFixed(2),
			formula: `${raw.channels[1].vol} / ${raw.liveMatchOrderNum}`,
		},
		specStat: {
			val: raw.specDiff,
			y: raw.yValue,
			formula: `${raw.livePriceVal.toFixed(2)} - ${raw.productPriceRaw.toFixed(
				2
			)}`,
			color: colors['spec'] || colors['liveSpec'], // Spec color
		},
	};

	if (colors['liveSalesDiff']) {
		extraStats.liveSalesDiff.color = colors['liveSalesDiff'];
	}

	return {
		totalSales: raw.totalSales,
		days: raw.days,
		channels: raw.channels,
		extraStats,
		advice: evalResult.advice,
		overallHtml: evalResult.overallHtml,
		overallStatus: evalResult.overallStatus,
	};
}

/**
 * 计算选品数据统计
 */
function calculateStats(data, days, productPrice, promotionId) {
	const metricsData = calculateRawMetrics(data, days, productPrice);
	const evalResult = evaluateStats(
		metricsData.metrics,
		DEFAULT_SELECTION_CONFIG
	);
	return formatStatsResult(metricsData, evalResult);
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

// ==========================================
// 自定义规则配置 API
// ==========================================

// 保存选品配置
router.post('/save_selection_config', verifyToken, async (req, res) => {
	try {
		const {selection_config} = req.body;
		if (!selection_config) {
			return res.status(400).json({success: false, message: 'Missing config'});
		}

		// Ensure it's valid JSON
		if (typeof selection_config !== 'string') {
			return res
				.status(400)
				.json({success: false, message: 'Config must be a JSON string'});
		}
		try {
			JSON.parse(selection_config);
		} catch (e) {
			return res.status(400).json({success: false, message: 'Invalid JSON'});
		}

		// Update user
		req.user.selectionConfig = selection_config;
		await req.user.save();

		res.json({success: true, message: 'Saved successfully'});
	} catch (error) {
		console.error('API save_selection_config error:', error);
		res.status(500).json({success: false, message: 'Internal Server Error'});
	}
});

// 获取选品配置
router.get('/get_selection_config', verifyToken, async (req, res) => {
	try {
		let configStr = req.user.selectionConfig;
		// If empty, return null or empty object? Returning null lets frontend decide default.
		res.json({
			success: true,
			selection_config: configStr || null,
		});
	} catch (error) {
		console.error('API get_selection_config error:', error);
		res.status(500).json({success: false, message: 'Internal Server Error'});
	}
});

/**
 * 高级动态推广状态计算
 * 如果可用，使用用户的自定义配置，否则回退到默认值。
 */
router.post('/get_promotion_status', verifyToken, async (req, res) => {
	try {
		const {data, days, productPrice, promotionId} = req.body;
		const userConfigStr = req.user.selectionConfig;
		let config = DEFAULT_SELECTION_CONFIG;

		if (userConfigStr) {
			try {
				config = JSON.parse(userConfigStr);
			} catch (e) {
				console.error('Failed to parse user config:', e);
			}
		}

		const metricsData = calculateRawMetrics(data, days, productPrice);
		const evalResult = evaluateStats(metricsData.metrics, config);
		const result = formatStatsResult(metricsData, evalResult);

		res.json({success: true, data: result});
	} catch (error) {
		console.error('API get_promotion_status error:', error);
		res.status(500).json({success: false, message: 'Internal Server Error'});
	}
});

module.exports = router;
