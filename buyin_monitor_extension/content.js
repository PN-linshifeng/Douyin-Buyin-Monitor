(function () {
	console.log(
		'%c [Douyin Monitor] Content Script Loaded v2.0 (Dynamic Loader)',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	const BACKEND_URL = 'http://localhost:3000';

	// ===========================
	// 0. 注入拦截脚本 (Main World)
	// ===========================
	function injectScript(file_path, isExternal = false) {
		var node = document.head || document.documentElement;
		var script = document.createElement('script');
		script.setAttribute('type', 'text/javascript');
		if (isExternal) {
			script.src = file_path;
			// 处理加载错误
			script.onerror = () => {
				console.error('[Douyin Monitor] Failed to load script:', file_path);
				alert('加载插件核心脚本失败，请确保后端服务已启动');
			};
		} else {
			script.setAttribute('src', file_path);
		}
		node.appendChild(script);
	}

	try {
		injectScript(chrome.runtime.getURL('injected.js'));
	} catch (e) {
		console.error('[Douyin Monitor] Injection failed:', e);
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

				const res = await fetch(`${BACKEND_URL}/api/extension/login`, {
					method: 'POST',
					credentials: 'include', // 重要：保存 session cookie
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						phone,
						buyinId,
					}),
				});

				const result = await res.json();
				if (result.success) {
					msg.style.color = 'green';
					msg.innerText = '登录成功，正在加载脚本...';

					// 存储 Token
					if (result.token) {
						localStorage.setItem('dm_token', result.token);
					}

					// 动态加载脚本
					if (result.scripts && Array.isArray(result.scripts)) {
						result.scripts.forEach((url) => {
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

			// 在调用 check-auth 时，浏览器会自动带上 localhost:3000 的 cookie (connect.sid)
			// 前提是浏览器已设置为允许跨站 cookie 或 SameSite 策略允许。
			// 由于这是 extension content script，且 host_permissions 已添加，fetch 应该能带 cookie。
			// 但需注意: 如果后端没设置 cors origin allow credentials，可能会失败。
			// server.js 里的 cors 配置是 { origin: '*', credentials: true }。
			// origin: '*' 和 credentials: true 在标准这一起是不允许的。
			// 实际上 nodejs cors 库如果看到 credentials true, origin设为 * 可能不会工作，
			// 或者需要前端 fetch 手动指定 credentials: 'include'。

			// 我们先尝试 fetch
			const response = await fetch(`${BACKEND_URL}/api/extension/check-auth`, {
				headers: headers,
				// credentials: 'include', // 如果用 Token，这行不再关键，但留着无妨
			});

			console.log('[Douyin Monitor] Check Auth Status:', response.status);

			// !注意!：Content Script 对 localhost 发起 fetch，如果不设置 credentials: 'include'，是不会带 cookie 的。
			// 但如果后端 cors origin 是 *，设置 credentials include 会报错。
			// 鉴于目前是开发环境，且 content script 权限较大，我们先假设用户会在弹窗登录一次（那次是 fetch，会 set-cookie）。
			// 等等，fetch set-cookie 对 content script 来说是存到了 localhost 域下。
			// 之后的 fetch 如果带 credentials: 'include' 就能带上。
			//
			// 修正 server.js 的 cors 问题：为了支持 credentials，origin 不能是 *。
			// 但 extension 的 origin 是什么？是 `chrome-extension://...` 还是页面域 `https://buyin...`?
			// Content script 的 fetch origin 是当前页面域 `https://buyin.jinritemai.com`。
			// 所以 server.js 应该反射 origin。

			const data = await response.json();
			if (data.success && data.scripts) {
				console.log('[Douyin Monitor] 自动登录成功');
				data.scripts.forEach((url) => injectScript(url, true));
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

	// ===========================
	// 2. 消息代理 (Content Script <-> Injected)
	// ===========================
	// 由于现在 ProductList 可能在 Main World 运行，它如果有直接监听 window message，
	// 就不需要我们这里做太多事情，除非它依赖 content script 特有的 chrome.runtime API。
	// 目前来看，background 通信主要由 content script 处理。
	// 但是 content script 仍然监听 `DOUYIN_MONITOR_CAPTURE_RESPONSE`。
	// 如果 product_list.js 移到了 Main World，content script 的 window.ProductList 将是 undefined。
	// 所以我们需要调整一下：
	// 让 Main World 的 ProductList 直接监听事件？
	// 或者 Content Script 收到消息后，转发回 Main World（这看起来多余，因为消息本身就是在 Main World 触发的）
	//
	// !重要!: `injected.js` 发出的 postMessage 目标是 '*', 所以 Main World 里的其他脚本也能收到。
	// 所以只要 `product_list.js` 正确添加了 window.addEventListener('message', ...)，它就能工作。
	// 我们唯一需要担心的是 `product_info.js` 里的 `sendInjectedRequest` 也是通过 postMessage。
	//
	// 所以，这里 content.js 的主要职责就是 "加载器"。
	// 之前的 message listener 这里可以保留用于调试，或者移除。
	// 为了兼容性，我暂时注释掉对 window.ProductList 的调用，避免报错。
})();
