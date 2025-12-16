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
	function createButton() {
		if (document.getElementById('douyin-monitor-btn')) return;

		const btn = document.createElement('button');
		btn.id = 'douyin-monitor-btn';
		btn.innerText = '获取数据';
		btn.style.position = 'fixed';
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

		btn.onclick = handleBtnClick;

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
			hasPopup.style.display = 'flex';
			return;
		}

		const btn = document.getElementById('douyin-monitor-btn');
		const originalText = btn.innerText;
		btn.innerText = '加载中...';
		btn.disabled = true;

		try {
			const ranges = [7, 30, 90];
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
	function formatUnitNumber(num) {
		num = Number(num);
		if (isNaN(num)) return '0.00';

		if (num >= 10000000) {
			return (num / 10000000).toFixed(2) + '千万';
		} else if (num >= 1000000) {
			return (num / 1000000).toFixed(2) + '百万';
		} else if (num >= 10000) {
			return (num / 10000).toFixed(2) + '万';
		}
		return num.toFixed(2);
	}

	function showPopup(results, days) {
		const oldPopup = document.getElementById('douyin-monitor-popup');
		if (oldPopup) oldPopup.remove();

		const mask = document.createElement('div');
		mask.id = 'douyin-monitor-popup';
		mask.style.position = 'fixed';
		mask.style.top = '0';
		mask.style.left = '0';
		mask.style.width = '100%';
		mask.style.height = '100%';
		// mask.style.backgroundColor = 'rgba(0,0,0,0.7)'; // Darker mask for focus
		mask.style.zIndex = '10000';
		mask.style.display = 'flex';
		mask.style.justifyContent = 'center';
		mask.style.alignItems = 'center';
		mask.style.pointerEvents = 'none';

		const container = document.createElement('div');
		container.style.backgroundColor = '#1e1e1e'; // Dark bg
		container.style.color = '#e0e0e0'; // Dark mode text
		container.style.padding = '20px';
		container.style.borderRadius = '8px';
		container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
		container.style.minWidth = '700px';
		container.style.maxWidth = '90%';
		container.style.maxHeight = '90vh';
		container.style.overflowY = 'auto';
		container.style.pointerEvents = 'auto';

		const title = document.createElement('h3');
		title.innerText = '数据分析报告';
		title.style.marginBottom = '15px';
		title.style.color = '#ffffff'; // White title
		container.appendChild(title);

		const table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';

		const thead = `
			<thead style="background-color: #2d2d2d;">
				<tr>
					<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">时间范围</th>
					<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">总销售额</th>
					<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">总销量</th>
					<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">出单达人数</th>
					<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">总销售额/总销量=估算单价</th>
				</tr>
			</thead>
		`;

		let tbodyHtml = '<tbody>';
		results.forEach((item, index) => {
			const d = item?.data?.model?.promotion_data?.calculate_data || {};
			console.log(item);
			const salesAmount = d.sales_amount || 0;
			const sales = d.sales || 0;
			const authors = d.match_order_num || 0;

			const displaySalesAmount = (salesAmount / 100).toFixed(2);
			const displayUnitPrice =
				sales > 0 ? (salesAmount / 100 / sales).toFixed(2) : '0.00';
			const displaySales = formatUnitNumber(sales);
			tbodyHtml += `
				<tr>
					<td style="padding: 10px; border: 1px solid #444; text-align: center; color: #cccccc;">${days[index]}天</td>
					<td style="padding: 10px; border: 1px solid #444; text-align: center; color: #cccccc;">${d.format_sales_amount}</td>
					<td style="padding: 10px; border: 1px solid #444; text-align: center; color: #cccccc;">${displaySales}</td>
					<td style="padding: 10px; border: 1px solid #444; text-align: center; color: #cccccc;">${authors}</td>
					<td style="padding: 10px; border: 1px solid #444; text-align: center; color: #cccccc;">${displaySalesAmount} / ${sales} = ¥${displayUnitPrice}</td>
				</tr>
			`;
		});
		tbodyHtml += '</tbody>';

		table.innerHTML = thead + tbodyHtml;
		container.appendChild(table);

		const closeBtn = document.createElement('button');
		closeBtn.innerText = '关闭';
		closeBtn.style.marginTop = '20px';
		closeBtn.style.padding = '8px 16px';
		closeBtn.style.backgroundColor = '#333';
		closeBtn.style.color = '#fff';
		closeBtn.style.border = '1px solid #555';
		closeBtn.style.borderRadius = '4px';
		closeBtn.style.cursor = 'pointer';
		closeBtn.onclick = () => {
			mask.style.display = 'none';
		};
		container.appendChild(closeBtn);

		mask.appendChild(container);
		document.body.appendChild(mask);
		// mask.onclick = (e) => {
		// 	if (e.target === mask) {
		// 		mask.style.display = 'none';
		// 	}
		// };
	}

	createButton();
})();
