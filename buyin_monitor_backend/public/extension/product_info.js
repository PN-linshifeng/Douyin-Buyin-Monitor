(function () {
	console.log(
		'%c [Douyin Monitor] ProductInfo Module Loaded',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	const pendingRequests = new Map();

	// 监听 API 结果
	window.addEventListener(
		'message',
		function (event) {
			if (event.source !== window) return;

			// 处理请求结果
			if (event.data.type === 'DOUYIN_MONITOR_FETCH_RESULT') {
				const {requestId, success, data, error} = event.data;
				if (pendingRequests.has(requestId)) {
					const {resolve, reject} = pendingRequests.get(requestId);
					pendingRequests.delete(requestId);
					if (success) {
						resolve(data);
					} else {
						reject(new Error(error));
					}
				}
			}
		},
		false
	);

	/**
	 * 让元素可拖拽
	 */
	function makeDraggable(element, handle) {
		handle = handle || element;
		handle.style.cursor = 'move';

		let isDragging = false;
		let startX, startY, initialLeft, initialTop;

		handle.onmousedown = function (e) {
			e.preventDefault();
			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;

			const rect = element.getBoundingClientRect();
			initialLeft = rect.left;
			initialTop = rect.top;

			element.style.position = 'fixed';
			element.style.left = initialLeft + 'px';
			element.style.top = initialTop + 'px';
			element.style.right = 'auto';
			element.style.bottom = 'auto';
			element.style.margin = '0';
			element.style.transform = 'none';

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		};

		function onMouseMove(e) {
			if (!isDragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			element.style.left = initialLeft + dx + 'px';
			element.style.top = initialTop + dy + 'px';
		}

		function onMouseUp() {
			isDragging = false;
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}
	}

	function sendInjectedRequest(url, body) {
		return new Promise((resolve, reject) => {
			const requestId = Date.now() + '_' + Math.random();
			pendingRequests.set(requestId, {resolve, reject});

			window.postMessage(
				{
					type: 'DOUYIN_MONITOR_FETCH',
					payload: {
						requestId,
						url,
						body,
					},
				},
				'*'
			);

			setTimeout(() => {
				if (pendingRequests.has(requestId)) {
					pendingRequests.delete(requestId);
					reject(new Error('Request timeout'));
				}
			}, 15000);
		});
	}

	async function fetchProductData(
		biz_id,
		decision_enter_from = 'pc.selection_square.recommend_main'
	) {
		const newBodyObj = {
			scene_info: {
				request_page: 2,
			},
			biz_id: biz_id,
			biz_id_type: 2,
			enter_from: decision_enter_from,
			data_module: 'core',
			extra: {
				// use_kol_product: '1',
			},
		};
		const bodyStr = JSON.stringify(newBodyObj);
		const targetUrlBase = `https://buyin.jinritemai.com/pc/selection/decision/pack_detail`;

		return sendInjectedRequest(targetUrlBase, bodyStr);
	}

	// ==========================================
	// 综合选品配置 (可修改此处参数和文案)
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
				{max: 100, msg: '商品卡日销量较低', color: '#ff4d4f'}, // Red
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
                // "小于-5" (<= -5) -> includeMax: true
				{ max: -5, includeMax: true, msg: '出单大部分严重亏损，佣金高于{y}元，才能盈利，请谨慎选品。', color: '#ff4d4f' }, // Red
                // "小于-2大于-5" (> -5 && <= -2) -> includeMin: false (default), includeMax: true
				{ min: -5, max: -2, includeMax: true, msg: '出单大部分为低规格，且亏损，佣金高于{y}元，才能盈利，请谨慎选品' },
                // "小于0大于-2" (> -2 && < 0) -> default exclusive
				{ min: -2, max: 0, msg: '出单大部分为低规格，佣金高于{y}元，才能盈利。' },
				
				// 正数区间 (利润品)
                // "大于4小于10" (> 4 && < 10) -> default exclusive
				{ min: 4, max: 10, msg: '出单大部分为中等规格，可作为利润品', color: '#25c260' }, // Green
                // "大于10小于20" (>= 10 && < 20) -> includeMin: true
				{ min: 10, max: 20, includeMin: true, msg: '出单大部分为高规格，可作为利润品。', color: '#25c260' }, // Green
                // "大于20" (>= 20) -> includeMin: true
				{ min: 20, includeMin: true, msg: '出单大部分为超高规格，可作为高额利润品。', color: '#25c260' } // Green
			]
		},

		// 4. 综合评价配置
		overall: {
			good: {
				html: '<span style="color:#25c260; font-weight:bold;">👍 带利润的好品！</span>',
				status: 'good',
			},
			bad: {
				html: '<span style="color:#ff4d4f; font-weight:bold;">⚠️ 出单少且亏，请谨慎选择！</span>',
				status: 'bad',
			},
		},
	};

	async function fetchDataFordays(
		days,
		biz_id,
		decision_enter_from = 'pc.selection_square.recommend_main'
	) {
		let bodyStr = '{}';

		try {
			const newBodyObj = {
				scene_info: {
					request_page: 2,
				},
				other_params: {
					colonel_activity_id: '',
				},
				biz_id: biz_id,
				biz_id_type: 2,
				enter_from: decision_enter_from,
				data_module: 'dynamic',
				dynamic_params: {
					param_type: 9,
					promotion_data_params: {
						time_range: String(days),
					},
					content_data_params: {
						time_range: String(days),
					},
				},
				extra: {},
			};

			bodyStr = JSON.stringify(newBodyObj);
		} catch (e) {
			console.error('Body 构造失败', e);
			throw e;
		}

		console.log(`正在请求 ${days} 天数据 (Via Injected Script)...`);
		const fullUrl = '/pc/selection/decision/pack_detail';
		return sendInjectedRequest(fullUrl, bodyStr);
	}

	function calculateStats(data, days, productData, promotionId) {
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

		// C3-C6 Amount: 各渠道销售额
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

		// 1. Live Sales Diff (直播出单规格) Logic
		const liveMatchOrderNum = content.live_match_order_num || 0;
		const liveSalesDiff = safeDiv(liveSales, liveMatchOrderNum);

		// 2. Spec Calculation (y value)
		let productPriceRaw =
			productData?.data?.model?.product?.product_price?.price_label?.price || 0;
		if (typeof productPriceRaw === 'string') {
			productPriceRaw = parseFloat(productPriceRaw.replace(/[^\d.]/g, '')) || 0;
		}
		productPriceRaw = productPriceRaw / 100; // to Yuan

		const livePriceVal = stats.live.price;
		// "直播出单规格" = specDiff
		const specDiff = livePriceVal - productPriceRaw;

		// y value calculation
		const yValue = (0 - specDiff) / 0.9;
		const yStr = yValue.toFixed(2);

		// Selection Advice Logic
		let adviceList = [];
		let goodSignals = 0;
		let badSignals = 0;

		// --- 1. Product Card Share (D2) Logic ---
		const d2Pct = stats.card.share * 100;
		let d2Msg = '';

		// Find matching rule for D2
		for (const rule of SELECTION_CONFIG.cardShare.rules) {
			if (d2Pct < rule.max) {
				d2Msg = rule.msg;
				break;
			}
		}
		adviceList.push({msg: d2Msg, type: 'share'});

		// Determine Share Color Status for Overall Logic
		const isD2Green = d2Pct > SELECTION_CONFIG.cardShare.greenThreshold;
		const isD2Red = d2Pct < SELECTION_CONFIG.cardShare.redThreshold;

		// --- 2. Product Card Daily Sales (E2) Logic ---
		const e2 = stats.card.daily;
		let e2Msg = '';
		let e2Color = '#e0e0e0';

		// Find matching rule for E2
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

		// Calculate E2 Green Color based on special conditions
		let isE2Green = false;
		for (const cond of SELECTION_CONFIG.cardDaily.greenConditions) {
			// Check if condition matches
			// cond: { shareMax: 13, dailyMin: 500 } -> if d2 < 13 && e2 > 500
			// cond: { shareMin: 13, dailyMin: 200 } -> if d2 >= 13 && e2 > 200

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
			e2Color = '#25c260'; // Green
			goodSignals++;
		}

		const isE2Red = e2Color === '#ff4d4f'; // Already determined by rules loop
		adviceList.push({msg: e2Msg, type: 'daily'});

		// --- 3. Live Spec (specDiff) Logic ---
		let specMsg = '';
		let specColor = '#e0e0e0';
		let isSpecGreen = false;
		let isSpecRed = false;

		// Find matching rule for Spec
		// Sorted check? The config rules need to be checked in order or ranges.
		// SELECTION_CONFIG.liveSpec.rules has mix of max only (negative) and min/max (positive)

		for (const rule of SELECTION_CONFIG.liveSpec.rules) {
			let match = true;
			// Check max (upper bound, exclusive usually for negative in previous code, let's correspond)
			// Previous code: < 0, <= -2, <= -5.
			// Config logic needs to be robust.
			// Let's assume inclusive/exclusive based on standard logic or explicit config.
			// Simplified: if rule has max, check <= max. if rule has min, check >= min.
			// But previous logic was specific: > -5 && <= -2.

			// Let's refine the loop to be first-match for robust ranges?
			// "出单大部分严重亏损" (<= -5) should be checked first?
			// It's safer to check specific ranges.

			if (rule.max !== undefined && specDiff > rule.max) match = false; // logic: if val > max, it doesn't fit "up to max"
			// Wait, previous logic: <= -5. So if specDiff is -6, it matches max: -5.
			// If specDiff is -3, it fails max: -5.
			// BUT, if we just iterate list, order matters.

			// Let's rewrite condition checking to be explicit based on min/max in rule.
			if (rule.min !== undefined && specDiff < rule.min) match = false;
			if (rule.max !== undefined && specDiff >= rule.max) match = false; // Using >= means max is exclusive upper bound?
			// Previous: <= -2. So -2 IS included.
			// Let's adjust:
			// <= -5
			// > -5 && <= -2
			// > -2 && < 0

			// Let's use specific logic for the config structure I designed:
			// "max: -5" -> I need to know if it's <= or <.
			// To support the complexity, I will just hardcode the check logic to match the config's intent.

			// Actually, let's look at the config I wrote:
			// { max: -5 }
			// { max: -2 } -> implies > -5 and <= -2 if ordered?
			// Let's stick to the previous hardcoded logic but pull VALUES from config?
			// The user wanted "Conditions organized".
			// So I should implement a generic range checker.

			// Generic Range Check:
			// value within [min, max).
			// handling open ends (-Infinity, Infinity).

			const min = rule.min !== undefined ? rule.min : -Infinity;
			const max = rule.max !== undefined ? rule.max : Infinity;

			// Check: min < val <= max ?? Or min <= val < max?
			// Rule: <= -5. So (-Inf, -5].
			// Rule: > -5 && <= -2. So (-5, -2].
			// Rule: > -2 && < 0. So (-2, 0).
			// Rule: > 4 && < 10. So (4, 10).
			// Rule: >= 10 && < 20. So [10, 20).
			// Rule: >= 20. So [20, Inf).

			// It varies! :D
			// I will implement a custom check that fits the most common pattern or adds explicit bounds.
			// Let's rely on the config having min/max and use strict comparison for safety, or iterate carefully.

			// Adjusted Loop Strategy:
			// Check if valid.
			if (specDiff >= min && specDiff < max) {
				// Special handling for edge cases mentioned?
				// The previous code had mix of <= and <.
				// Let's try to honor the specific "inclusive/exclusive" nature if possible or simplify.
				// Simplification for maintenance: [min, max).
				// Let's patch config to be fully [min, max) compatible equivalents?
				// <= -5 -> (-Inf, -4.999]? No.
				// Let's just use the config I wrote and interpret:
				// If min defined: val >= min.
				// If max defined: val < max.
				// EXCEPT for the negative ones where previous was <=.
				// Let's look at coverage.
            const min = rule.min !== undefined ? rule.min : NEG_INF;
            const max = rule.max !== undefined ? rule.max : POS_INF;
            
            // Check [min, max) strictly? or mixed?
            // Replicating previous logic precisely:
            // max: -5 -> check <= -5
            // max: -2 -> check > -5 && <= -2
            // max: 0 -> check > -2 && < 0
            
            // This is mixed inclusive/exclusive. 
            // I will implement a custom match function for the refactor to be perfect, 
            // OR I will simply hardcode the condition in the config IF I could (but I can't put functions in JSON easily if user wants to edit text file, forcing them to know JS).
            
            // Let's assume standard [min, max) but handle the specific edge cases by small offsets if user edits?
            // No, better to make the code flexible.
            
            // Let's use the explicit logic derived from "min/max" presence.
            // If only max is present and negative: assume <= max (Legacy red zone)
            // If min and max present: assume min < val < max (Middle zones) or min <= val < max?
            // "GreaterThan -5 AND LessThanEqualTo -2".
            
            // I will use a simplified logic that works for the standard cases:
            // Match if: (min === undefined || specDiff > min) && (specDiff <= max if maxIsInclusive else specDiff < max)
            // Too complex for a simple config object?
            
            // Let's go with:
            // Iterating through the rules sequentially allows simpler "max" checks if sorted.
            // If I sort rules by max value ascending?
            // -5, -2, 0, 4, 10, 20...
            // If val <= -5 -> match first.
            // Else if val <= -2 -> match second.
            // Else if val < 0 -> match third.
            // Else ...
            // This works! Sequential check is powerful.
            
            // But wait, the positive rules are: > 4 && < 10. (So 4 is NOT included? 10 is NOT included?)
            // >= 10 && < 20. (10 IS included).
            
            // I will add `includeMin` and `includeMax` to config to be explicit.
            // User can edit these booleans.
            
            let matchMin = true;
            let matchMax = true;
            
            if (rule.min !== undefined) {
                // Default to inclusive if not specified? Or exclusive? 
                // Previous: > -5 (Exclusive), > -2 (Exclusive), > 4 (Exclusive), >= 10 (Inclusive).
                // Let's default to Exclusive (> min) unless includeMin: true.
                if (rule.includeMin) {
                   if (specDiff < rule.min) matchMin = false;
                } else {
                   if (specDiff <= rule.min) matchMin = false;
                }
            }
            
            if (rule.max !== undefined) {
                // Default to Exclusive (< max) unless includeMax: true.
                // Previous: <= -5 (Inclusive), <= -2 (Inclusive), < 0 (Exclusive), < 10 (Exclusive).
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
                break; // Found match
            }
		}

		// Fallback
		if (!specMsg) specMsg = `直播出单规格: ${specDiff.toFixed(2)}`;
		adviceList.push({msg: specMsg, type: 'spec', color: specColor || ''});
		
		
		// --- 4. Overall Recommendation Logic ---
		let overallHtml = '';
		let overallStatus = 'normal';

		if (isD2Green && isE2Green && isSpecGreen) {
			overallHtml = SELECTION_CONFIG.overall.good.html;
			overallStatus = SELECTION_CONFIG.overall.good.status;
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

	function createTableHtml(stats) {
		const {days, totalSales, channels, extraStats, advice, overallHtml} = stats;
		const rowCard = channels[0];
		const rowLive = channels[1];
		const rowVideo = channels[2];
		const rowImage = channels[3];
		const rowShop = channels[4];
		const {liveSalesDiff, specStat} = extraStats;

		// 生成建议文案的HTML辅助函数
		const adviceHtml = advice
			.map((item) => {
				const color = item.color ? `color: ${item.color};` : '';
				return `<div style="margin-bottom: 4px; ${color}">• ${item.msg}</div>`;
			})
			.join('');

		return `
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
				<thead style="background-color: #2d2d2d;">
					<tr>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0; width: 15%;">${days}天</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">销售渠道</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">销售量</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">销售占比</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">日均销售单数</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">平均客单价</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td rowspan="5" style="padding: 10px; border: 1px solid #444; text-align: center; color: #ff8888; font-weight: bold;">总销量: ${totalSales}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: ${
							rowCard.dailyColor || '#cccccc'
						}; font-weight: bold;">${rowCard.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.price
						}</td>
					</tr>
				</tbody>
			</table>
			<div style="margin-bottom: 30px; font-size: 13px; color: #ccc; line-height: 1.6;">
				<div style="margin-bottom:8px;">
					<strong>直播人均出单数：</strong> ${
						liveSalesDiff.formula
					} = <span style="color: #fff; font-weight: bold;">${
			liveSalesDiff.val
		}</span>
				</div>
					<strong>直播出单规格：</strong> ${
						specStat.formula
					} = <span style="font-weight:bold; color: #fff;">${specStat.val.toFixed(
			2
		)}</span>
				</div>
			</div>
		`;
	}

	function showPopup(
		results,
		ranges,
		productData,
		promotionId,
		decision_enter_from
	) {
		const oldPopup = document.getElementById('douyin-monitor-popup');
		if (oldPopup) oldPopup.remove();

		const container = document.createElement('div');
		container.id = 'douyin-monitor-popup';
		container.style.position = 'fixed';
		container.style.top = '50%';
		container.style.left = '50%';
		container.style.transform = 'translate(-50%, -50%)';
		container.style.zIndex = '10000';
		container.style.display = 'block';
		container.style.backgroundColor = '#1e1e1e';
		container.style.color = '#e0e0e0';
		container.style.padding = '20px';
		container.style.borderRadius = '8px';
		container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
		container.style.width = '98%';
		container.style.maxWidth = '1200px';
		container.style.maxHeight = '95vh';
		container.style.overflowY = 'auto';

		const title = document.createElement('h3');

		const productName =
			productData?.data?.model?.product?.product_base?.title || '❎错误信息';

		const link = document.createElement('a');
		link.href = `https://buyin.jinritemai.com/dashboard/merch-picking-library/merch-promoting?commodity_id=${promotionId}&commodity_location=1&id=${promotionId}`;
		link.target = '_blank';
		link.innerText = productName;
		link.style.color = '#ffffff';
		link.style.textDecoration = 'underline';
		link.style.cursor = 'pointer';
		link.onmousedown = (e) => {
			e.stopPropagation();
		};
		link.onmouseenter = () => {
			// link.style.textDecoration = 'underline';
		};
		link.onmouseleave = () => {
			// link.style.textDecoration = 'none';
		};

		title.appendChild(link);
		title.style.display = 'flex';
		title.style.justifyContent = 'space-between';
		title.style.alignItems = 'center';
		title.style.marginBottom = '20px';
		title.style.color = '#ffffff';
		title.style.borderBottom = '1px solid #444';
		title.style.paddingBottom = '10px';

		// 操作按钮区域
		const actionsDiv = document.createElement('div');
		actionsDiv.style.display = 'flex';
		actionsDiv.style.gap = '10px';
		actionsDiv.style.alignItems = 'center';

		// 刷新按钮
		const refreshBtn = document.createElement('button');
		refreshBtn.innerText = '↻ 刷新';
		refreshBtn.style.padding = '4px 8px';
		refreshBtn.style.fontSize = '12px';
		refreshBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
		refreshBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
		refreshBtn.style.borderRadius = '4px';
		refreshBtn.style.color = '#e0e0e0';
		refreshBtn.style.cursor = 'pointer';
		refreshBtn.onclick = (e) => {
			e.stopPropagation(); // 防止触发拖拽
			refreshBtn.innerText = '刷新中...';
			refreshBtn.disabled = true;
			analyzeAndShow(promotionId, decision_enter_from);
		};
		refreshBtn.onmousedown = (e) => e.stopPropagation(); // 防止触发拖拽
		actionsDiv.appendChild(refreshBtn);

		// 头部关闭按钮
		const headerCloseBtn = document.createElement('button');
		headerCloseBtn.innerText = '✕';
		headerCloseBtn.style.padding = '4px 8px';
		headerCloseBtn.style.fontSize = '14px';
		headerCloseBtn.style.backgroundColor = 'transparent';
		headerCloseBtn.style.border = 'none';
		headerCloseBtn.style.color = '#ccc';
		headerCloseBtn.style.cursor = 'pointer';
		headerCloseBtn.onmouseenter = () => (headerCloseBtn.style.color = '#fff');
		headerCloseBtn.onmouseleave = () => (headerCloseBtn.style.color = '#ccc');
		headerCloseBtn.onclick = (e) => {
			e.stopPropagation();
			container.remove();
		};
		headerCloseBtn.onmousedown = (e) => e.stopPropagation();
		actionsDiv.appendChild(headerCloseBtn);

		// 收起/展开内容按钮
		const toggleBtn = document.createElement('button');
		toggleBtn.innerText = '🔼 收起';
		toggleBtn.style.padding = '4px 8px';
		toggleBtn.style.fontSize = '12px';
		toggleBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
		toggleBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
		toggleBtn.style.borderRadius = '4px';
		toggleBtn.style.color = '#e0e0e0';
		toggleBtn.style.cursor = 'pointer';

		let isExpanded = true;
		toggleBtn.onclick = (e) => {
			e.stopPropagation();
			isExpanded = !isExpanded;
			toggleBtn.innerText = isExpanded ? '🔼 收起' : '🔽 展开';

			// 切换表格容器的可见性
			if (tablesContainer) {
				tablesContainer.style.display = isExpanded ? 'flex' : 'none';
			}
		};
		toggleBtn.onmousedown = (e) => e.stopPropagation();
		// 插入到关闭按钮之前
		actionsDiv.insertBefore(toggleBtn, headerCloseBtn);

		title.appendChild(actionsDiv);
		container.appendChild(title);

		makeDraggable(container, title);

		const tablesContainer = document.createElement('div');
		tablesContainer.style.display = 'flex';
		tablesContainer.style.gap = '15px';
		tablesContainer.style.overflowX = 'auto';
		tablesContainer.style.paddingBottom = '10px';

		let adviceStats = null;

		results.forEach((item, index) => {
			const data = item?.data || {};
			const days = ranges[index];
			const stats = calculateStats(data, days, productData, data.promotion_id);
			const tableHtml = createTableHtml(stats);

			// 获取7天的数据用于生成建议
			if (days === 7) {
				adviceStats = stats;
			}

			const wrapper = document.createElement('div');
			wrapper.style.flex = '1';
			wrapper.style.minWidth = '400px';
			wrapper.innerHTML = tableHtml;
			tablesContainer.appendChild(wrapper);
		});

		// 建议容器
		const adviceContainer = document.createElement('div');
		adviceContainer.style.width = '100%';
		adviceContainer.style.marginTop = '15px';
		adviceContainer.style.padding = '15px';
		adviceContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
		adviceContainer.style.borderRadius = '4px';
		adviceContainer.style.color = '#ccc';
		adviceContainer.style.fontSize = '13px';
		adviceContainer.style.lineHeight = '1.6';

		if (adviceStats) {
			const {overallHtml, advice} = adviceStats;
			const adviceHtmlLines = advice
				.map((item) => {
					const color = item.color ? `color: ${item.color};` : '';
					return `<div style="margin-bottom: 4px; ${color}">• ${item.msg}</div>`;
				})
				.join('');

			adviceContainer.innerHTML = `
                <div style="font-weight:bold; margin-bottom:8px; color:#fff; font-size:14px;">选品建议 (仅供参考): ${overallHtml}</div>
                ${adviceHtmlLines}
            `;
		}

		container.appendChild(tablesContainer);
		container.appendChild(adviceContainer);

		toggleBtn.onclick = null; // 移除之前的事件处理程序引用

		// Advice Container logic (inserted previously)
		// ...

		// 更新切换逻辑以同时控制两者显示
		toggleBtn.onclick = (e) => {
			e.stopPropagation();
			isExpanded = !isExpanded;
			toggleBtn.innerText = isExpanded ? '🔼 收起' : '🔽 展开';

			const displayVal = isExpanded ? 'flex' : 'none';
			const displayBlock = isExpanded ? 'block' : 'none';
			if (tablesContainer) tablesContainer.style.display = displayVal;
			if (adviceContainer) adviceContainer.style.display = displayBlock;
		};

		// container.appendChild(tablesContainer); // REMOVED (Added above)
		// container.appendChild(adviceContainer); // Added above

		document.body.appendChild(container);
	}

	async function analyzeAndShow(
		promotionId,
		decision_enter_from,
		skipPopup = false
	) {
		if (!promotionId) {
			alert('Promotion ID 不能为空');
			return;
		}

		try {
			// 1. 获取 ewid 并请求 pack_detail (Product Info)
			let productData = {};

			try {
				const productRes = await fetchProductData(
					promotionId,
					decision_enter_from
				);
				productData = productRes;
			} catch (e) {
				console.error('Failed to fetch product data:', e);
			}

			// 2. 请求 7/30 天数据
			const ranges = [7, 30];
			// We can pass empty string for originalBodyStr as it is not used for logic anymore
			const promises = ranges.map((days) =>
				fetchDataFordays(days, promotionId, decision_enter_from)
			);
			const results = await Promise.all(promises);

			if (!skipPopup) {
				showPopup(
					results,
					ranges,
					productData,
					promotionId,
					decision_enter_from
				);
			}

			return {
				results,
				ranges,
				productData,
				promotionId,
			};
		} catch (error) {
			console.error('获取数据失败', error);
			if (!skipPopup) {
				alert('analyzeAndShow 获取数据失败: ' + error.message);
			}
			throw error;
		}
	}

	function createFloatingButton() {
		// 1. URL 检查
		if (
			window.location.href.indexOf(
				'/dashboard/merch-picking-library/merch-promoting'
			) === -1
		) {
			return;
		}

		if (document.getElementById('douyin-monitor-btn')) return;

		const btn = document.createElement('button');
		btn.id = 'douyin-monitor-btn';
		btn.innerText = '获取数据';
		btn.style.position = 'fixed';
		// 初始位置
		btn.style.top = '100px';
		btn.style.right = '20px';

		btn.style.zIndex = '9999';
		btn.style.padding = '10px 20px';
		btn.style.backgroundColor = '#fe2c55';
		btn.style.color = '#fff';
		btn.style.border = 'none';
		btn.style.borderRadius = '4px';
		btn.style.cursor = 'pointer';
		btn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';

		// 防止点击拖拽时触发 click
		let isDrag = false;
		btn.addEventListener('mousedown', () => (isDrag = false));
		btn.addEventListener('mousemove', () => (isDrag = true));
		btn.onclick = (e) => {
			const localeUrl = new URL(location.href);
			const promotionId =
				localeUrl.searchParams.get('commodity_id') ||
				localeUrl.searchParams.get('id');

			const decision_enter_from = localeUrl.searchParams.get(
				'decision_enter_from'
			);
			if (!isDrag && promotionId) {
				analyzeAndShow(promotionId, decision_enter_from);
			} else if (!promotionId) {
				console.warn('URL中未找到 commodity_id');
			}
		};

		makeDraggable(btn);

		function append() {
			if (document.body) {
				document.body.appendChild(btn);
			} else {
				requestAnimationFrame(append);
			}
		}
		append();
	}

	// 自动尝试创建按钮
	createFloatingButton();

	window.ProductInfo = {
		makeDraggable,
		sendInjectedRequest,
		fetchProductData,
		fetchDataFordays,
		calculateStats,
		createTableHtml,
		showPopup,
		analyzeAndShow,
		createFloatingButton,
	};
})();
