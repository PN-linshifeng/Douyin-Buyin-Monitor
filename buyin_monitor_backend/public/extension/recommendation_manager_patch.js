(function () {
	console.log(
		'%c [抖音选品] 推荐管理模块已加载',
		'color: #1890ff; font-weight: bold; font-size: 14px;'
	);
	const STORAGE_KEY = 'DM_RECOMMENDED_PRODUCTS';

	// Storage Helpers
	function getStore() {
		try {
			return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		} catch (e) {
			console.error('读取缓存失败', e);
			return {};
		}
	}

	function saveStore(data) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	}

	function removeProduct(id) {
		const store = getStore();
		if (store[id]) {
			delete store[id];
			saveStore(store);
			renderTableBody(); // 仅重新渲染表格内容
		}
	}

	// UI Components
	let popupInstance = null;
	let tableBodyInstance = null;

	function createButton() {
		// 避免重复创建
		if (document.getElementById('dm-recommendation-btn')) return;

		// 等待容器 dm-widget-body
		const container = document.getElementById('dm-widget-body');
		if (!container) {
			// 如果容器还没准备好，稍后重试（由 init 的定时器或递归调用处理）
			return;
		}

		const btn = document.createElement('button');
		btn.id = 'dm-recommendation-btn';
		btn.innerText = '推荐选品';
		btn.className = 'dm-button dm-btn-success dm-btn-large';

		// 样式：适配 widget 内部
		if (window.DM_UI) {
			// 使用自定义颜色 (例如紫色) 区分
			// btn.style.cssText = window.DM_UI.getButtonStyle('#722ed1', true);
			btn.style.setProperty('width', '100%', 'important');
			btn.style.marginBottom = '6px';
		}

		btn.onclick = showPopup;
		container.appendChild(btn);
	}

	function showPopup() {
		if (popupInstance) {
			popupInstance.style.display = 'block';
			renderTableBody();
			return;
		}

		// 使用 UI 库创建弹窗
		if (!window.DM_UI || !window.DM_UI.createDarkPopup) {
			console.error('UI 库未加载或版本过旧，无法创建弹窗');
			alert(
				'检测到 UI 库未更新，请在扩展管理页点击“重载”按钮更新插件，然后刷新本页。'
			);
			return;
		}

		const result = window.DM_UI.createDarkPopup({
			id: 'dm-rec-popup',
			title: '推荐选品列表',
			zIndex: 9000,
		});

		const {container, content, actionsDiv, closeBtn} = result;
		popupInstance = container;

		// 添加收起/展开按钮
		const toggleBtn = document.createElement('button');
		toggleBtn.innerText = '🔼';
		toggleBtn.style.cssText = `
			background: transparent;
			border: none;
			color: #ccc;
			font-size: 14px;
			cursor: pointer;
			padding: 4px;
		`;

		let isExpanded = true;
		toggleBtn.onclick = () => {
			isExpanded = !isExpanded;
			toggleBtn.innerText = isExpanded ? '🔼' : '🔽';
			content.style.display = isExpanded ? 'block' : 'none';

			// 定位逻辑: 收起到底部，展开回顶部
			if (!isExpanded) {
				container.style.top = 'calc(100vh - 100px)';
				// container.style.bottom = '20px';
			} else {
				// container.style.bottom = '';
				container.style.top = '100px';
			}
		};

		actionsDiv.insertBefore(toggleBtn, closeBtn);

		content.style.transition = 'height 0.3s ease';

		// Table
		const table = document.createElement('table');
		table.className = 'dm-dark-table';
		table.innerHTML = `
			<thead>
				<tr>
					<th>产品名称</th>
					<th>价格</th>
					<th width="240px">操作</th>
				</tr>
			</thead>
			<tbody id="dm-rec-tbody"></tbody>
		`;

		tableBodyInstance = table.querySelector('#dm-rec-tbody');
		content.appendChild(table);

		popupInstance = container;
		renderTableBody();
	}

	function renderTableBody() {
		if (!tableBodyInstance) return;
		const store = getStore();
		const items = Object.values(store).reverse(); //Show newest first

		tableBodyInstance.innerHTML = '';

		if (items.length === 0) {
			tableBodyInstance.innerHTML = `
				<tr><td colspan="3" style="text-align:center; padding: 30px; color: #999; border: 1px solid #444;">暂无推荐选品</td></tr>
			`;
			return;
		}

		items.forEach((item) => {
			const tr = document.createElement('tr');
			tr.className = 'dm-rec-row';

			// Image Column Removed

			// Name
			const nameTd = document.createElement('td');
			nameTd.style.maxWidth = '300px';

			const link = document.createElement('a');
			link.href = `https://buyin.jinritemai.com/dashboard/merch-picking-library/merch-promoting?commodity_id=${item.id}&commodity_location=1&id=${item.id}`;
			link.target = '_blank';
			link.innerText = item.name || '未知商品';
			link.style.color = '#ccc';
			link.style.textDecoration = 'underline';
			link.style.cursor = 'pointer';

			// 防止拖拽
			link.onmousedown = (e) => e.stopPropagation();

			nameTd.appendChild(link);

			// Price
			const priceTd = document.createElement('td');
			priceTd.innerText = item.price ? `¥${item.price}` : '-';

			// Actions
			const actionTd = document.createElement('td');
			actionTd.style.whiteSpace = 'nowrap';

			const sharedStyle = `
				padding: 4px 12px !important;
				font-size: 12px !important;
				height: 28px !important;
				line-height: normal !important;
				border-radius: 4px !important;
				cursor: pointer;
				display: inline-flex !important;
				align-items: center;
				justify-content: center;
				border: none;
				color: white !important;
				width: auto !important;
			`;

			// Flex Container
			const btnContainer = document.createElement('div');
			btnContainer.style.display = 'flex';
			btnContainer.style.gap = '8px';
			btnContainer.style.alignItems = 'center';

			const btnGet = document.createElement('button');
			btnGet.innerText = '获取数据';
			btnGet.className = 'dm-button';

			if (window.DM_UI) {
				btnGet.style.cssText = window.DM_UI.getButtonStyle(null) + sharedStyle;
			} else {
				btnGet.style.cssText = `background: #1890ff; ${sharedStyle}`;
			}
			btnGet.onclick = () => handleGetData(item.id, item);

			// Check Da Ren Juan Button
			const btnCheck = document.createElement('button');
			btnCheck.innerText = '检查达人卷';
			btnCheck.className = 'dm-button';

			if (window.DM_UI) {
				btnCheck.style.cssText =
					window.DM_UI.getButtonStyle('#13c2c2') + sharedStyle;
			} else {
				btnCheck.style.cssText = `background: #13c2c2; ${sharedStyle}`;
			}
			btnCheck.onclick = async (e) => {
				e.stopPropagation();
				if (!window.CouponSniffer || !window.CouponSniffer.runSniff) {
					alert('达人卷嗅探模块未加载，请刷新页面重试');
					return;
				}

				// 1. 准备 ID
				let productId = item.productId;
				// 兼容旧数据：id 即为 promotionId
				const promotionId = item.promotionId || item.id;

				// 2. 如果缺少 ProductId，尝试通过接口获取
				if (!productId) {
					const originalText = btnCheck.innerText;
					btnCheck.innerText = '获取ID...';
					btnCheck.disabled = true;
					btnCheck.style.opacity = '0.7';

					try {
						if (window.ProductInfo && window.ProductInfo.fetchDataFordays) {
							// 请求 7 天数据
							const res = await window.ProductInfo.fetchDataFordays(
								7,
								promotionId
							);
							// 解析 product_id
							// 结构通常是: res.data.product_id 或 res.data.data.product_id
							const data = res.data || {};
							productId =
								data.product_id || (data.data && data.data.product_id);

							if (productId) {
								console.log(
									'已获取 ProductId:',
									productId,
									'PromotionId:',
									promotionId
								);
								// 3. 更新本地存储
								// item 是引用吗？Object.values返回的是新对象还是引用？
								// getStore返回的是对象，我们直接修改 store 并保存
								const store = getStore();
								if (store[item.id]) {
									store[item.id].productId = productId;
									store[item.id].promotionId = promotionId; // 确保字段明确
									saveStore(store);
									// 更新当前闭包中的 item，以免即使重绘前再次点击出错
									item.productId = productId;
									item.promotionId = promotionId;
								}
							} else {
								throw new Error('接口返回数据中未找到 Product ID');
							}
						} else {
							throw new Error('ProductInfo 模块未就绪');
						}
					} catch (err) {
						console.error('获取 Product ID 失败', err);
						alert('无法获取 Product ID，无法进行嗅探: ' + err.message);
						btnCheck.innerText = originalText;
						btnCheck.disabled = false;
						btnCheck.style.opacity = '1';
						return;
					}

					// 恢复按钮状态
					btnCheck.innerText = originalText;
					btnCheck.disabled = false;
					btnCheck.style.opacity = '1';
				}

				// 4. 执行嗅探
				if (productId && promotionId) {
					window.CouponSniffer.runSniff(productId, promotionId, btnCheck);
				}
			};

			const btnDel = document.createElement('button');
			btnDel.innerText = '删除';
			btnDel.className = 'dm-button';

			if (window.DM_UI) {
				btnDel.style.cssText =
					window.DM_UI.getButtonStyle('#ff4d4f') + sharedStyle;
			} else {
				btnDel.style.cssText = `background: #ff4d4f; ${sharedStyle}`;
			}
			btnDel.onclick = () => {
				if (confirm('确定删除该推荐商品吗？')) {
					removeProduct(item.id);
				}
			};

			btnContainer.appendChild(btnGet);
			btnContainer.appendChild(btnCheck);
			btnContainer.appendChild(btnDel);
			actionTd.appendChild(btnContainer);

			tr.appendChild(nameTd);
			tr.appendChild(priceTd);
			tr.appendChild(actionTd);

			tableBodyInstance.appendChild(tr);
		});
	}

	async function handleGetData(id, item) {
		if (window.ProductInfo && window.ProductInfo.analyzeAndShow) {
			// 不关闭弹窗，允许用户拖动查看
			// if (popupInstance) popupInstance.style.display = 'none';

			try {
				await window.ProductInfo.analyzeAndShow(
					id,
					'pc.selection_square.recommend_main',
					false,
					item.name,
					item.price
				);
			} catch (e) {
				console.error(e);
				alert('获取数据失败: ' + e.message);
			}
		} else {
			alert('ProductInfo 模块未初始化，请刷新页面重试');
		}
	}

	// 监听 URL 变化以重新注入按钮 (如果页面重绘)
	// 使用简单的定时器检查或路由监听
	function init() {
		setInterval(() => {
			createButton();
		}, 1000);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	// Globals
	window.RecommendationManager = {
		getStore,
		saveStore,
	};
})();
