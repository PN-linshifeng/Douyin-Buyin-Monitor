(function () {
	console.log(
		'%c [Douyin Monitor] 主环境同步拦截启动 v1.3',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	let capturedRequest = null;
	const TARGET_URL_PART = 'decision/pack_detail';

	// ===========================
	// 1. UI 逻辑
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
			alert(
				'尚未捕获到接口请求。请按 F12 打开控制台查看日志，确认是否有 "[Douyin Monitor]" 开头的输出。'
			);
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
			showPopup(results);
		} catch (error) {
			console.error('获取数据失败', error);
			alert('获取数据失败: ' + error.message);
		} finally {
			btn.innerText = originalText;
			btn.disabled = false;
		}
	}

	async function fetchDataFordays(days) {
		const {url, init} = capturedRequest;

		let targetUrl = url;
		// 按照需求：只保留 ewid，verifyFp，fp，msToken
		try {
			const urlObj = new URL(url);
			const keepParams = ['ewid', 'verifyFp', 'fp', 'msToken'];
			const newParams = new URLSearchParams();

			keepParams.forEach((key) => {
				const val = urlObj.searchParams.get(key);
				if (val !== null) {
					newParams.set(key, val);
				}
			});

			urlObj.search = newParams.toString();
			targetUrl = urlObj.toString();
		} catch (e) {
			console.error('URL 参数处理出错', e);
		}

		let newInit = {...init};
		// 处理 headers
		if (init.headers) {
			newInit.headers = JSON.parse(JSON.stringify(init.headers));
		} else {
			newInit.headers = {};
		}

		if (!newInit.headers['content-type'] && !newInit.headers['Content-Type']) {
			newInit.headers['Content-Type'] = 'application/json';
		}

		// 修改 body
		if (init.body) {
			try {
				let bodyStr = init.body;
				if (typeof bodyStr !== 'string') {
					bodyStr = JSON.stringify(bodyStr);
				}

				let bodyObj = JSON.parse(bodyStr);

				// 安全地设置 time_range
				const setTimeRange = (obj) => {
					if (!obj) return;
					if (obj.promotion_data_params)
						obj.promotion_data_params.time_range = String(days);
					if (obj.content_data_params)
						obj.content_data_params.time_range = String(days);
				};

				if (bodyObj.dynamic_params) {
					setTimeRange(bodyObj.dynamic_params);
				}
				newInit.body = JSON.stringify(bodyObj);
			} catch (e) {
				console.error('Body 解析/修改失败，将使用原始 Body', e);
			}
		}

		console.log(`正在请求 ${days} 天数据... URL:`, targetUrl);
		const response = await window.originalFetch(targetUrl, newInit);
		const json = await response.json();
		return {days, data: json};
	}

	function showPopup(results) {
		const oldPopup = document.getElementById('douyin-monitor-popup');
		if (oldPopup) oldPopup.remove();

		const mask = document.createElement('div');
		mask.id = 'douyin-monitor-popup';
		mask.style.position = 'fixed';
		mask.style.top = '0';
		mask.style.left = '0';
		mask.style.width = '100%';
		mask.style.height = '100%';
		mask.style.backgroundColor = 'rgba(0,0,0,0.5)';
		mask.style.zIndex = '10000';
		mask.style.display = 'flex';
		mask.style.justifyContent = 'center';
		mask.style.alignItems = 'center';

		const container = document.createElement('div');
		container.style.backgroundColor = '#fff';
		container.style.padding = '20px';
		container.style.borderRadius = '8px';
		container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
		container.style.minWidth = '700px';
		container.style.maxWidth = '90%';
		container.style.maxHeight = '90vh';
		container.style.overflowY = 'auto';

		const title = document.createElement('h3');
		title.innerText = '数据分析报告';
		title.style.marginBottom = '15px';
		title.style.color = '#333';
		container.appendChild(title);

		const table = document.createElement('table');
		table.style.width = '100%';
		table.style.borderCollapse = 'collapse';

		const thead = `
			<thead style="background-color: #f5f5f5;">
				<tr>
					<th style="padding: 10px; border: 1px solid #ddd;">时间范围</th>
					<th style="padding: 10px; border: 1px solid #ddd;">总销售额</th>
					<th style="padding: 10px; border: 1px solid #ddd;">总销量</th>
					<th style="padding: 10px; border: 1px solid #ddd;">出单达人数</th>
					<th style="padding: 10px; border: 1px solid #ddd;">估算单价</th>
				</tr>
			</thead>
		`;

		let tbodyHtml = '<tbody>';
		results.forEach((item) => {
			const d = item.data?.data?.model?.promotion_data?.calculate_data || {};

			const salesAmount = d.sales_amount || 0;
			const sales = d.sales || 0;
			const authors = d.match_order_num || 0;

			const displaySalesAmount = (salesAmount / 100).toFixed(2);
			const displayUnitPrice =
				sales > 0 ? (salesAmount / 100 / sales).toFixed(2) : '0.00';

			tbodyHtml += `
				<tr>
					<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.days}天</td>
					<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">¥${displaySalesAmount}</td>
					<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${sales}</td>
					<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${authors}</td>
					<td style="padding: 10px; border: 1px solid #ddd; text-align: center;">¥${displayUnitPrice}</td>
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
		closeBtn.style.cursor = 'pointer';
		closeBtn.onclick = () => mask.remove();
		container.appendChild(closeBtn);

		mask.appendChild(container);
		document.body.appendChild(mask);
		mask.onclick = (e) => {
			if (e.target === mask) mask.remove();
		};
	}

	createButton();

	// ===========================
	// 捕获逻辑
	// ===========================
	function checkAndCapture(url, body, method, headers) {
		if (url && url.indexOf(TARGET_URL_PART) !== -1) {
			console.log('[Douyin Monitor] ！！！发现目标请求！！！');
			console.log('Target URL:', url);

			// 只要 URL 匹配就捕获，不检查 body
			capturedRequest = {
				url: url,
				init: {
					method: method || 'POST',
					headers: headers,
					body: typeof body === 'object' ? JSON.stringify(body) : body,
				},
			};
			updateButtonState(true);
		}
	}

	// ===========================
	// 2. 拦截 XMLHttpRequest
	// ===========================
	const originalXHR = window.XMLHttpRequest;
	window.originalXHR = originalXHR;

	function XHRProxy() {
		const xhr = new originalXHR();
		const originalOpen = xhr.open;
		const originalSetRequestHeader = xhr.setRequestHeader;
		const originalSend = xhr.send;

		xhr._requestHeaders = {};

		xhr.open = function (method, url) {
			this._monitorData = {method, url};
			return originalOpen.apply(this, arguments);
		};

		xhr.setRequestHeader = function (header, value) {
			this._requestHeaders[header] = value;
			return originalSetRequestHeader.apply(this, arguments);
		};

		xhr.send = function (body) {
			if (this._monitorData) {
				checkAndCapture(
					this._monitorData.url,
					body,
					this._monitorData.method,
					this._requestHeaders
				);
			}
			return originalSend.apply(this, arguments);
		};

		return xhr;
	}
	// 尽可能多地复制属性
	for (let key in originalXHR) {
		try {
			XHRProxy[key] = originalXHR[key];
		} catch (e) {}
	}
	XHRProxy.prototype = originalXHR.prototype;
	window.XMLHttpRequest = XHRProxy;

	// ===========================
	// 3. 拦截 Fetch
	// ===========================
	const originalFetch = window.fetch;
	window.originalFetch = originalFetch;

	window.fetch = async function (...args) {
		let [resource, config] = args;
		let url = resource;

		if (resource instanceof Request) {
			url = resource.url;
		}

		if (typeof url === 'string') {
			checkAndCapture(
				url,
				config ? config.body : null,
				config ? config.method : 'GET',
				config ? config.headers : null
			);
		}

		return originalFetch.apply(this, args);
	};
})();
