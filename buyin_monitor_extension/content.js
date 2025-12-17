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
				// updateButtonState(true);
			}

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

	// ===========================
	// 2. UI 逻辑 (按钮部分)
	// ===========================

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
			debugger;
			const localeUrl = new URL(location.href);

			const promotionId = localeUrl.searchParams.get('commodity_id');
			if (!isDrag) handleBtnClick(promotionId);
		};

		if (window.ProductInfo && window.ProductInfo.makeDraggable) {
			window.ProductInfo.makeDraggable(btn);
		} else {
			console.warn('ProductInfo module not loaded yet');
		}

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

	async function handleBtnClick(promotionId) {
		if (window.ProductInfo && window.ProductInfo.analyzeAndShow) {
			window.ProductInfo.analyzeAndShow(promotionId);
		}
	}

	createButton();
})();
