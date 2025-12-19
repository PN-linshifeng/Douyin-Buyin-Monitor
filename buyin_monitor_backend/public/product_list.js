(function () {
	// 模块加载日志
	console.log(
		'%c [抖音选品数据分析] 商品列表模块已加载',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	// 存储抓取到的商品推广信息缓存
	let savedPromotions = [];

	// 处理接口返回的列表数据
	function processList(payload) {
		const {url, requestBody, body} = payload;
		// url 通常是 /pc/selection/common/material_list

		try {
			// 1. 检查请求体中的 Cursor (翻页标识)
			let reqData = {};
			if (requestBody && typeof requestBody === 'string') {
				reqData = JSON.parse(requestBody);
			} else if (typeof requestBody === 'object') {
				reqData = requestBody;
			}

			// 2. 解析响应体数据
			let resData = {};
			if (body && typeof body === 'string') {
				resData = JSON.parse(body);
			} else if (typeof body === 'object') {
				resData = body;
			}

			if (reqData.cursor === 0 || reqData.cursor === '0') {
				savedPromotions = [];
			}

			// 3. 追加推广信息到缓存
			if (resData && resData.data && resData.data.summary_promotions) {
				const promotions = resData.data.summary_promotions;
				savedPromotions = savedPromotions.concat(promotions);
			}
			console.log(savedPromotions);
			// 数据更新后尝试注入按钮
			setTimeout(injectButtons, 500);
		} catch (e) {
			console.error('[商品列表] 处理列表数据出错:', e);
		}
	}

	// ===========================
	// UI & Interaction
	// ===========================

	// 根据商品名称查找缓存的推广信息
	function findPromotionByName(name) {
		if (!name) return null;
		// 移除所有空格以进行从模糊匹配
		const cleanName = name.replace(/\s+/g, '');
		return savedPromotions.find((p) => {
			const pName = p?.base_model?.product_info?.name;
			if (!pName) return false;
			const cleanPName = pName.replace(/\s+/g, '');
			return cleanPName === cleanName;
		});
	}

	// 处理"获取选品数据"按钮点击事件
	function handleGetSelectionData(btn) {
		const name = btn.getAttribute('name');
		if (!name) {
			alert('无法获取商品名称');
			return;
		}

		console.log('[商品列表] 点击获取商品:', name);

		const promo = findPromotionByName(name);
		if (promo) {
			console.log('[商品列表] 找到匹配数据:', promo);
			const promotionId = promo.promotion_id; // 从对象中获取 promotion_id

			if (window.ProductInfo && window.ProductInfo.analyzeAndShow) {
				window.ProductInfo.analyzeAndShow(promotionId);
			} else {
				alert('ProductInfo 模块未加载');
			}
		} else {
			console.warn('[商品列表] 未找到匹配商品:', name);
			alert('未在缓存数据中找到该商品，请尝试滚动加载或刷新页面');
		}
	}

	// 向页面商品列表中注入"获取选品数据"按钮
	function injectButtons() {
		const wrappers = document.querySelectorAll(
			'.index_module__wrapper___dadac'
		);
		wrappers.forEach((wrapper) => {
			// 1. 获取商品名称
			const timingEl =
				wrapper.querySelector('.index_module__oneLine___dadac') ||
				wrapper.querySelector('.index_module__title___dadac');
			if (!timingEl) return;
			const name = timingEl.innerText || timingEl.textContent;

			// 2. 检查或创建按钮
			let btn = wrapper.querySelector('.douyin-monitor-list-btn');
			if (!btn) {
				btn = document.createElement('button');
				btn.innerText = '获取选品数据';
				btn.className = 'douyin-monitor-list-btn';
				btn.style.cssText = `
                    display: block;
                    margin: 5px auto;
                    padding: 4px 10px;
                    background-color: #fe2c55;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    z-index: 100;
                    position: relative; 
                `;

				btn.onclick = (e) => {
					e.stopPropagation(); // 阻止点击事件冒泡(防止触发卡片点击)
					handleGetSelectionData(btn);
				};
				wrapper.appendChild(btn);
			}

			// 3. 更新按钮属性 (即使按钮已存在也要更新，防止复用问题)
			btn.setAttribute('name', name);
		});
	}

	// 初始化函数
	function init() {
		// 初始检查
		// 等待页面渲染

		// 1. 处理缓冲的数据 (Buffer)
		if (window.__DM_BUFFER && window.__DM_BUFFER.length > 0) {
			window.__DM_BUFFER.forEach((payload) => {
				processList(payload);
			});
			setTimeout(injectButtons, 2000);
		}

		// 2. 监听来自 Injected Script 的新消息
		window.addEventListener('message', (event) => {
			if (event.source !== window) return;
			if (event.data.type === 'DOUYIN_MONITOR_CAPTURE_RESPONSE') {
				const payload = event.data.payload;
				if (payload.url.indexOf('/pc/selection/common/material_list') !== -1) {
					processList(payload);
				}
			}
		});
	}

	// Start
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	window.ProductList = {
		processList,
	};
})();
