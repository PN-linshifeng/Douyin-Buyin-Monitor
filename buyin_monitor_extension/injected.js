(function () {
	// =========================================================================
	// Douyin Monitor Injected Script
	// =========================================================================
	// 该脚本被注入到页面上下文中 (Main World)，主要负责：
	// 1. 劫持并监听 XMLHttpRequest 和 Fetch 请求，捕获目标 API 的数据。
	// 2. 将捕获的数据通过 window.postMessage 发送给 Content Script (Isolated World)。
	// 3. 监听来自 Content Script 的指令，在页面上下文中发起特定请求 (如重新获取详情)。
	// =========================================================================

	// 需要拦截的目标 URL 片段
	const TARGET_URLS = [
		// '/pc/selection/decision/pack_detail', // 商品包详情接口
		'/pc/selection/common/material_list', // 选品库列表接口
	];

	/**
	 * 判断 URL 是否为目标拦截 URL
	 * @param {string} url 请求 URL
	 * @returns {boolean} 是否匹配
	 */
	function isTargetUrl(url) {
		return url && TARGET_URLS.some((target) => url.indexOf(target) !== -1);
	}

	// ===========================
	// 1. 通信与数据缓冲
	// ===========================

	// 缓冲区：用于存储在 Content Script 准备好之前捕获的 "晚加载" 数据
	// 防止 Content Script 加载较慢时丢失早期的 API 响应
	window.__DM_BUFFER = window.__DM_BUFFER || [];

	/**
	 * 通知 Content Script 捕获到的数据
	 * @param {string} type 消息类型 ('DOUYIN_MONITOR_CAPTURE' 或 'DOUYIN_MONITOR_CAPTURE_RESPONSE')
	 * @param {object} payload 数据载荷
	 */
	function notifyContentScript(type, payload) {
		// 特殊处理 material_list：
		// 如果捕获到列表数据，先存入缓冲区，防止 Content Script 初始化延迟导致漏抓
		if (
			type === 'DOUYIN_MONITOR_CAPTURE_RESPONSE' &&
			payload &&
			payload.url &&
			payload.url.indexOf('/pc/selection/common/material_list') !== -1
		) {
			// console.log('[Douyin Monitor Injected] 正在缓冲选品列表数据');
			window.__DM_BUFFER.push(payload);
			// 保持缓冲区大小合理，避免内存溢出 (最多保留最近 20 条)
			if (window.__DM_BUFFER.length > 20) window.__DM_BUFFER.shift();
		}

		// 发送消息给 Content Script
		window.postMessage(
			{
				type: type,
				payload: payload,
			},
			'*'
		);
	}

	// 监听来自 Content Script 的指令 (主动请求)
	// 这个机制允许 Content Script 通过 postMessage 请求页面发起网络请求，
	// 好处是可以自动携带页面的 Cookie 和签名信息，无需 Content Script 模拟复杂的签名。
	window.addEventListener('message', function (event) {
		// 只处理特定的请求发起指令
		if (event.data && event.data.type === 'DOUYIN_MONITOR_FETCH') {
			const {requestId, url, body} = event.data.payload;
			// console.log(
			// 	'[Douyin Monitor Injected] 收到主动请求指令 (使用 XHR 发起):',
			// 	url
			// );

			try {
				const xhr = new window.XMLHttpRequest();
				xhr.open('POST', url, true);
				xhr.setRequestHeader('Content-Type', 'application/json');

				// 请求完成回调
				xhr.onload = function () {
					if (xhr.status >= 200 && xhr.status < 300) {
						try {
							const data = JSON.parse(xhr.responseText);
							// 请求成功，将结果发回 Content Script
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
							// JSON 解析失败
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
						// HTTP 状态码错误
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

				// 网络错误回调
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

				// 发送请求
				xhr.send(body);
			} catch (error) {
				console.error('[Douyin Monitor Injected] XHR 请求发起失败:', error);
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

	/**
	 * 辅助函数：处理并通知请求捕获
	 */
	function captureRequest(url, body, method, headers) {
		if (isTargetUrl(url)) {
			try {
				let bodyStr = body;
				if (typeof body === 'object') {
					bodyStr = JSON.stringify(body);
				}

				console.log('[Douyin Monitor Injected] 捕获目标请求:', url);
				notifyContentScript('DOUYIN_MONITOR_CAPTURE', {
					url: url,
					body: bodyStr,
					method: method,
					headers: headers,
				});
			} catch (e) {
				console.error('[Douyin Monitor Injected] 捕获请求异常:', e);
			}
		}
	}

	/**
	 * 辅助函数：处理并通知响应捕获
	 */
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
	// 2. 拦截 XMLHttpRequest (Monkey Patch)
	// ===========================
	const originalXHR = window.XMLHttpRequest;

	// 防止重复注入
	if (window.originalXHR) return;
	window.originalXHR = originalXHR;

	// 定义代理 XHR 构造函数
	function XHRProxy() {
		const xhr = new originalXHR();
		const originalOpen = xhr.open;
		const originalSetRequestHeader = xhr.setRequestHeader;
		const originalSend = xhr.send;

		// 用于存储请求头
		xhr._requestHeaders = {};

		// 劫持 open 方法：捕获 method 和 url
		xhr.open = function (method, url) {
			this._monitorData = {method, url};
			return originalOpen.apply(this, arguments);
		};

		// 劫持 setRequestHeader 方法：捕获请求头
		xhr.setRequestHeader = function (header, value) {
			this._requestHeaders[header] = value;
			return originalSetRequestHeader.apply(this, arguments);
		};

		// 劫持 send 方法：捕获 request body 并触发请求捕获逻辑
		xhr.send = function (body) {
			if (this._monitorData) {
				// 保存 body 以便后续在响应中使用
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

		// 监听 load 事件：捕获响应数据
		xhr.addEventListener('load', function () {
			// 只有当响应类型为文本或空时才读取 responseText，避免 InvalidStateError
			if (
				this._monitorData &&
				(!this.responseType || this.responseType === 'text')
			) {
				captureResponse(
					this._monitorData.url,
					this.responseText,
					this._monitorData.body // 传递对应的 request body
				);
			}
		});

		return xhr;
	}

	// 复制原生 XHR 的静态属性到代理对象
	for (let key in originalXHR) {
		try {
			XHRProxy[key] = originalXHR[key];
		} catch (e) {}
	}
	XHRProxy.prototype = originalXHR.prototype;

	// 覆盖全局 XMLHttpRequest
	window.XMLHttpRequest = XHRProxy;

	// ===========================
	// 3. 拦截 Fetch (Monkey Patch)
	// ===========================
	const originalFetch = window.fetch;
	window.originalFetch = originalFetch;

	// 覆盖全局 fetch
	window.fetch = async function (...args) {
		let [resource, config] = args;
		let url = resource;

		// 兼容 Request 对象作为第一个参数的情况
		if (resource instanceof Request) {
			url = resource.url;
		}

		// 捕获请求
		if (typeof url === 'string') {
			captureRequest(
				url,
				config ? config.body : null,
				config ? config.method : 'GET',
				config ? config.headers : null
			);
		}

		// 执行原始 fetch
		const response = await originalFetch.apply(this, args);

		// 捕获响应
		if (typeof url === 'string' && isTargetUrl(url)) {
			// 克隆 response 以读取 body 流，避免影响原流程 (body流只能读取一次)
			const clone = response.clone();
			clone
				.text()
				.then((text) => {
					captureResponse(url, text);
				})
				.catch((err) => {
					console.error('[Douyin Monitor Injected] Fetch 响应克隆失败:', err);
				});
		}

		return response;
	};

	console.log('[Douyin Monitor] 注入脚本已加载 (列表功能更新)');
})();
