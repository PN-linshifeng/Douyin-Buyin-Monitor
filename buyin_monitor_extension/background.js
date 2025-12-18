let lastCapturedData = {
	url: null,
	headers: null,
};

chrome.runtime.onInstalled.addListener(() => {
	console.log('Douyin Buyin Monitor Extension Installed');
});

// 监听网络请求以获取完整的 URL 和 Headers
chrome.webRequest.onBeforeSendHeaders.addListener(
	(details) => {
		if (details.url.includes('/pc/selection/decision/pack_detail')) {
			// 将 headers 数组转换为对象以便 fetch 使用
			const headerMap = {};
			if (details.requestHeaders) {
				details.requestHeaders.forEach((h) => {
					headerMap[h.name] = h.value;
				});
			}

			lastCapturedData = {
				url: details.url,
				headers: headerMap,
			};
			console.log('Background captured latest request:', details.url);
		}
	},
	{urls: ['*://buyin.jinritemai.com/*']},
	['requestHeaders', 'extraHeaders']
);

// 响应 Content Script 的请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.type === 'GET_LATEST_URL') {
		sendResponse({
			success: true,
			url: lastCapturedData.url,
		});
	}
	// 代理请求 (用于绕过页面 CSP/Mixed Content 限制)
	if (request.type === 'PROXY_REQUEST') {
		handleProxyRequest(request, sendResponse);
		return true; // 异步响应
	}
	// 保留 EXECUTE_REQUEST 以防万一，或者可以删除。根据用户需求，现在主要是 Content 请求。
	if (request.type === 'EXECUTE_REQUEST') {
		handleExecuteRequest(request, sendResponse);
		return true; // 保持消息通道开启以进行异步响应
	}
	if (request.type === 'INJECT_REMOTE_SCRIPT') {
		handleInjectRemoteScript(request, sender, sendResponse);
		return true;
	}
});

async function handleProxyRequest(request, sendResponse) {
	try {
		const {url, method, headers, body} = request;
		const fetchOptions = {
			method: method || 'GET',
			headers: headers || {},
			credentials: 'include', // 保持 Cookie
		};
		if (body) {
			fetchOptions.body =
				typeof body === 'object' ? JSON.stringify(body) : body;
		}

		const response = await fetch(url, fetchOptions);

		// 尝试解析 JSON，如果失败则返回文本
		let data;
		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			data = await response.json();
		} else {
			data = await response.text(); // 或者根据需求处理
		}

		sendResponse({
			success: response.ok,
			status: response.status,
			data: data,
		});
	} catch (error) {
		console.error('Proxy request failed:', error);
		sendResponse({
			success: false,
			error: error.message,
		});
	}
}

async function handleExecuteRequest(request, sendResponse) {
	if (!lastCapturedData.url) {
		sendResponse({success: false, error: 'Background 尚未捕获到有效请求'});
		return;
	}

	try {
		console.log('Processing request for days:', request.days);

		// 1. 处理 URL：移除不需要的签名参数
		const urlObj = new URL(lastCapturedData.url);
		urlObj.searchParams.delete('a_bogus');
		urlObj.searchParams.delete('msToken');
		// 保留 ewid, verifyFp, fp 等，因为它们在 captured URL 里

		const targetUrl = urlObj.toString();

		// 2. 处理 Headers
		const headers = {...lastCapturedData.headers};
		// 移除可能导致校验失败或不需要的头
		delete headers['Content-Length'];
		delete headers['Host'];
		delete headers['Origin']; // Fetch 会自动设置
		delete headers['Referer']; // Fetch 会自动设置
		// 确保 Content-Type 正确
		headers['Content-Type'] = 'application/json';

		// 3. 发起请求
		const response = await fetch(targetUrl, {
			method: 'POST',
			headers: headers,
			body: request.body,
		});

		if (!response.ok) {
			throw new Error(`Server error: ${response.status}`);
		}

		const data = await response.json();
		sendResponse({success: true, data: {days: request.days, data: data}});
	} catch (error) {
		console.error('Proxy fetch failed:', error);
		sendResponse({success: false, error: error.message});
	}
}

async function handleInjectRemoteScript(request, sender, sendResponse) {
	try {
		const {url} = request;
		// 1. Fetch 脚本内容 (Background 有 host_permissions，不受跨域限制)
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Script fetch failed: ${response.status}`);
		}
		const code = await response.text();

		// 2. 注入执行 (Main World)
		// 注意: 这仍然受页面 CSP (unsafe-eval) 限制，但绕过了 script-src 限制
		if (sender.tab && sender.tab.id) {
			await chrome.scripting.executeScript({
				target: {tabId: sender.tab.id},
				world: 'MAIN',
				func: (codeContent) => {
					console.log('[Douyin Monitor] Executing remote script in Main World');
					try {
						// 使用 window.eval 确保在全局作用域执行
						window.eval(codeContent);
					} catch (e) {
						console.error(
							'[Douyin Monitor] Remote script execution failed:',
							e
						);
						// 尝试即使 eval 失败也打个 log
						if (e.message.includes('Content Security Policy')) {
							console.error(
								'[Douyin Monitor] 页面 CSP 阻止了 eval 执行，请检查页面策略。'
							);
						}
					}
				},
				args: [code],
			});
			sendResponse({success: true});
		} else {
			throw new Error('No sender tab attached');
		}
	} catch (e) {
		console.error('Inject remote script error:', e);
		sendResponse({success: false, error: e.message});
	}
}
