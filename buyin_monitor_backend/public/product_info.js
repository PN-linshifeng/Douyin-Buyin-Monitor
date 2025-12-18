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
		// const product =
		// 	productData?.data?.model?.shop_product_data?.product_infos.find(
		// 		(info) => {
		// 			return info.promotion_id === promotionId;
		// 		}
		// 	)?.base_model || {};

		const totalSales = promo.sales || 0;
		const totalAmount = promo.sales_amount || 0;

		const liveSales = content.live_sales || 0;
		const liveMatchOrderNum = content.live_match_order_num || 0;
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

		const safeDiv = (a, b) => (b === 0 ? 0 : a / b);
		const getShare = (val) => (safeDiv(val, totalSales) * 100).toFixed(2) + '%';
		const getDaily = (val) => safeDiv(val, days).toFixed(2);
		const getPriceNum = (amount, vol) => safeDiv(amount / 100, vol);
		const getPrice = (amount, vol) => getPriceNum(amount, vol).toFixed(2);

		const liveSalesDiff = liveSales / liveMatchOrderNum;
		const livePriceVal = getPriceNum(liveAmount, liveSales);

		let productPriceRaw =
			productData?.data?.model?.product?.product_price?.price_label?.price || 0;
		if (typeof productPriceRaw === 'string') {
			productPriceRaw = parseFloat(productPriceRaw.replace(/[^\d.]/g, '')) || 0;
		}
		productPriceRaw = productPriceRaw / 100;

		const specDiff = livePriceVal - productPriceRaw;
		const isHigh = specDiff >= 4;
		const specLevel = isHigh ? '高' : '低';
		const specColor = isHigh ? '#25c260' : '#fe2c55';

		return {
			totalSales,
			days,
			extraStats: {
				liveSalesDiff: {
					val: liveSalesDiff.toFixed(2),
					formula: `${liveSales} / ${liveMatchOrderNum}`,
				},
				specStat: {
					val: specDiff,
					level: specLevel,
					color: specColor,
					formula: `${livePriceVal.toFixed(2)} - ${productPriceRaw}`,
				},
			},
			channels: [
				{
					name: '商品卡',
					vol: productCardSales,
					share: getShare(productCardSales),
					daily: getDaily(productCardSales),
					price: getPrice(productCardAmount, productCardSales),
				},
				{
					name: '直播',
					vol: liveSales,
					share: getShare(liveSales),
					daily: getDaily(liveSales),
					price: getPrice(liveAmount, liveSales),
				},
				{
					name: '短视频',
					vol: videoSales,
					share: getShare(videoSales),
					daily: getDaily(videoSales),
					price: getPrice(videoAmount, videoSales),
				},
				{
					name: '图文',
					vol: imageTextSales,
					share: getShare(imageTextSales),
					daily: getDaily(imageTextSales),
					price: getPrice(imageTextAmount, imageTextSales),
				},
				{
					name: '橱窗',
					vol: bindShopSales,
					share: getShare(bindShopSales),
					daily: getDaily(bindShopSales),
					price: getPrice(bindShopAmount, bindShopSales),
				},
			],
		};
	}

	function createTableHtml(stats) {
		const {days, totalSales, channels, extraStats} = stats;
		const rowCard = channels[0];
		const rowLive = channels[1];
		const rowVideo = channels[2];
		const rowImage = channels[3];
		const rowShop = channels[4];
		const {liveSalesDiff, specStat} = extraStats;

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
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.daily
						}</td>
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
				<div>
					<strong>直播人均出单数：</strong> ${
						liveSalesDiff.formula
					} = <span style="color: #fff; font-weight: bold;">${
			liveSalesDiff.val
		}</span>
				</div>
				<div>
					<strong>直播出单规格：</strong> ${
						specStat.formula
					} = <span style="font-weight:bold; color: ${
			specStat.color
		};">${specStat.val.toFixed(2)} (${specStat.level})</span>
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
		container.style.maxWidth = '1800px';
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

		title.appendChild(actionsDiv);
		container.appendChild(title);

		makeDraggable(container, title);

		const tablesContainer = document.createElement('div');
		tablesContainer.style.display = 'flex';
		tablesContainer.style.gap = '15px';
		tablesContainer.style.overflowX = 'auto';
		tablesContainer.style.paddingBottom = '10px';

		results.forEach((item, index) => {
			const data = item?.data || {};
			const days = ranges[index];
			const stats = calculateStats(data, days, productData, data.promotion_id);
			const tableHtml = createTableHtml(stats);

			const wrapper = document.createElement('div');
			wrapper.style.flex = '1';
			wrapper.style.minWidth = '400px';
			wrapper.innerHTML = tableHtml;
			tablesContainer.appendChild(wrapper);
		});

		container.appendChild(tablesContainer);

		document.body.appendChild(container);
	}

	async function analyzeAndShow(promotionId, decision_enter_from) {
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

			showPopup(results, ranges, productData, promotionId, decision_enter_from);
		} catch (error) {
			console.error('获取数据失败', error);
			alert('analyzeAndShow 获取数据失败: ' + error.message);
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
