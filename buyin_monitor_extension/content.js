(function () {
	console.log(
		'%c [Douyin Monitor] Content Script Loaded v1.5 (Isolated World)',
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
	window.addEventListener(
		'message',
		function (event) {
			if (event.source !== window) return;

			// 监听详细页面的 pack_detail 捕获通知
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
				// updateButtonState(true);
			}
			// 监听选品页面的 material_list 响应
			if (event.data.type === 'DOUYIN_MONITOR_CAPTURE_RESPONSE') {
				const payload = event.data.payload;
				// Check for material_list
				if (payload.url.indexOf('/pc/selection/common/material_list') !== -1) {
					console.log(
						'[Douyin Monitor Content] Received material_list response'
					);
					if (window.ProductList && window.ProductList.processList) {
						window.ProductList.processList(payload);
					} else {
						console.warn('ProductList module not loaded');
					}
				}
			}
			// Note: FETCH_RESULT is now handled in product_info.js
		},
		false
	);
})();
