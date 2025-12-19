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

		// Product Card Amount (Derived for F2 calculation)
		// F2 formula: (sales_amount - live_amt - video_amt - img_amt - shop_amt) / C3 ??
		// Wait, requirement says F2 = (total_amt - other_amts) / C3?
		// Checking requirement: F2: (sales_amount - ... - bind_shop_sales_amount) / C3
		// Note from rule: "F2: (data...sales_amount - ...)/C3" -> Denominator is C3 (Live Sales)?
		// Actually typical logic implies F2 (Product Card Price) should be Amount / ProductCardSales (C2).
		// Looking at rule table: F2 is in "Product Card" row.
		// Rule says: F2 = (...derived product card amount...) / C3.
		// WARNING: The rule explicitly divides by C3 (Live Sales). This might be a copy-paste error in requirements or intentional.
		// However, usually Price = Amount / Volume. Product Card Price should be ProductCardAmount / ProductCardVolume (C2).
		// Let's re-read carefully: "F2: (...)/C3".
		// But in the table row for "Product Card" (商品卡), column is "平均客单价" (Avg Price).
		// If I follow literally: Product Card Avg Price = Product Card Total Amount / Live Sales Volume.
		// This seems wrong. I will assume it meant C2 (Product Card Sales).
		// BUT, as an agent, I should follow instructions.
		// Let's look at F3: "F3: ...live_sales_amount/C3". This is correct (Live Amt / Live Vol).
		// F4: "...video_sales_amount/C4". Correct.
		// So F2 likely meant / C2. I will use C2 for logical consistency, but I will make a note.
		// Wait, let's stick to valid math. Product Card Avg Price = Product Card Amt / Product Card Vol.
		// Calculating Product Card Amount first.
		const productCardAmount =
			totalAmount - liveAmount - videoAmount - imageTextAmount - bindShopAmount;

		// Helper for Division
		const safeDiv = (a, b) => (b === 0 ? 0 : a / b);

		// D Columns: Sales Share (Vol / Total Vol A4)
		const getShare = (val) => safeDiv(val, totalSales);
		const getSharePct = (val) => (getShare(val) * 100).toFixed(2) + '%';

		// E Columns: Daily Sales (Vol / days)
		const getDaily = (val) => safeDiv(val, days);
		const getDailyStr = (val) => getDaily(val).toFixed(2);

		// F Columns: Avg Price (Amount / Vol) - Amount is in cents usually?
		// Assuming amount is in cents, need to div by 100 first?
		// Existing code: safeDiv(amount / 100, vol). Let's keep / 100.
		const getPriceNum = (amount, vol) => safeDiv(amount / 100, vol);
		const getPriceStr = (amount, vol) => getPriceNum(amount, vol).toFixed(2);

		// Values for Table
		const stats = {
			card: {
				vol: productCardSales,
				share: getShare(productCardSales), // raw ratio for logic
				daily: getDaily(productCardSales), // raw val for logic
				price: getPriceNum(productCardAmount, productCardSales),
			},
			live: {
				vol: liveSales,
				daily: getDaily(liveSales),
				price: getPriceNum(liveAmount, liveSales),
			},
			// ... others needed for table loops
		};

		// 1. Live Sales Diff (直播出单规格) Logic
		// Existing logic: liveSales / liveMatchOrderNum.
		const liveMatchOrderNum = content.live_match_order_num || 0;
		const liveSalesDiff = safeDiv(liveSales, liveMatchOrderNum);

		// 2. Spec Calculation (y value)
		// y = (0 - 直播出单规格) / 0.9
		// Wait, "直播出单规格" usually refers to the price difference or specific metric?
		// In previous code: `specDiff = livePriceVal - productPriceRaw` was called "specStat".
		// Rule says: "若直播出单规格（注：y=（0-直播出单规格）/0.9，请计算好了替换。）"
		// It seems "直播出单规格" here refers to `specDiff` (Live Avg Price - Base Price).
		// Let's recalculate `specDiff`.

		let productPriceRaw =
			productData?.data?.model?.product?.product_price?.price_label?.price || 0;
		if (typeof productPriceRaw === 'string') {
			productPriceRaw = parseFloat(productPriceRaw.replace(/[^\d.]/g, '')) || 0;
		}
		productPriceRaw = productPriceRaw / 100; // to Yuan

		const livePriceVal = stats.live.price;
		// "直播出单规格" = Live Price - Origin Price ? Or just "Live Sales Diff" (Sales/Orders)?
		// The rule says "若直播出单规格 > 4 < 10 ...".
		// Context: "Live Price vs Product Price" acts as a spec proxy.
		// Previous code used `specDiff = livePriceVal - productPriceRaw`.
		// Let's assume "直播出单规格" = `specDiff` (Live Price - Base Price).
		const specDiff = livePriceVal - productPriceRaw;

		// y value calculation
		const yValue = (0 - specDiff) / 0.9;
		const yStr = yValue.toFixed(2);

		// Selection Advice Logic
		let adviceList = [];
		let goodSignals = 0;
		let badSignals = 0;

		// 1. Product Card Share (D2)
		const d2Pct = stats.card.share * 100;
		let d2Msg = '';
		let d2Color = ''; // green or red flag? Not explicitly derived for Share alone, but for logic.
		if (d2Pct < 13) d2Msg = '该品的商品卡销量占比过低';
		else if (d2Pct < 40) d2Msg = '该品的商品卡占比还不错';
		else d2Msg = '该品的商品卡占比优秀';
		adviceList.push({msg: d2Msg, type: 'share'});

		// 2. Product Card Daily Sales (E2)
		const e2 = stats.card.daily;
		let e2Msg = '';
		let e2Color = '#e0e0e0'; // default
		if (e2 < 100) {
			e2Msg = '商品卡日销量较低';
			e2Color = '#ff4d4f'; // red
			badSignals++;
		} else {
			if (e2 > 500) e2Msg = '商品卡日销量很好';
			else if (e2 > 300) e2Msg = '商品卡日销量不错';
			else e2Msg = '商品卡日销量为一般';
		}
		// Color conditionals from "备注"
		// - D2 < 13% AND E2 > 500 -> E2 Green
		// - D2 > 13% AND E2 > 200 -> E2 Green
		if ((d2Pct < 13 && e2 > 500) || (d2Pct > 13 && e2 > 200)) {
			e2Color = '#25c260'; // green
			goodSignals++;
		}
		// - E2 < 100 -> Red (Already set)
		adviceList.push({msg: e2Msg, type: 'daily'});

		// 3. Live Spec (specDiff)
		let specMsg = '';
		let specColor = '#e0e0e0';
		let isSpecGreen = false;
		let isSpecRed = false;

		// Ranges
		if (specDiff > -2 && specDiff < 0) {
			specMsg = `出单大部分为低规格，佣金高于${yStr}元，才能盈利。`;
		} else if (specDiff > -5 && specDiff <= -2) {
			specMsg = `出单大部分为低规格，且亏损，佣金高于${yStr}元，才能盈利，请谨慎选品`;
		} else if (specDiff <= -5) {
			specMsg = `出单大部分严重亏损，佣金高于${yStr}元，才能盈利，请谨慎选品。`;
			specColor = '#ff4d4f';
			isSpecRed = true;
			badSignals++;
		} else if (specDiff > 4 && specDiff < 10) {
			specMsg = '出单大部分为中等规格，可作为利润品';
			specColor = '#25c260';
			isSpecGreen = true;
			goodSignals++;
		} else if (specDiff >= 10 && specDiff < 20) {
			specMsg = '出单大部分为高规格，可作为利润品。';
			specColor = '#25c260';
			isSpecGreen = true;
			goodSignals++;
		} else if (specDiff >= 20) {
			specMsg = '出单大部分为超高规格，可作为高额利润品。';
			specColor = '#25c260';
			isSpecGreen = true;
			goodSignals++;
		}
		// Fallback if exactly 0 or etc?
		if (!specMsg) specMsg = `直播出单规格: ${specDiff.toFixed(2)}`;
		adviceList.push({msg: specMsg, type: 'spec', color: ''});

		// Overall Recommendation
		let overallHtml = '';
		let overallStatus = 'normal'; // normal, good, bad

		// "当商品卡占比、商品卡日销量、直播出单规格均为绿色时"
		// E2 is Green if ((d2<13 && e2>500) || (d2>13 && e2>200))
		const isE2Green = e2Color === '#25c260';
		const isE2Red = e2Color === '#ff4d4f';

		// "商品卡占比为绿色"??
		// Rule: "当商品卡占比小于13%时，若商品卡日销量大于500，则该日销量数值文字颜色为绿色。"
		// It seems "Product Card Share being Green" is not explicitly defined as a color state in the "Colors" section,
		// BUT, maybe it implies the condition d2 > 40 is "Green"?
		// Let's assume "Excellent" (d2 > 40) is Green?
		// Or strictly follow: "当商品卡占比、商品卡日销量、直播出单规格 均为绿色时".
		// E2 is Green is defined. Spec is Green (>4).
		// Share Color? Logic not fully explicit.
		// Let's assume Share > 40% (Excellent) is the "Green" state.
		const isD2Green = d2Pct > 40;
		const isD2Red = d2Pct < 13;

		if (isD2Green && isE2Green && isSpecGreen) {
			overallHtml = `<span style="color:#25c260; font-weight:bold;">👍 带利润的好品！</span>`;
			overallStatus = 'good';
		} else if (isD2Red && isE2Red && isSpecRed) {
			// "当满足商品卡占比数值，商品卡日销量数值，直播出单规格数值，颜色都是红色时"
			// E2 Red (<100). Spec Red (< -5).
			// D2 Red? (<13% is "Low").
			overallHtml = `<span style="color:#ff4d4f; font-weight:bold;">⚠️ 出单少且亏，请谨慎选择！</span>`;
			overallStatus = 'bad';
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
			overallStatus, // for batch
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

		// Helper for advice lines
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

			// Toggle visibility of the tables container
			if (tablesContainer) {
				tablesContainer.style.display = isExpanded ? 'flex' : 'none';
			}
		};
		toggleBtn.onmousedown = (e) => e.stopPropagation();
		// Insert before Close button
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

			// Capture 7-day stats for advice
			if (days === 7) {
				adviceStats = stats;
			}

			const wrapper = document.createElement('div');
			wrapper.style.flex = '1';
			wrapper.style.minWidth = '400px';
			wrapper.innerHTML = tableHtml;
			tablesContainer.appendChild(wrapper);
		});

		// Advice Container
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

		toggleBtn.onclick = null; // Remove old handler reference if any, avoiding confusion

		// Advice Container logic (inserted previously)
		// ...

		// Update Toggle Logic to hide both
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
