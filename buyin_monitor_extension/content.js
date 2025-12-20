(function () {
	console.log(
		'%c [Douyin Monitor] Content Script Loaded v2.0 (Dynamic Loader)',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

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

	function createLoginModal() {
		if (document.getElementById('douyin-monitor-login')) return;

		const modal = document.createElement('div');
		modal.id = 'douyin-monitor-login';
		modal.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 300px;
            background: #fff;
            padding: 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-radius: 8px;
            z-index: 10001;
            font-family: sans-serif;
            border: 1px solid #eee;
        `;

		const title = document.createElement('h3');
		title.innerText = 'Douyin Monitor 登录';
		title.style.margin = '0 0 15px 0';
		title.style.fontSize = '16px';
		title.style.color = '#333';
		modal.appendChild(title);

		const input = document.createElement('input');
		input.type = 'text';
		input.placeholder = '输入手机号 (如: 13800138000)';
		input.style.cssText = `
            width: 100%;
            padding: 8px;
            margin-bottom: 15px;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 4px;
        `;
		// 方便测试
		input.value = '13800138000';
		modal.appendChild(input);

		const btn = document.createElement('button');
		btn.innerText = '登录并加载';
		btn.style.cssText = `
            width: 100%;
            padding: 8px;
            background: #fe2c55;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        `;
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
					if (res.status === 403 || result.message.includes('过期')) {
						alert('账号过期');
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
		try {
			const token = localStorage.getItem('dm_token');
			console.log(
				'[Douyin Monitor] Local Token:',
				token ? token.substring(0, 10) + '...' : 'null'
			);
			const headers = {};
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
			headers['x-device-fingerprint'] = await getFingerprint();

			// 在调用 check-auth 时，浏览器会自动带上 localhost:3000 的 cookie (connect.sid)
			// 前提是浏览器已设置为允许跨站 cookie 或 SameSite 策略允许。
			// 由于这是 extension content script，且 host_permissions 已添加，fetch 应该能带 cookie。
			// 但需注意: 如果后端没设置 cors origin allow credentials，可能会失败。
			// server.js 里的 cors 配置是 { origin: '*', credentials: true }。
			// origin: '*' 和 credentials: true 在标准这一起是不允许的。
			// 实际上 nodejs cors 库如果看到 credentials true, origin设为 * 可能不会工作，
			// 或者需要前端 fetch 手动指定 credentials: 'include'。

			// 我们先尝试 fetch
			const proxyRes = await sendProxyRequest(
				`${BACKEND_URL}/api/extension/check-auth`,
				'GET',
				headers
			);

			console.log('[Douyin Monitor] Check Auth Status:', proxyRes.status);

			// 背景脚本发起的请求会自动处理 Cookie (如果后端设置了 Origin 处理)
			const data = proxyRes.data || {};
			if (data.success && data.scripts) {
				console.log('[Douyin Monitor] 自动登录成功');
				data.scripts.forEach((url) => {
					console.log('[Douyin Monitor] Loading remote script:', url);
					injectScript(url, true);
				});
			} else {
				console.log('[Douyin Monitor] 未登录，显示登录框');
				// 如果本地有 token 但验证失败，说明过期了，清除它
				if (token) localStorage.removeItem('dm_token');
				createLoginModal();
			}
		} catch (e) {
			console.error('[Douyin Monitor] 自动登录检查失败', e);
			createLoginModal();
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', checkLoginState);
	} else {
		checkLoginState();
	}
})();
