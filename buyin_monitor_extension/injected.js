(function () {
	const TARGET_URLS = [
		'/pc/selection/decision/pack_detail',
		'/pc/selection/common/material_list',
	];

	function isTargetUrl(url) {
		return url && TARGET_URLS.some((target) => url.indexOf(target) !== -1);
	}

	// Buffer for late-loading scripts
	window.__DM_BUFFER = window.__DM_BUFFER || [];

	function notifyContentScript(type, payload) {
		// Buffer material_list responses
		if (
			type === 'DOUYIN_MONITOR_CAPTURE_RESPONSE' &&
			payload &&
			payload.url &&
			payload.url.indexOf('/pc/selection/common/material_list') !== -1
		) {
			console.log('[Douyin Monitor Injected] Buffering material_list data');
			window.__DM_BUFFER.push(payload);
			// Keep buffer size reasonable
			if (window.__DM_BUFFER.length > 20) window.__DM_BUFFER.shift();
		}

		window.postMessage(
			{
				type: type, // 'DOUYIN_MONITOR_CAPTURE' or 'DOUYIN_MONITOR_CAPTURE_RESPONSE'
				payload: payload,
			},
			'*'
		);
	}

	// 监听来自 Content Script 的指令 (主动请求)
	window.addEventListener('message', function (event) {
		if (event.data && event.data.type === 'DOUYIN_MONITOR_FETCH') {
			const {requestId, url, body} = event.data.payload;
			console.log(
				'[Douyin Monitor Injected] 发起请求 (切换为 XHR 以触发 SDK):',
				url
			);

			try {
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

	// ===========================
	// 拦截逻辑 Helper
	// ===========================

	function captureRequest(url, body, method, headers) {
		if (isTargetUrl(url)) {
			try {
				let bodyStr = body;
				if (typeof body === 'object') {
					bodyStr = JSON.stringify(body);
				}

				// 简单过滤：pack_detail 只关心 pc-non-core, material_list 可能都关心
				// 这里暂时保留旧逻辑，只对 pack_detail 检查 data_module?
				// 为了兼容性，我们宽松一点，只要是 Target Request 都捕获
				console.log('[Douyin Monitor Injected] 捕获目标请求:', url);
				notifyContentScript('DOUYIN_MONITOR_CAPTURE', {
					url: url,
					body: bodyStr,
					method: method,
					headers: headers,
				});
			} catch (e) {
				console.error('Capture Request Error', e);
			}
		}
	}

	function captureResponse(url, responseBodyStr, requestBodyStr) {
		if (isTargetUrl(url)) {
			console.log('[Douyin Monitor Injected] 捕获目标响应:', url);
			notifyContentScript('DOUYIN_MONITOR_CAPTURE_RESPONSE', {
				url: url,
				body: responseBodyStr,
				requestBody: requestBodyStr,
			});
		}
	}

	// ===========================
	// 2. 拦截 XMLHttpRequest
	// ===========================
	const originalXHR = window.XMLHttpRequest;
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
				// Store body for response capturing
				this._monitorData.body = body;
				captureRequest(
					this._monitorData.url,
					body,
					this._monitorData.method,
					this._requestHeaders
				);
			}
			return originalSend.apply(this, arguments);
		};

		// 监听响应
		xhr.addEventListener('load', function () {
			// Check responseType before accessing responseText to avoid InvalidStateError
			if (
				this._monitorData &&
				(!this.responseType || this.responseType === 'text')
			) {
				captureResponse(
					this._monitorData.url,
					this.responseText,
					this._monitorData.body // Pass request body
				);
			}
		});

		return xhr;
	}

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
			captureRequest(
				url,
				config ? config.body : null,
				config ? config.method : 'GET',
				config ? config.headers : null
			);
		}

		const response = await originalFetch.apply(this, args);

		if (typeof url === 'string' && isTargetUrl(url)) {
			// 克隆响应以读取 body，不影响原流程
			const clone = response.clone();
			clone
				.text()
				.then((text) => {
					captureResponse(url, text);
				})
				.catch((err) => {
					console.error(
						'[Douyin Monitor Injected] Fetch Response Clone Error:',
						err
					);
				});
		}

		return response;
	};

	console.log('[Douyin Monitor] Injected Script Loaded (Updated for List)');
})();
