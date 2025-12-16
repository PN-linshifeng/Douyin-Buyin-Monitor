(function () {
	console.log(
		'%c [Douyin Monitor] Content Script Loaded v1.4 (Isolated World)',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	let capturedRequest = null;

	// ===========================
	// 0. 注入拦截脚本 (到 Main World)
	// ===========================
	function injectScript(file_path) {
		var node = document.head || document.documentElement;
		var script = document.createElement('script');
		script.setAttribute('type', 'text/javascript');
		script.setAttribute('src', file_path);
		node.appendChild(script);
	}
	try {
		injectScript(chrome.runtime.getURL('injected.js'));
	} catch (e) {
		console.error('[Douyin Monitor] Injection failed:', e);
	}

	// ===========================
	// 1. 监听来自 Injected Script 的消息
	// ===========================
	const pendingRequests = new Map();

	window.addEventListener(
		'message',
		function (event) {
			if (event.source !== window) return;

			// 处理捕获通知
			if (event.data.type && event.data.type === 'DOUYIN_MONITOR_CAPTURE') {
				console.log('[Douyin Monitor Content] Received capture data from Page');
				const payload = event.data.payload;

				capturedRequest = {
					url: payload.url,
					init: {
						method: payload.method,
						headers: payload.headers,
						body: payload.body,
					},
				};
				updateButtonState(true);
			}

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

	// ===========================
	// 2. UI 逻辑
	// ===========================

	/**
	 * 让元素可拖拽
	 * @param {HTMLElement} element - 要移动的元素
	 * @param {HTMLElement} handle - 触发拖拽的区域 (默认为 element 自身)
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

			// 获取当前位置（即使是计算样式）
			const rect = element.getBoundingClientRect();
			initialLeft = rect.left;
			initialTop = rect.top;

			// 切换为固定定位数值，防止 transform 干扰或初始 auto 问题
			element.style.position = 'fixed';
			element.style.left = initialLeft + 'px';
			element.style.top = initialTop + 'px';
			element.style.right = 'auto';
			element.style.bottom = 'auto';
			element.style.margin = '0';
			// 如果有 transform 居中，需要移除它，否则位置会偏移叠加
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

	function createButton() {
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
		btn.style.opacity = '0.5';
		btn.title = '等待捕获请求...';

		// 防止点击拖拽时触发 click
		let isDrag = false;
		btn.addEventListener('mousedown', () => (isDrag = false));
		btn.addEventListener('mousemove', () => (isDrag = true));
		btn.onclick = (e) => {
			if (!isDrag) handleBtnClick();
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

	function updateButtonState(ready) {
		const btn = document.getElementById('douyin-monitor-btn');
		if (btn && ready) {
			btn.style.opacity = '1';
			btn.title = '点击获取7/30/90天数据';
			btn.innerText = '获取数据 (已就绪)';
			btn.style.backgroundColor = '#25c260';
		}
	}

	async function handleBtnClick() {
		if (!capturedRequest) {
			alert('尚未捕获到接口请求。请等待页面加载完成或手动刷新。');
			return;
		}
		const hasPopup = document.getElementById('douyin-monitor-popup');
		if (hasPopup) {
			hasPopup.style.display = 'block';
			return;
		}

		const btn = document.getElementById('douyin-monitor-btn');
		const originalText = btn.innerText;
		btn.innerText = '加载中...';
		btn.disabled = true;

		try {
			const ranges = [7, 30]; // 7天和30天
			const promises = ranges.map((days) => fetchDataFordays(days));
			const results = await Promise.all(promises);

			showPopup(results, ranges);
		} catch (error) {
			console.error('获取数据失败', error);
			alert('获取数据失败: ' + error.message);
		} finally {
			btn.innerText = originalText;
			btn.disabled = false;
		}
	}

	async function fetchDataFordays(days) {
		const {init} = capturedRequest;
		let bodyStr = init.body;

		// 1. 构造 Body
		try {
			if (typeof bodyStr !== 'string') {
				bodyStr = JSON.stringify(bodyStr);
			}
			const originalBodyObj = JSON.parse(bodyStr);

			const newBodyObj = {
				scene_info: originalBodyObj.scene_info || {},
				other_params: {
					colonel_activity_id: '',
				},
				biz_id: originalBodyObj.biz_id,
				biz_id_type: originalBodyObj.biz_id_type,
				enter_from: originalBodyObj.enter_from,
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

		// 2. 直接使用捕获的原始 URL (假设 SDK 会自动补全签名参数)
		const fullUrl = capturedRequest.url;

		// 3. 处理 URL 参数：移除可能存在的旧签名，让 SDK 重新生成
		const urlObj = new URL(fullUrl);
		urlObj.searchParams.delete('a_bogus');
		urlObj.searchParams.delete('msToken');
		// 移除 verifyFp 和 fp，因为用户说这些也是 SDK 加上去的
		urlObj.searchParams.delete('verifyFp');
		urlObj.searchParams.delete('fp');

		const targetUrl = urlObj.toString();

		// 4. 委托 Main World 发起 Fetch (通过 XHR 触发 SDK 签名)
		return new Promise((resolve, reject) => {
			const requestId = Date.now() + '_' + Math.random();
			pendingRequests.set(requestId, {resolve, reject});

			window.postMessage(
				{
					type: 'DOUYIN_MONITOR_FETCH',
					payload: {
						requestId: requestId,
						url: targetUrl,
						body: bodyStr,
					},
				},
				'*'
			);

			// 超时处理
			setTimeout(() => {
				if (pendingRequests.has(requestId)) {
					pendingRequests.delete(requestId);
					reject(new Error('Request timeout'));
				}
			}, 15000);
		});
	}

	/**
	 * 格式化数字：万、百万、千万，保留两位小数
	 */
	function calculateStats(data, days) {
		const promo = data?.model?.promotion_data?.calculate_data || {};
		const content = data?.model?.content_data?.calculate_data || {};

		// A3 / A4: Total Sales
		const totalSales = promo.sales || 0;
		const totalAmount = promo.sales_amount || 0;

		// C Columns: Sales Volume
		const liveSales = content.live_sales || 0;
		const videoSales = content.video_sales || 0;
		const imageTextSales = content.image_text_sales || 0;
		const bindShopSales = content.bind_shop_sales || 0; // Window/Showcase
		// C2: Product Card = Total - others
		const productCardSales =
			totalSales - liveSales - videoSales - imageTextSales - bindShopSales;

		// Amounts (in cents)
		const liveAmount = content.live_sales_amount || 0;
		const videoAmount = content.video_sales_amount || 0;
		const imageTextAmount = content.image_text_sales_amount || 0;
		const bindShopAmount = content.bind_shop_sales_amount || 0;
		const productCardAmount =
			totalAmount - liveAmount - videoAmount - imageTextAmount - bindShopAmount;

		// Helper for division
		const safeDiv = (a, b) => (b === 0 ? 0 : a / b);

		// D Columns: Share % (of Total Sales A4)
		const getShare = (val) => (safeDiv(val, totalSales) * 100).toFixed(2) + '%';

		// E Columns: Daily Avg
		const getDaily = (val) => safeDiv(val, days).toFixed(2);

		// F Columns: Avg Price (Amount / Volume). Amount is in cents, so /100.
		// Note: Requirement had F2 formula dividing by C3 (LiveSales), which is likely a typo.
		// Using C2 (ProductCardSales) for Product Card Price to be consistent with others.
		const getPrice = (amount, vol) => safeDiv(amount / 100, vol).toFixed(2);

		return {
			totalSales,
			days,
			channels: [
				{
					name: '商品卡',
					vol: productCardSales, // C2
					share: getShare(productCardSales), // D2
					daily: getDaily(productCardSales), // E2
					price: getPrice(productCardAmount, productCardSales), // F2
				},
				{
					name: '直播',
					vol: liveSales, // C3
					share: getShare(liveSales), // D3
					daily: getDaily(liveSales), // E3
					price: getPrice(liveAmount, liveSales), // F3
				},
				{
					name: '短视频',
					vol: videoSales, // C4
					share: getShare(videoSales), // D4
					daily: getDaily(videoSales), // E4
					price: getPrice(videoAmount, videoSales), // F4
				},
				{
					name: '图文',
					vol: imageTextSales, // C5
					share: getShare(imageTextSales), // D5
					daily: getDaily(imageTextSales), // E5
					price: getPrice(imageTextAmount, imageTextSales), // F5
				},
				{
					name: '橱窗',
					vol: bindShopSales, // C6
					share: getShare(bindShopSales), // D6
					daily: getDaily(bindShopSales), // E6
					price: getPrice(bindShopAmount, bindShopSales), // F6
				},
			],
		};
	}

	function createTableHtml(stats) {
		const {days, totalSales, channels} = stats;
		// Channels: 0:ProductCard, 1:Live, 2:Video, 3:ImageText, 4:Showcase

		const rowCard = channels[0];
		const rowLive = channels[1];
		const rowVideo = channels[2];
		const rowImage = channels[3];
		const rowShop = channels[4];

		return `
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 14px;">
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
					<!-- Row 1: Time Range + Product Card -->
					<tr>
						<td rowspan="5" style="padding: 10px; border: 1px solid #444; text-align: center; color: #ff8888; font-weight: bold;">总销量: ${totalSales}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowCard.name}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowCard.vol}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowCard.share}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowCard.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowCard.price}</td>
					</tr>
					<!-- Row 2: Live -->
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowLive.name}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowLive.vol}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowLive.share}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowLive.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowLive.price}</td>
					</tr>
					<!-- Row 3: Total Sales + Video -->
					<tr>
						
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowVideo.name}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowVideo.vol}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowVideo.share}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowVideo.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowVideo.price}</td>
					</tr>
					<!-- Row 4: Image Text -->
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowImage.name}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowImage.vol}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowImage.share}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowImage.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowImage.price}</td>
					</tr>
					<!-- Row 5: Showcase -->
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowShop.name}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowShop.vol}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowShop.share}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowShop.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${rowShop.price}</td>
					</tr>
				</tbody>
			</table>
		`;
	}

	function showPopup(results, ranges) {
		const oldPopup = document.getElementById('douyin-monitor-popup');
		// 如果已存在，只移除旧的（或者更新数据，这里简化为重绘）
		if (oldPopup) oldPopup.remove();

		// 此处不再创建 mask，直接创建 container 作为 popup
		const container = document.createElement('div');
		container.id = 'douyin-monitor-popup'; // 复用 ID 方便查找
		container.style.position = 'fixed';

		// 初始居中
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
		// Made wider for horizontal layout
		container.style.width = '98%';
		container.style.maxWidth = '1800px';
		container.style.maxHeight = '95vh';
		container.style.overflowY = 'auto';

		const title = document.createElement('h3');
		title.innerText = '数据分析报告';
		title.style.marginBottom = '20px';
		title.style.color = '#ffffff';
		title.style.borderBottom = '1px solid #444';
		title.style.paddingBottom = '10px';
		container.appendChild(title);

		// 让弹窗可通过标题拖拽
		makeDraggable(container, title);

		// Container for horizontal tables
		const tablesContainer = document.createElement('div');
		tablesContainer.style.display = 'flex';
		tablesContainer.style.gap = '15px';
		tablesContainer.style.overflowX = 'auto';
		tablesContainer.style.paddingBottom = '10px'; // Space for scrollbar if needed

		// Iterate results and append tables
		results.forEach((item, index) => {
			const data = item?.data || {};
			const days = ranges[index];
			const stats = calculateStats(data, days);
			const tableHtml = createTableHtml(stats);

			const wrapper = document.createElement('div');
			wrapper.style.flex = '1'; // Distribute space evenly
			wrapper.style.minWidth = '400px'; // Prevent squishing too much
			wrapper.innerHTML = tableHtml;
			tablesContainer.appendChild(wrapper);
		});

		container.appendChild(tablesContainer);

		const closeBtn = document.createElement('button');
		closeBtn.innerText = '关闭';
		closeBtn.style.marginTop = '10px';
		closeBtn.style.padding = '8px 20px';
		closeBtn.style.backgroundColor = '#333';
		closeBtn.style.color = '#fff';
		closeBtn.style.border = '1px solid #555';
		closeBtn.style.borderRadius = '4px';
		closeBtn.style.cursor = 'pointer';
		closeBtn.onclick = () => {
			container.remove();
		};
		container.appendChild(closeBtn);

		document.body.appendChild(container);
	}

	createButton();
})();
