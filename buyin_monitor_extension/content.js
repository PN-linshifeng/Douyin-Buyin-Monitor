(function () {
	console.log(
		'%c [Douyin Monitor] Content Script Loaded v2.0 (Dynamic Loader)',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	// const BACKEND_URL = 'http://8.148.4.165:3308';
	const BACKEND_URL = 'http://127.0.0.1:3308';

	// 辅助函数: 通过 Background 代理请求，绕过 Mixed Content / CSP 限制
	function sendProxyRequest(url, method = 'GET', headers = {}, body = null) {
		return new Promise((resolve, reject) => {
			chrome.runtime.sendMessage(
				{
					type: 'PROXY_REQUEST',
					url,
					method,
					headers,
					body,
				},
				(response) => {
					if (chrome.runtime.lastError) {
						reject(chrome.runtime.lastError);
					} else {
						resolve(response);
					}
				}
			);
		});
	}

	// 监听来自 Pages 的消息 (product_info.js)
	window.addEventListener('message', async function (event) {
		if (event.source !== window) return;

		if (event.data.type === 'DOUYIN_MONITOR_CALCULATE_STATS') {
			const {requestId, payload} = event.data;
			try {
				const token = localStorage.getItem('dm_token');
				const fingerprint = await getFingerprint();

				const response = await sendProxyRequest(
					`${BACKEND_URL}/api/extension/calculate_stats`,
					'POST',
					{
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
						'x-device-fingerprint': fingerprint,
					},
					payload
				);

				const apiResult = response.data || {};
				const isSuccess = response.success && apiResult.success;

				window.postMessage(
					{
						type: 'DOUYIN_MONITOR_FETCH_RESULT',
						requestId: requestId,
						success: isSuccess,
						data: apiResult.data,
						error: apiResult.message || response.error || '计算请求失败',
					},
					'*'
				);
			} catch (e) {
				console.error('Calculate stats proxy error:', e);
				window.postMessage(
					{
						type: 'DOUYIN_MONITOR_FETCH_RESULT',
						requestId,
						success: false,
						error: e.message,
					},
					'*'
				);
			}
		}
	});

	// ===========================
	// 0. 注入拦截脚本 (Main World)
	// ===========================
	function injectScript(file_path, isExternal = false) {
		if (isExternal) {
			// 通过 Background 注入远程脚本 (绕过页面 CSP script-src)
			console.log(
				'[Douyin Monitor] Requesting background to inject:',
				file_path
			);
			chrome.runtime.sendMessage(
				{
					type: 'INJECT_REMOTE_SCRIPT',
					url: file_path,
				},
				(response) => {
					if (!response || !response.success) {
						console.error(
							'[Douyin Monitor] Failed to inject remote script:',
							file_path,
							response?.error || chrome.runtime.lastError
						);
						// 回退或报错提示
						if (
							response?.error &&
							(response.error.includes('Content Security Policy') ||
								response.error.includes('eval'))
						) {
							alert('无法执行远程脚本：页面 CSP 策略过严 (禁止 eval)');
						}
					} else {
						console.log('[Douyin Monitor] Remote script injected successfully');
					}
				}
			);
			return;
		}

		// 本地资源注入 (injected.js)
		var node = document.head || document.documentElement;
		var script = document.createElement('script');
		script.setAttribute('type', 'text/javascript');
		script.setAttribute('src', file_path);
		node.appendChild(script);
	}

	try {
		injectScript(chrome.runtime.getURL('ui.js'));
		injectScript(chrome.runtime.getURL('injected.js'));
	} catch (e) {
		console.error('[Douyin Monitor] Injection failed:', e);
	}

	// ===========================
	// 0.5 指纹生成逻辑 (FingerprintJS)
	// ===========================
	async function getFingerprint() {
		try {
			// FingerprintJS 在 fp.js 加载后会挂载到 window.FingerprintJS
			if (typeof FingerprintJS === 'undefined') {
				console.error('FingerprintJS library not loaded');
				return 'unknown_device_lib_missing';
			}
			const fp = await FingerprintJS.load();
			// get() 返回 { visitorId: "..." }
			const result = await fp.get();
			return result.visitorId;
		} catch (e) {
			console.error('Fingerprint generation failed:', e);
			return 'unknown_device_error';
		}
	}

	// ===========================
	// 1. 登录 UI & 逻辑
	// ===========================
	async function getBuyinAccountInfo() {
		try {
			const response = await fetch('/api/hybrid/account/info');
			const data = await response.json();
			if (data && data.data && data.data.buyin_account_id) {
				return data.data.buyin_account_id;
			}
		} catch (e) {
			console.error('Failed to get buyin account info:', e);
		}
		return '';
	}

	function makeElementDraggable(element, handle) {
		handle = handle || element;
		let isDragging = false;
		let startX, startY, initialLeft, initialTop;
		let moveThreshold = 5;
		let hasMoved = false;

		handle.style.cursor = 'move';

		handle.onmousedown = function (e) {
			isDragging = true;
			hasMoved = false;
			startX = e.clientX;
			startY = e.clientY;

			const rect = element.getBoundingClientRect();
			initialLeft = rect.left;
			initialTop = rect.top;

			// 切换为具体坐标，防止定位丢失
			element.style.left = initialLeft + 'px';
			element.style.top = initialTop + 'px';
			element.style.right = 'auto';
			element.style.bottom = 'auto';

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
			e.preventDefault();
		};

		function onMouseMove(e) {
			if (!isDragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
				hasMoved = true;
			}

			if (hasMoved) {
				element.style.left = initialLeft + dx + 'px';
				element.style.top = initialTop + dy + 'px';
			}
		}

		function onMouseUp() {
			isDragging = false;
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}

		// 返回是否发生了移动，用于逻辑判断
		return () => hasMoved;
	}

	function createWidgetContainer() {
		if (document.getElementById('dm-main-widget')) return;

		const widget = document.createElement('div');
		widget.id = 'dm-main-widget';

		// Header (Logo)
		const header = document.createElement('div');
		header.id = 'dm-widget-header';
		const logoImg = document.createElement('img');
		logoImg.src = chrome.runtime.getURL('images/logo.jpeg');
		logoImg.alt = 'Logo';
		header.appendChild(logoImg);

		// Body (Buttons placeholder)
		const body = document.createElement('div');
		body.id = 'dm-widget-body';

		// Drag 逻辑
		const getHasMoved = makeElementDraggable(widget, header);

		// Toggle logic (仅在没有大幅度拖拽时触发)
		header.onclick = (e) => {
			if (!getHasMoved()) {
				body.classList.toggle('collapsed');
			}
		};

		widget.appendChild(header);
		widget.appendChild(body);
		document.body.appendChild(widget);
		console.log('[Douyin Monitor] Widget Container Created (Draggable)');
	}

	function createLoginModal() {
		if (document.getElementById('douyin-monitor-login')) return;

		const modal = document.createElement('div');
		modal.id = 'douyin-monitor-login';
		modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 320px;
            background: #fff;
            padding: 30px 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            border-radius: 16px;
            z-index: 100001;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            border: 1px solid #f0f0f0;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        `;

		// Logo Header
		const logoImg = document.createElement('img');
		logoImg.src = chrome.runtime.getURL('images/logo.jpeg');
		logoImg.style.cssText = `
            width: 80px;
            height: 80px;
            border-radius: 50%;
            margin-bottom: 20px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        `;
		modal.appendChild(logoImg);

		const title = document.createElement('div');
		title.innerText = 'AI 选品助手';
		title.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 25px;
        `;
		modal.appendChild(title);

		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = '输入手机号';
		input.style.cssText = `
            width: 100%;
            padding: 12px;
            margin-bottom: 20px;
            box-sizing: border-box;
            border: 1px solid #eee;
            border-radius: 8px;
            background: #f9f9f9;
            font-size: 14px;
            outline: none;
            transition: border-color 0.3s;
        `;
		input.onfocus = () => (input.style.borderColor = '#1966ff');
		input.onblur = () => (input.style.borderColor = '#eee');
		// 方便测试
		input.value = '13800138000';
		modal.appendChild(input);

		const btn = document.createElement('button');
		btn.innerText = '立即登录';
		if (window.DM_UI) {
			btn.style.cssText = window.DM_UI.getButtonStyle(
				window.DM_UI.colors.primary
			);
		} else {
			btn.style.cssText = `
				width: 100%;
				padding: 12px;
				background: #1966ff;
				color: #fff;
				border: none;
				border-radius: 8px;
				cursor: pointer;
				font-weight: bold;
			`;
		}
		modal.appendChild(btn);

		const msg = document.createElement('div');
		msg.style.marginTop = '10px';
		msg.style.fontSize = '12px';
		msg.style.color = '#f00';
		modal.appendChild(msg);

		btn.onclick = async () => {
			const phone = input.value.trim();
			if (!phone) {
				msg.innerText = '请输入手机号';
				return;
			}
			msg.innerText = '正在获取账户信息...';
			btn.disabled = true;

			try {
				const buyinId = await getBuyinAccountInfo();
				msg.innerText = '正在验证...';

				// 获取指纹 (异步)
				const fingerprint = await getFingerprint();

				const proxyRes = await sendProxyRequest(
					`${BACKEND_URL}/api/extension/login`,
					'POST',
					{
						'Content-Type': 'application/json',
					},
					{phone, buyinId, fingerprint}
				);

				if (!proxyRes.success && !proxyRes.data) {
					throw new Error(proxyRes.error || 'Network Error');
				}
				const result = proxyRes.data;
				const res = {status: proxyRes.status}; // 模拟 response 对象以兼容后续逻辑
				if (result.success) {
					msg.style.color = 'green';
					msg.innerText = '登录成功，正在加载脚本...';

					// 存储 Token
					if (result.token) {
						localStorage.setItem('dm_token', result.token);
					}

					// 创建容器
					createWidgetContainer();

					// 动态加载脚本 (强制转为加载本地扩展资源以符合 CSP)
					if (result.scripts && Array.isArray(result.scripts)) {
						result.scripts.forEach((url) => {
							console.log('[Douyin Monitor] Loading remote script:', url);
							injectScript(url, true);
						});
					}

					setTimeout(() => {
						modal.remove();
					}, 1000);
				} else {
					msg.style.color = 'red';
					msg.innerText = result.message || '登录失败';
					// 如果是过期，弹窗提示
					if (res.status === 403) {
						alert(result.message);
					}
					btn.disabled = false;
				}
			} catch (e) {
				console.error(e);
				msg.style.color = 'red';
				msg.innerText = '请求失败，请检查后端服务';
				btn.disabled = false;
			}
		};

		document.body.appendChild(modal);
	}

	// 启动逻辑
	async function checkLoginState() {
		const token = localStorage.getItem('dm_token');

		// 1. 如果完全没有 Token，说明是首次或已登出，直接弹出
		if (!token) {
			console.log('[Douyin Monitor] 无 Token，显示登录框');
			createLoginModal();
			return;
		}

		try {
			console.log(
				'[Douyin Monitor] 检测到 Local Token:',
				token.substring(0, 10) + '...'
			);

			const headers = {
				Authorization: `Bearer ${token}`,
				'x-device-fingerprint': await getFingerprint(),
			};

			const proxyRes = await sendProxyRequest(
				`${BACKEND_URL}/api/extension/check-auth`,
				'GET',
				headers
			);

			console.log('[Douyin Monitor] Check Auth Code:', proxyRes.status);

			const data = proxyRes.data || {};

			if (proxyRes.success && data.success && data.scripts) {
				console.log('[Douyin Monitor] 自动登录/验证成功');

				// 创建容器
				function tryCreate() {
					if (document.body) {
						if (document.getElementById('dm-main-widget')) return;
						createWidgetContainer();
					} else {
						setTimeout(tryCreate, 100);
					}
				}
				tryCreate();

				data.scripts.forEach((url) => {
					console.log('[Douyin Monitor] Loading remote script:', url);
					injectScript(url, true);
				});
			} else {
				// 2. 只有在后端明确返回 401/403 或特定的业务失败码时，才视为登录失效
				if (
					proxyRes.status === 401 ||
					proxyRes.status === 403 ||
					data.code === 401
				) {
					console.log('[Douyin Monitor] 登录失效，清除 Token 并弹出');
					localStorage.removeItem('dm_token');
					createLoginModal();
				} else {
					console.warn(
						'[Douyin Monitor] 状态检查失败(非授权错误)，暂不处理:',
						proxyRes.error || 'Unknown Error'
					);
					// 可以在此处添加一个轻提示，告诉用户服务连接异常，而不是强制登录
				}
			}
		} catch (e) {
			// 3. 网络请求异常 (如后端 502/断连)，绝不强制弹出登录框
			console.error('[Douyin Monitor] 网络异常，跳过自动弹出:', e);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', checkLoginState);
	} else {
		checkLoginState();
	}
})();
