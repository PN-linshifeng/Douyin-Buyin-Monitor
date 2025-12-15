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
	// 保留 EXECUTE_REQUEST 以防万一，或者可以删除。根据用户需求，现在主要是 Content 请求。
	if (request.type === 'EXECUTE_REQUEST') {
		handleExecuteRequest(request, sendResponse);
		return true; // 保持消息通道开启以进行异步响应
	}
});

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
