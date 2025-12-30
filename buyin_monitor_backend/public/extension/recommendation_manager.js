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
		btn.className = 'dm-button';

		// 样式：适配 widget 内部
		if (window.DM_UI) {
			// 使用自定义颜色 (例如紫色) 区分
			btn.style.cssText = window.DM_UI.getButtonStyle('#722ed1', true);
			btn.style.setProperty('width', '100%', 'important');
			btn.style.marginBottom = '6px';
		} else {
			btn.style.cssText = `
				width: 100%;
				padding: 8px 0;
				margin-bottom: 6px;
				background: linear-gradient(135deg, #722ed1 0%, #a066fd 100%);
				color: white;
				border: none;
				border-radius: 4px;
				cursor: pointer;
				font-weight: bold;
				font-size: 14px;
				box-shadow: 0 2px 6px rgba(114, 46, 209, 0.2);
			`;
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
		let container, content, actionsDiv, closeBtn;

		if (window.DM_UI && window.DM_UI.createDarkPopup) {
			const result = window.DM_UI.createDarkPopup({
				id: 'dm-rec-popup',
				title: '推荐选品列表',
				width: '90%',
				zIndex: 9000,
			});
			container = result.container;
			content = result.content;
			actionsDiv = result.actionsDiv;
			closeBtn = result.closeBtn;
		} else {
			console.warn('UI 库未加载，使用内置 Fallback');
			const result = createDarkPopupFallback({
				id: 'dm-rec-popup',
				title: '推荐选品列表',
				width: '90%',
				zIndex: 9000,
			});
			container = result.container;
			content = result.content;
			actionsDiv = result.actionsDiv;
			closeBtn = result.closeBtn;

			// Inject Table Styles if missing
			if (!document.getElementById('dm-fallback-styles')) {
				const style = document.createElement('style');
				style.id = 'dm-fallback-styles';
				style.textContent = `
					.dm-dark-table { width: 100%; border-collapse: collapse; font-size: 14px; }
					.dm-dark-table th { padding: 10px; border: 1px solid #444; color: #e0e0e0; background: #2d2d2d; text-align: left; }
					.dm-dark-table td { padding: 10px; border: 1px solid #444; color: #ccc; }
					.dm-rec-row td a { color: #ccc; text-decoration: underline; }
				`;
				document.head.appendChild(style);
			}
		}

		popupInstance = container;

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

	function createDarkPopupFallback(config) {
		const {id, title, width = '90%', zIndex = 11000} = config;
		let container = document.getElementById(id);
		if (container) return {container, exists: true};

		container = document.createElement('div');
		container.id = id;
		container.style.cssText = `
			position: fixed;
			top: 50px; left: 50%; transform: translate(-50%, 0%);
			z-index: ${zIndex}; display: block;
			background-color: #1e1e1e; color: #e0e0e0;
			padding: 20px; border-radius: 8px;
			box-shadow: 0 4px 20px rgba(0,0,0,0.4);
			width: ${width}; max-width: 1000px; max-height: 90vh;
			overflow-y: auto;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
		`;

		const header = document.createElement('div');
		header.style.cssText = `
			display: flex; justify-content: space-between; align-items: center;
			margin-bottom: 20px; border-bottom: 1px solid #444; padding-bottom: 10px; cursor: move;
		`;

		const titleEl = document.createElement('h3');
		titleEl.innerText = title;
		titleEl.style.cssText = 'margin: 0; color: #fff; font-size: 18px;';

		const actionsDiv = document.createElement('div');
		actionsDiv.style.cssText = 'display:flex; gap:8px; align-items:center;';

		const closeBtn = document.createElement('button');
		closeBtn.innerText = '✕';
		closeBtn.style.cssText = `
			background: transparent; border: none; color: #ccc; font-size: 16px; cursor: pointer; padding: 4px 8px;
		`;
		closeBtn.onmouseenter = () => (closeBtn.style.color = '#fff');
		closeBtn.onmouseleave = () => (closeBtn.style.color = '#ccc');
		closeBtn.onclick = () => {
			container.style.display = 'none';
		};

		actionsDiv.appendChild(closeBtn);
		header.appendChild(titleEl);
		header.appendChild(actionsDiv);
		container.appendChild(header);

		const content = document.createElement('div');
		container.appendChild(content);
		document.body.appendChild(container);

		if (window.ProductInfo && window.ProductInfo.makeDraggable) {
			window.ProductInfo.makeDraggable(container, header);
		}

		return {container, header, content, actionsDiv, closeBtn};
	}

	// Globals
	window.RecommendationManager = {
		getStore,
		saveStore,
	};
})();
