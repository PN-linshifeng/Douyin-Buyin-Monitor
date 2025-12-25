(function () {
	// 模块加载日志
	console.log(
		'%c [抖音选品数据分析] 商品列表模块已加载',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	// 存储抓取到的商品推广信息缓存
	let savedPromotions = [];
	// 存储批量抓取的结果
	let batchResultsMap = new Map();

	// 批量分析控制状态
	let batchAnalysisActive = false;
	let stopBatchSignalled = false;

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

			// 3. 追加推广信息到缓存
			if (resData && resData.data && resData.data.summary_promotions) {
				const promotions = resData.data.summary_promotions;

				// 仅在确定有新数据时，且是第一页，才清空缓存
				if (
					(reqData.cursor === 0 || reqData.cursor === '0') &&
					promotions.length > 0
				) {
					savedPromotions = [];
					console.log('[商品列表] 检测到首页数据，已重置缓存');
				}

				savedPromotions = savedPromotions.concat(promotions);
				console.log(
					`[商品列表] 成功捕获 ${promotions.length} 条商品数据，总缓存: ${savedPromotions.length}`
				);
				// 捕获到数据后，尝试注入批量按钮
				injectBatchButton();
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

	// 根据商品ID查找缓存的推广信息
	function findPromotionById(pid) {
		if (!pid) return null;
		return savedPromotions.find((p) => p.promotion_id === pid);
	}

	/**
	 * 统一更新按钮状态
	 * @param {HTMLElement} btn 按钮元素
	 * @param {string} type 状态类型: 'analyzing' | 'good' | 'bad' | 'normal' | 'error' | 'default'
	 */
	function updateButtonState(btn, type) {
		if (!btn || !window.DM_UI) return;

		const ui = window.DM_UI;
		// 移除旧的状态类
		btn.classList.remove(
			'dm-btn-primary',
			'dm-btn-success',
			'dm-btn-warning',
			'dm-btn-danger',
			'dm-btn-disabled'
		);
		btn.classList.add('dm-button');

		switch (type) {
			case 'analyzing':
			case 'waiting':
				btn.innerText = type === 'analyzing' ? '分析中...' : '等待分析';
				btn.disabled = true;
				btn.classList.add('dm-btn-warning');
				break;
			case 'good':
				btn.innerText = '推荐';
				btn.disabled = false;
				btn.classList.add('dm-btn-success');
				break;
			case 'passed':
				btn.innerText = '已通过初筛';
				btn.disabled = false;
				btn.classList.add('dm-btn-success');
				break;
			case 'bad':
				btn.innerText = '不推荐';
				btn.disabled = false;
				btn.classList.add('dm-btn-danger');
				break;
			case 'normal':
				btn.innerText = '一般';
				btn.disabled = false;
				btn.classList.add('dm-btn-primary');
				break;
			case 'error':
				btn.innerText = '❎分析失败';
				btn.disabled = false;
				btn.classList.add('dm-btn-disabled');
				break;
			case 'default':
			default:
				btn.innerText = '获取选品数据';
				btn.disabled = false;
				btn.classList.add('dm-btn-primary');
				break;
		}
	}

	/**
	 * 核心商品分析逻辑
	 * @param {Object} promo 商品信息
	 * @param {HTMLElement|null} btn 对应的按钮元素 (用于更新UI)
	 * @param {boolean} isBatch 是否为批量模式
	 * @returns {Promise<{success: boolean, id: string, data: any}>}
	 */
	async function runProductAnalysis(promo, btn, isBatch = false) {
		const promotionId = promo?.promotion_id;
		if (!promotionId) {
			return {success: false, id: null, msg: 'No promotion ID'};
		}

		if (!window.ProductInfo || !window.ProductInfo.analyzeAndShow) {
			console.error('ProductInfo 模块未加载');
			if (btn) updateButtonState(btn, 'error');
			return {success: false, id: promotionId, msg: 'Module missing'};
		}

		// 1. 设置中间状态
		// 无论单次还是批量，只要有按钮，都标记为分析中
		if (btn) {
			updateButtonState(btn, 'analyzing');
		}

		try {
			// 2. 准备参数
			// 批量模式下: decision_enter_from 指定为 square...recommend_main, skipPopup = true
			// 单个模式下: default, skipPopup = false (默认)
			const decisionFrom = isBatch
				? 'pc.selection_square.recommend_main'
				: undefined;
			const skipPopup = isBatch;

			const productName = promo.base_model?.product_info?.name;
			const productPrice =
				promo.base_model?.marketing_info?.price_desc?.price.origin;
			console.log(productName, productPrice / 100);

			// 3. 调用分析接口
			const result = await window.ProductInfo.analyzeAndShow(
				promotionId,
				decisionFrom,
				skipPopup,
				productName,
				productPrice / 100
			);

			// 4. 计算结果状态
			// const stats7 = window.ProductInfo.calculateStats(
			// 	result.results[0].data,
			// 	7,
			// 	result.productData,
			// 	promotionId
			// );
			// 改为直接获取后端计算的结果
			const stats7 = result.results[0].stats;

			if (!stats7) {
				console.error('[ProductList] 7天数据统计缺失', result);
				throw new Error('Stats missing');
			}
			console.log('=============', stats7, stats7.overallStatus, promotionId);

			// 5. 更新 UI
			if (btn) {
				updateButtonState(btn, stats7.overallStatus);
			}

			// [新增] 自动缓存推荐 ('good') 商品
			if (stats7.overallStatus === 'good') {
				try {
					const STORAGE_KEY = 'DM_RECOMMENDED_PRODUCTS';
					let store = {};
					try {
						store = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
					} catch (e) {}

					// 尝试获取图片URL
					const imgUrl =
						promo?.base_model?.product_info?.cover ||
						promo?.base_model?.product_info?.img_url ||
						'';

					const newItem = {
						id: promotionId,
						name: productName,
						price:
							typeof productPrice === 'number'
								? productPrice / 100
								: productPrice,
						img: imgUrl,
						createdAt: Date.now(),
					};
					store[promotionId] = newItem;
					localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
					console.log(`[ProductList] 已缓存推荐商品: ${productName}`);
				} catch (e) {
					console.error('[ProductList] 缓存推荐商品失败', e);
				}
			}

			return {success: true, id: promotionId, data: result};
		} catch (e) {
			console.error(`[分析失败] ID: ${promotionId}`, e);
			if (btn) updateButtonState(btn, 'error');
			return {success: false, id: promotionId, error: e};
		}
	}

	// 处理"获取选品数据"按钮点击事件
	async function handleGetSelectionData(btn) {
		const pid = btn.getAttribute('data-pid');
		if (!pid) {
			alert('无法获取商品ID信息');
			return;
		}

		console.log('[商品列表] 点击获取商品ID:', pid);

		const promo = findPromotionById(pid);
		if (promo) {
			console.log('[商品列表] 找到匹配数据:', promo);
			await runProductAnalysis(promo, btn, false);
		} else {
			console.warn('[商品列表] 未找到匹配商品:', pid);
			alert('未在缓存数据中找到该商品，请尝试滚动加载或刷新页面');
		}
	}

	// 辅助函数：在容器中检查或创建按钮
	function checkAndInject(container, pid, isTable = false) {
		// 2. 检查或创建按钮
		let btn = container.querySelector('.douyin-monitor-list-btn');

		// [修改逻辑] 检查按钮是否复用且ID不一致
		if (btn && btn.getAttribute('data-pid') !== pid) {
			btn.remove();
			btn = null;
		}
		// debugger;
		if (!btn) {
			btn = document.createElement('button');
			// 使用统一状态初始化
			updateButtonState(btn, 'default');
			btn.className = 'douyin-monitor-list-btn';
			if (window.DM_UI) {
				btn.style.cssText = window.DM_UI.getButtonStyle(
					window.DM_UI.colors.batch,
					true
				);
				btn.style.setProperty('width', '100%', 'important');
				btn.style.fontSize = '14px';
				if (!isTable) {
					btn.style.padding = '10px 10px !important';
					// btn.style.fontSize = '14px';
				}
			} else {
				btn.style.width = '100%';
			}
			btn.onclick = (e) => {
				e.stopPropagation(); // 阻止点击事件冒泡
				handleGetSelectionData(btn);
			};
			container.appendChild(btn);
		}

		// 3. 更新按钮属性
		btn.setAttribute('data-pid', pid);
	}

	// 向页面商品列表中注入"获取选品数据"按钮
	function injectButtons() {
		if (
			window.location.href.indexOf('/dashboard/merch-picking-library') === -1
		) {
			return;
		}

		// 收集页面上的列表项
		let items = [];

		// 场景 A: 卡片视图
		const wrappers = document.querySelectorAll(
			'div[class*="index_module__wrapper"]'
		);
		if (wrappers.length > 0) {
			wrappers.forEach((w) => items.push({el: w, type: 'card'}));
		} else {
			// 场景 B: 表格视图
			const tableRows = [...document.querySelectorAll('.auxo-table-body tr')];
			tableRows.forEach((tr, index) => {
				// 简单的行过滤，确保是数据行
				if (index !== 0) {
					const tds = tr.querySelectorAll('td');
					if (tds.length >= 2) {
						items.push({el: tr, type: 'table'});
					}
				}
			});
		}

		// 根据下标匹配数据
		items.forEach((item, index) => {
			if (index >= savedPromotions.length) return;

			const promo = savedPromotions[index];
			const pid = promo.promotion_id;
			if (!pid) return;

			// 确定注入位置
			let container = null;
			if (item.type === 'card') {
				container = item.el;
			} else {
				// 表格模式注入到第二个 td
				const tds = item.el.querySelectorAll('td');
				if (tds.length >= 2) {
					container = tds[1];
				}
			}

			if (container) {
				checkAndInject(container, pid, item.type === 'table');
			}
		});
	}

	// 批量分析处理函数
	async function handleBatchAnalyze(btn) {
		// 如果已经在运行，再次点击则视为“停止”
		if (batchAnalysisActive) {
			stopBatchSignalled = true;
			btn.innerText = '正在停止...';
			btn.disabled = true;
			return;
		}

		if (savedPromotions.length === 0) {
			alert('当前没有缓存的商品数据，请刷新页面');
			return;
		}

		// 初始化运行状态
		batchAnalysisActive = true;
		stopBatchSignalled = false;
		const originalText = btn.innerText;
		const originalBg = btn.style.backgroundColor;

		btn.innerText = '停止批量分析';
		btn.style.backgroundColor = '#ff4d4f'; // 改为红色表示可停止

		console.log(`[批量分析] 开始处理 ${savedPromotions.length} 个商品...`);

		// 0. 预处理：构建按钮映射并设置等待状态
		const allBtns = document.querySelectorAll('.douyin-monitor-list-btn');
		const btnMap = new Map();
		allBtns.forEach((b) => {
			const pid = b.getAttribute('data-pid');
			if (pid) btnMap.set(pid, b);
		});

		// 标记所有待分析项为等待
		for (const promo of savedPromotions) {
			if (stopBatchSignalled) break;
			const pid = promo.promotion_id;
			if (!pid || batchResultsMap.has(pid)) continue;

			if (btnMap.has(pid)) {
				updateButtonState(btnMap.get(pid), 'waiting');
			}
		}

		let successCount = 0;
		let failCount = 0;
		let isStoppedManually = false;

		for (const promo of savedPromotions) {
			// 检查是否收到了停止信号
			if (stopBatchSignalled) {
				console.log('[批量分析] 收到停止信号，正在中断...');
				isStoppedManually = true;
				break;
			}

			const promotionId = promo.promotion_id;
			if (!promotionId) continue;

			// 查找对应的按钮 (如果存在)
			let targetBtn = btnMap.get(promotionId);

			// 检查 Map 中是否已存在（去重）
			if (batchResultsMap.has(promotionId)) {
				// 如果已有结果，尝试更新 UI 后跳过
				const cachedData = batchResultsMap.get(promotionId);
				if (
					targetBtn &&
					cachedData &&
					cachedData.results &&
					cachedData.results[0] &&
					cachedData.results[0].stats
				) {
					const stats = cachedData.results[0].stats;
					updateButtonState(targetBtn, stats.overallStatus);
					console.log(`[批量分析] 跳过重复并更新 UI: ${promotionId}`);
				}
				continue;
			}

			const promoName = promo?.base_model?.product_info?.name || promotionId;

			// 执行分析
			const resultObj = await runProductAnalysis(promo, targetBtn, true);

			if (resultObj.success) {
				batchResultsMap.set(promotionId, resultObj.data);
				successCount++;
				console.log(`[批量分析] 成功: ${promoName}`);
			} else {
				failCount++;
			}

			// 简单的防频控延时
			await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
		}

		console.log(
			isStoppedManually ? '[批量分析] 已手动停止' : '[批量分析] 全部完成!'
		);
		console.log(`成功: ${successCount}, 失败: ${failCount}`);

		if (!isStoppedManually || successCount + failCount > 0) {
			alert(
				`${
					isStoppedManually ? '批量分析已暂停' : '批量分析完成'
				}\n本次成功: ${successCount}\n本次失败: ${failCount}`
			);
		}

		// 恢复状态
		batchAnalysisActive = false;
		stopBatchSignalled = false;
		btn.innerText = originalText;
		btn.style.backgroundColor = originalBg;
		btn.disabled = false;
	}

	function injectBatchButton() {
		if (
			window.location.href.indexOf('/dashboard/merch-picking-library') === -1 ||
			window.location.href.indexOf('/merch-promoting') !== -1
		) {
			return;
		}

		// 只有当 savedPromotions 有数据时才允许插入按钮
		if (savedPromotions.length === 0) return;

		if (document.getElementById('douyin-monitor-batch-btn')) return;

		const btn = document.createElement('button');
		btn.id = 'douyin-monitor-batch-btn';
		btn.className = 'dm-button dm-btn-primary';
		btn.innerText = '批量分析本页商品';
		if (window.DM_UI) {
			btn.style.cssText = window.DM_UI.getButtonStyle(null);
			btn.style.setProperty('width', '100%', 'important');
		}

		btn.onclick = () => {
			handleBatchAnalyze(btn);
		};

		const mountBtn = () => {
			const container = document.getElementById('dm-widget-body');
			if (container) {
				container.appendChild(btn);
			} else {
				setTimeout(mountBtn, 500);
			}
		};
		mountBtn();
	}

	// 初始化函数
	function init() {
		// 路由监听
		if (window.DM_Utils) {
			window.DM_Utils.watchRouteChange({
				// 使用正则：包含 merch-picking-library 但不包含 merch-promoting
				urlPattern: /dashboard\/merch-picking-library(?!\/merch-promoting)/,
				onMatch: () => {
					injectBatchButton();
				},
				onUnmatch: () => {
					const btn = document.getElementById('douyin-monitor-batch-btn');
					if (btn) btn.remove();
				},
			});
		} else {
			// 尝试注入批量按钮
			injectBatchButton();
		}
		// 尝试即时注入一次
		injectButtons();

		// 1. 处理缓冲的数据 (Buffer)
		if (window.__DM_BUFFER && window.__DM_BUFFER.length > 0) {
			window.__DM_BUFFER.forEach((payload) => {
				processList(payload);
			});
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

		// 3. [New] MutationObserver for dynamic content
		let timer = null;
		const observer = new MutationObserver(() => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				injectButtons();
			}, 500); // Debounce 500ms
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
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
