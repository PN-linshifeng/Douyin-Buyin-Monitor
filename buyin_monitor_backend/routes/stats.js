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
// 综合选品配置 (从前端 product_info.js 移植)
// ==========================================
const SELECTION_CONFIG = {
	// 1. 商品卡销量占比 (D2) 配置
	cardShare: {
		rules: [
			{max: 13, msg: '该品的商品卡销量占比过低', type: 'share'},
			{max: 40, msg: '该品的商品卡占比还不错', type: 'share'},
			{max: Infinity, msg: '该品的商品卡占比优秀', type: 'share'},
		],
		greenThreshold: 40,
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
				color: '#ff4d4f', // Red
			},
			// "大于-5且小于等于-2" -> 不包含最小值 (默认), 包含最大值: true
			{
				min: -5,
				max: -2,
				includeMax: true,
				msg: '出单大部分为低规格，且亏损，佣金高于{y}元，才能盈利，请谨慎选品',
				color: '#ff4d4f', // [NEW] Red
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

		// 1. 计算基础统计数据 (标准逻辑)
		// 我们复用基础提取逻辑，但可能需要更细粒度的数据用于自定义规则。
		// 目前，我们先调用 calculateStats 获取基础指标 (D2, E2, SpecDiff 等)
		// 然后在此基础上应用自定义的综合逻辑。
		// 实际上，calculateStats 已经做了很多建议生成工作。
		// 我们应该从 "建议生成" 中提取 "指标计算"。
		// 但为了最小化重构风险，我们可以先调用 calculateStats，如果存在自定义配置，则覆盖 'overallStatus' / 'advice'。

		let result = calculateStats(data, days, productPrice, promotionId);
		const userConfigStr = req.user.selectionConfig;

		if (userConfigStr) {
			try {
				const userConfig = JSON.parse(userConfigStr);
				/*
                 用户配置结构预期:
                 {
                    rules: [
                        { field: 'cardShare', operator: '<', value: 13, msg: '...', color: 'red', status: 'bad' },
                        ...
                    ],
                    overall: {
                        good: { requiredGood: 2, requiredPassed: 0, ... }, // 逻辑示例: "如果 2 个指标为 GOOD"
                        // 或者用户定义的组合？
                        // 简单方法符合需求: "选择特定状态 => Good"
                        // 实现:
                        // 1. 针对指标评估每个单独的规则。
                        // 2. 收集状态 (如 D2=bad, E2=good, Spec=passed)。
                        // 3. 针对收集的状态评估综合配置。
                    }
                 }
                */

				// --- A. 基于自定义规则重新评估各单项指标 ---

				// [修复] 从 calculateStats 中清除默认颜色，以确保只有自定义规则应用颜色
				if (result.channels) {
					result.channels.forEach((ch) => {
						delete ch.dailyColor;
						delete ch.dailyStyle; // Assuming we might have added this earlier or calculateStats did
					});
				}

				// 我们需要 result 中的原始指标
				// result.channels 是数组: [Card, Live, Video, ImageText, Shop]
				// 我们需要将它们映射到键: card_vol, card_share 等。

				const metrics = {};
				const channelMap = {
					商品卡: 'card',
					直播: 'live',
					短视频: 'video',
					图文: 'imageText',
					橱窗: 'bindShop',
				};
				// 将前缀映射到渠道索引以进行颜色注入
				const prefixToChannelIndex = {
					card: 0,
					live: 1,
					video: 2,
					imageText: 3,
					bindShop: 4,
				};

				if (result.channels) {
					result.channels.forEach((ch) => {
						const keyPrefix = channelMap[ch.name];
						if (keyPrefix) {
							metrics[`${keyPrefix}_vol`] = parseFloat(ch.vol) || 0;
							metrics[`${keyPrefix}_share`] = parseFloat(ch.share) || 0; // "12.34%" -> 12.34
							metrics[`${keyPrefix}_daily`] = parseFloat(ch.daily) || 0;
							metrics[`${keyPrefix}_price`] = parseFloat(ch.price) || 0;
						}
					});
				}

				// 遗留与特殊支持
				metrics['liveSpec'] = result.extraStats.specStat.val; // Number
				metrics['liveSalesDiff'] =
					parseFloat(result.extraStats.liveSalesDiff.val) || 0;
				metrics['totalSales'] = result.totalSales;
				// 遗留键用于向后兼容（如果保存了任何旧规则）
				metrics['cardShare'] = metrics['card_share'];
				metrics['cardDaily'] = metrics['card_daily'];

				// 可配置规则应用
				// 我们将清除默认建议和状态
				let customAdvice = [];
				let metricStatuses = []; // ['good', 'bad', 'passed', ...]

				// 评估单条规则的辅助逻辑
				// 规则: { target: 'cardShare', op: '<', val: 13, msg: 'Low', color: 'red', status: 'bad' }
				if (Array.isArray(userConfig.rules)) {
					//按目标对规则进行分组以找到第一个匹配项？
					// 通常规则引擎每个目标匹配第一个有效规则。
					const rulesByTarget = {};
					userConfig.rules.forEach((r) => {
						if (!rulesByTarget[r.target]) rulesByTarget[r.target] = [];
						rulesByTarget[r.target].push(r);
					});

					// 逐个目标评估
					// 收集规则中的所有唯一目标
					const targets = Object.keys(rulesByTarget);

					for (const target of targets) {
						let rules = rulesByTarget[target];
						if (!rules) continue;

						// [修复] 对规则进行排序以确保优先级正确 (最严格的优先)
						// 对于 '>'/'>=': 降序 (大值优先)。例如：先检查 > 40，再检查 > 10
						// 对于 '<'/'<=': 升序 (小值优先)。例如：先检查 < 10，再检查 < 40
						rules.sort((a, b) => {
							const valA = parseFloat(a.val);
							const valB = parseFloat(b.val);
							if (isNaN(valA) || isNaN(valB)) return 0;

							// Detect direction based on operator of A
							// Assuming mixed operators for same target is rare/handled by distinct logic,
							// but here we prioritize based on A's operator.
							if (a.op === '>' || a.op === '>=') {
								return valB - valA; // Descending
							} else if (a.op === '<' || a.op === '<=') {
								return valA - valB; // Ascending
							}
							return 0;
						});

						const val = metrics[target];
						// 如果找不到指标 (undefined) 则跳过
						if (val === undefined) continue;

						let matched = false;

						for (const rule of rules) {
							let isHit = false;
							const threshold = parseFloat(rule.val);
							if (isNaN(threshold)) continue;

							// 运算符: <, <=, >, >=
							switch (rule.op) {
								case '<':
									isHit = val < threshold;
									break;
								case '<=':
									isHit = val <= threshold;
									break;
								case '>':
									isHit = val > threshold;
									break;
								case '>=':
									isHit = val >= threshold;
									break;
								case 'range': // val >= min && val < max (custom)
									if (rule.min !== undefined && rule.max !== undefined) {
										isHit = val >= rule.min && val < rule.max;
									}
									break;
							}

							if (isHit) {
								matched = true;
								// 添加建议
								if (rule.msg) {
									customAdvice.push({
										msg: rule.msg,
										color: rule.color,
										type: target,
									});
								}
								// 收集状态
								if (rule.status) {
									metricStatuses.push(rule.status); // good, passed, bad
								}

								// [新] 将颜色注入表格数据
								if (rule.color) {
									const match = target.match(
										/^([a-zA-Z]+)_(vol|share|daily|price)$/
									);
									if (match) {
										const prefix = match[1];
										const type = match[2];
										const chIndex = prefixToChannelIndex[prefix];
										if (chIndex !== undefined && result.channels[chIndex]) {
											result.channels[chIndex][`${type}Color`] = rule.color;
											// Ensure font weight is bold if colored
											result.channels[chIndex][
												`${type}Style`
											] = `color: ${rule.color}; font-weight: bold;`;
										}
									} else {
										// 处理标量指标
										if (target === 'totalSales') {
											result.totalSalesColor = rule.color;
										} else if (target === 'liveSpec') {
											if (!result.extraStats.specStat)
												result.extraStats.specStat = {};
											result.extraStats.specStat.color = rule.color;
										} else if (target === 'liveSalesDiff') {
											if (!result.extraStats.liveSalesDiff)
												result.extraStats.liveSalesDiff = {};
											result.extraStats.liveSalesDiff.color = rule.color;
										}
									}
								}

								break; // 匹配到第一个后停止
							}
						}
					}
				}

				// --- B. 重新评估综合状态 ---
				// 需求: "选择几个状态为 Good..."
				// 逻辑: 检查用户定义的计数/状态组合。
				// 例如 overall_rules: [
				//    { result: 'good', conditions: { good: 2 } }, // 至少 2 个 good
				//    { result: 'bad', conditions: { bad: 1 } }    // 至少 1 个 bad
				// ]
				// 我们需要优先级。通常 Bad > Good? 还是第一个匹配?
				// 假设列表中的顺序很重要。

				let newOverallStatus = 'normal'; // 默认
				let newOverallHtml = '';

				if (Array.isArray(userConfig.overall_rules)) {
					// [修复] 按优先级排序规则: good > passed > bad
					// 用户要求: "先检查good、在检查passed，最后检查bad"
					const priorityMap = {good: 1, passed: 2, bad: 3};
					userConfig.overall_rules.sort((a, b) => {
						const pa = priorityMap[a.result] || 99;
						const pb = priorityMap[b.result] || 99;
						return pa - pb;
					});

					const counts = {good: 0, passed: 0, bad: 0};
					metricStatuses.forEach((s) => {
						if (counts[s] !== undefined) counts[s]++;
					});

					for (const oRule of userConfig.overall_rules) {
						// oRule: { result: 'good', criteria: { good: 1, passed: 0, bad: 0 }, logic: 'OR'/'AND' }
						// Simplified: "If counts.good >= X AND counts.bad >= Y ..."
						let meets = true;
						if (oRule.criteria) {
							if (oRule.criteria.good && counts['good'] < oRule.criteria.good)
								meets = false;
							// [逻辑调整]
							// 如果规则明确要求 Good 项目 (criteria.good > 0)，则对 Passed 要求进行严格判定 (必须是不同的项目)。
							// 如果规则不要求 Good 项目，则对 Passed 要求进行兼容判定 (Good 项目也可以算作 Passed)。
							// 示例: "Good>=1, Passed>=1" -> 严格模式 (需要 1 个 Good 和 1 个单独的 Passed)。
							// 示例: "Passed>=1" -> 兼容模式 (1 个 Good 也可以算作 1 个 Passed)。
							const useStrictPassed =
								oRule.criteria.good && oRule.criteria.good > 0;
							const passedCheckCount = useStrictPassed
								? counts['passed']
								: counts['passed'] + counts['good'];

							if (
								oRule.criteria.passed &&
								passedCheckCount < oRule.criteria.passed
							)
								meets = false;
							if (oRule.criteria.bad && counts['bad'] < oRule.criteria.bad)
								meets = false;
						}

						if (meets) {
							newOverallStatus = oRule.result; // good, passed, bad
							break;
						}
					}
				} else {
					// 备用：如果没有定义综合规则，则回退到检测到的状态？
					// 或者如果自定义规则不完整，保持 'normal'。
					// 目前，如果没有综合规则，保持 'normal'
				}

				// 将状态映射包含 HTML
				const mapStatusToHtml = (s) => {
					switch (s) {
						case 'good':
							return '<span style="color:#25c260; font-weight:bold;">👍 自定义: 推荐</span>';
						case 'passed':
							return '<span style="color:#25c260; font-weight:bold;">✅ 自定义: 通过</span>';
						case 'bad':
							return '<span style="color:#ff4d4f; font-weight:bold;">⚠️ 自定义: 不推荐</span>';
						default:
							return '<span>自定义: 一般</span>';
					}
				};

				// 覆盖结果
				result.advice = customAdvice.length > 0 ? customAdvice : result.advice;
				result.overallStatus = newOverallStatus;
				result.overallHtml = mapStatusToHtml(newOverallStatus);
			} catch (e) {
				console.error('应用自定义规则时出错:', e);
				// 如果不修改 'result'，将自动回退到默认结果
			}
		}

		res.json({success: true, data: result});
	} catch (error) {
		console.error('API get_promotion_status error:', error);
		res.status(500).json({success: false, message: 'Internal Server Error'});
	}
});

module.exports = router;
