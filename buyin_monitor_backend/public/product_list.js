(function () {
	console.log(
		'%c [Douyin Monitor] ProductList Module Loaded',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	let savedPromotions = [];

	function processList(payload) {
		const {url, requestBody, body} = payload;
		// url is usually /pc/selection/common/material_list

		try {
			// 1. Check Cursor from Request Body
			let reqData = {};
			if (requestBody && typeof requestBody === 'string') {
				reqData = JSON.parse(requestBody);
			} else if (typeof requestBody === 'object') {
				reqData = requestBody;
			}

			// cursor check: "if body's cursor equals 0, clear saved data"
			// Note: reqData.cursor might be '0' or 0
			if (reqData.cursor === 0 || reqData.cursor === '0') {
				console.log('[ProductList] Cursor is 0, clearing saved promotions.');
				savedPromotions = [];
			}

			// 2. Parse Response Body
			let resData = {};
			if (body && typeof body === 'string') {
				resData = JSON.parse(body);
			} else if (typeof body === 'object') {
				resData = body;
			}

			// 3. Append Promotions
			if (resData && resData.data && resData.data.summary_promotions) {
				const promotions = resData.data.summary_promotions;
				savedPromotions = savedPromotions.concat(promotions);
				console.log(
					`[ProductList] Appended ${promotions.length} itmes. Total: ${savedPromotions.length}`
				);
			}
		} catch (e) {
			console.error('[ProductList] Error processing list data:', e);
		}
	}

	// ===========================
	// UI & Interaction
	// ===========================

	function findPromotionByName(name) {
		if (!name) return null;
		// Remove ALL spaces for matching
		const cleanName = name.replace(/\s+/g, '');
		return savedPromotions.find((p) => {
			const pName = p?.base_model?.product_info?.name;
			if (!pName) return false;
			const cleanPName = pName.replace(/\s+/g, '');
			return cleanPName === cleanName;
		});
	}

	function handleGetSelectionData(btn) {
		// Parent Wrapper: .index_module__wrapper___dadac
		// Context: The button is appended TO the wrapper.
		const wrapper = btn.closest('.index_module__wrapper___dadac');

		if (!wrapper) {
			console.error('Wrapper not found for button');
			alert('无法找到商品容器');
			return;
		}

		// Target: child with class "index_module__title___dadac" or "index_module__oneLine___dadac"
		const timingEl =
			wrapper.querySelector('.index_module__oneLine___dadac') ||
			wrapper.querySelector('.index_module__title___dadac');
		if (!timingEl) {
			alert('无法找到商品名称元素');
			return;
		}

		const name = timingEl.innerText || timingEl.textContent;
		console.log('[ProductList] Clicked for name:', name);

		const promo = findPromotionByName(name);
		if (promo) {
			console.log('[ProductList] Found match:', promo);
			const promotionId = promo.promotion_id; // promotion_id from object

			if (window.ProductInfo && window.ProductInfo.analyzeAndShow) {
				window.ProductInfo.analyzeAndShow(promotionId);
			} else {
				alert('ProductInfo module not loaded');
			}
		} else {
			console.warn('[ProductList] No match found for:', name);
			alert('未在缓存数据中找到该商品，请尝试滚动加载或刷新页面');
		}
	}

	function injectButtons() {
		const wrappers = document.querySelectorAll(
			'.index_module__wrapper___dadac'
		);
		wrappers.forEach((wrapper) => {
			// Check if button already exists
			if (wrapper.querySelector('.douyin-monitor-list-btn')) return;

			// Create Button
			const btn = document.createElement('button');
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
			// Position: "新增一个按钮" - usually append at end or explicit position
			// Appending to wrapper

			btn.onclick = (e) => {
				e.stopPropagation(); // prevent card click
				handleGetSelectionData(btn);
			};

			wrapper.appendChild(btn);
		});
	}

	// Observer to handle dynamic loading
	const observer = new MutationObserver((mutations) => {
		let shouldInject = false;
		for (const m of mutations) {
			if (m.addedNodes.length > 0) {
				shouldInject = true;
				break;
			}
		}
		if (shouldInject) {
			injectButtons();
		}
	});

	function init() {
		observer.observe(document.body, {childList: true, subtree: true});
		// Initial check
		setTimeout(injectButtons, 2000); // Wait a bit for initial render

		// 1. Process Buffered Data
		if (window.__DM_BUFFER && window.__DM_BUFFER.length > 0) {
			console.log(
				`[ProductList] Processing ${window.__DM_BUFFER.length} buffered items`
			);
			window.__DM_BUFFER.forEach((payload) => {
				processList(payload);
			});
			// Optional: Clear buffer or keep it?
			// Better keep it or mark processed if we don't want re-processing,
			// but processList handles concatenation.
		}

		// 2. Listen for future messages direct from Injected Script
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
