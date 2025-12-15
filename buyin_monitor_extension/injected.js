(function () {
	const TARGET_URL_PART = '/pc/selection/decision/pack_detail';

	function notifyContentScript(url, body, method, headers) {
		window.postMessage(
			{
				type: 'DOUYIN_MONITOR_CAPTURE',
				payload: {
					url: url,
					body: body,
					method: method,
					headers: headers,
				},
			},
			'*'
		);
	}

	// 监听来自 Content Script 的指令
	window.addEventListener('message', function (event) {
		if (event.data && event.data.type === 'DOUYIN_MONITOR_FETCH') {
			const {requestId, url, body} = event.data.payload;
			console.log(
				'[Douyin Monitor Injected] 发起请求 (切换为 XHR 以触发 SDK):',
				url
			);

			try {
				// 使用当前的 window.XMLHttpRequest，以便被页面 SDK 拦截并签名
				const xhr = new window.XMLHttpRequest();
				xhr.open('POST', url, true);
				xhr.setRequestHeader('Content-Type', 'application/json');

				xhr.onload = function () {
					if (xhr.status >= 200 && xhr.status < 300) {
						try {
							const data = JSON.parse(xhr.responseText);
							window.postMessage(
								{
									type: 'DOUYIN_MONITOR_FETCH_RESULT',
									requestId: requestId,
									success: true,
									data: data,
								},
								'*'
							);
						} catch (e) {
							window.postMessage(
								{
									type: 'DOUYIN_MONITOR_FETCH_RESULT',
									requestId: requestId,
									success: false,
									error: 'JSON parse error: ' + e.message,
								},
								'*'
							);
						}
					} else {
						window.postMessage(
							{
								type: 'DOUYIN_MONITOR_FETCH_RESULT',
								requestId: requestId,
								success: false,
								error: 'HTTP Error: ' + xhr.status,
							},
							'*'
						);
					}
				};

				xhr.onerror = function () {
					window.postMessage(
						{
							type: 'DOUYIN_MONITOR_FETCH_RESULT',
							requestId: requestId,
							success: false,
							error: 'Network Error',
						},
						'*'
					);
				};

				xhr.send(body);
			} catch (error) {
				console.error('[Douyin Monitor Injected] XHR 请求失败:', error);
				window.postMessage(
					{
						type: 'DOUYIN_MONITOR_FETCH_RESULT',
						requestId: requestId,
						success: false,
						error: error.message,
					},
					'*'
				);
			}
		}
	});

	function checkAndCapture(url, body, method, headers) {
		if (url && url.indexOf(TARGET_URL_PART) !== -1) {
			try {
				let bodyStr = body;
				if (typeof body === 'object') {
					bodyStr = JSON.stringify(body);
				}

				const bodyObj = JSON.parse(bodyStr);

				// 只要 data_module 为 pc-non-core 的请求
				if (bodyObj && bodyObj.data_module === 'pc-non-core') {
					console.log('[Douyin Monitor Injected] 捕获目标请求 (pc-non-core)');
					notifyContentScript(url, bodyStr, method, headers);
				}
			} catch (e) {
				// 忽略解析错误
			}
		}
	}

	// ===========================
	// 2. 拦截 XMLHttpRequest
	// ===========================
	const originalXHR = window.XMLHttpRequest;
	// 避免重复注入
	if (window.originalXHR) return;
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

	// 复制静态属性
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

	console.log('[Douyin Monitor] Injected Script Loaded');
})();
