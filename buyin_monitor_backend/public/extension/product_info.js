(function () {
	console.log(
		'%c [抖音选品] 商品信息模块已加载',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	const pendingRequests = new Map();

	// 监听 API 结果
	window.addEventListener(
		'message',
		function (event) {
			if (event.source !== window) return;

			// 处理请求结果
			if (event.data.type === 'DOUYIN_MONITOR_FETCH_RESULT') {
				const {requestId, success, data, error} = event.data;
				if (pendingRequests.has(requestId)) {
					const {resolve, reject} = pendingRequests.get(requestId);
					pendingRequests.delete(requestId);
					if (success) {
						resolve(data);
					} else {
						reject(new Error(error));
					}
				}
			}
		},
		false
	);

	/**
	 * 让元素可拖拽
	 */
	function makeDraggable(element, handle) {
		handle = handle || element;
		handle.style.cursor = 'move';

		let isDragging = false;
		let startX, startY, initialLeft, initialTop;

		handle.onmousedown = function (e) {
			e.preventDefault();
			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;

			const rect = element.getBoundingClientRect();
			initialLeft = rect.left;
			initialTop = rect.top;

			element.style.position = 'fixed';
			element.style.left = initialLeft + 'px';
			element.style.top = initialTop + 'px';
			element.style.right = 'auto';
			element.style.bottom = 'auto';
			element.style.margin = '0';
			element.style.transform = 'none';

			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		};

		function onMouseMove(e) {
			if (!isDragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			element.style.left = initialLeft + dx + 'px';
			element.style.top = initialTop + dy + 'px';
		}

		function onMouseUp() {
			isDragging = false;
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		}
	}

	function sendInjectedRequest(url, body) {
		return new Promise((resolve, reject) => {
			const requestId = Date.now() + '_' + Math.random();
			pendingRequests.set(requestId, {resolve, reject});

			window.postMessage(
				{
					type: 'DOUYIN_MONITOR_FETCH',
					payload: {
						requestId,
						url,
						body,
					},
				},
				'*'
			);

			setTimeout(() => {
				if (pendingRequests.has(requestId)) {
					pendingRequests.delete(requestId);
					reject(new Error('请求超时'));
				}
			}, 15000);
		});
	}

	async function fetchProductData(
		biz_id,
		decision_enter_from = 'pc.selection_square.recommend_main'
	) {
		const newBodyObj = {
			scene_info: {
				request_page: 2,
			},
			biz_id: biz_id,
			biz_id_type: 2,
			enter_from: decision_enter_from,
			data_module: 'core',
			extra: {
				// use_kol_product: '1', // 启用达人商品逻辑 (可选)
			},
		};
		const bodyStr = JSON.stringify(newBodyObj);
		const targetUrlBase = `https://buyin.jinritemai.com/pc/selection/decision/pack_detail`;

		return sendInjectedRequest(targetUrlBase, bodyStr);
	}

	// ==========================================
	// 综合选品配置 (可修改此处参数和文案)
	// ==========================================
	// 选品配置已迁移至后端 (routes/stats.js)

	async function fetchDataFordays(
		days,
		biz_id,
		decision_enter_from = 'pc.selection_square.recommend_main'
	) {
		let bodyStr = '{}';

		try {
			const newBodyObj = {
				scene_info: {
					request_page: 2,
				},
				other_params: {
					colonel_activity_id: '',
				},
				biz_id: biz_id,
				biz_id_type: 2,
				enter_from: decision_enter_from,
				data_module: 'dynamic',
				dynamic_params: {
					param_type: 9,
					promotion_data_params: {
						time_range: String(days),
					},
					content_data_params: {
						time_range: String(days),
					},
				},
				extra: {},
			};

			bodyStr = JSON.stringify(newBodyObj);
		} catch (e) {
			console.error('Body 构造失败', e);
			throw e;
		}

		console.log(`正在请求 ${days} 天数据 (通过注入脚本)...`);
		const fullUrl = '/pc/selection/decision/pack_detail';
		return sendInjectedRequest(fullUrl, bodyStr);
	}
	function fetchBackendStats(payload) {
		return new Promise((resolve, reject) => {
			const requestId = Date.now() + '_' + Math.random();
			pendingRequests.set(requestId, {resolve, reject});

			window.postMessage(
				{
					type: 'DOUYIN_MONITOR_CALCULATE_STATS',
					requestId,
					payload,
				},
				'*'
			);

			setTimeout(() => {
				if (pendingRequests.has(requestId)) {
					pendingRequests.delete(requestId);
					reject(new Error('计算请求超时'));
				}
			}, 15000);
		});
	}

	// calculateStats 已移除，逻辑迁移至 fetchBackendStats 调用后端 API

	function createTableHtml(stats) {
		const {days, totalSales, channels, extraStats, advice, overallHtml} = stats;
		const rowCard = channels[0];
		const rowLive = channels[1];
		const rowVideo = channels[2];
		const rowImage = channels[3];
		const rowShop = channels[4];
		const {liveSalesDiff, specStat} = extraStats;

		// 生成建议文案的HTML辅助函数
		const adviceHtml = advice
			.map((item) => {
				const color = item.color ? `color: ${item.color};` : '';
				return `<div style="margin-bottom: 4px; ${color}">• ${item.msg}</div>`;
			})
			.join('');

		return `
			<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
				<thead style="background-color: #2d2d2d;">
					<tr>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0; width: 15%;">${days}天</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">销售渠道</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">销售量</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">销售占比</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">日均销售单数</th>
						<th style="padding: 10px; border: 1px solid #444; color: #e0e0e0;">平均客单价</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td rowspan="5" style="padding: 10px; border: 1px solid #444; text-align: center; color: #ff8888; font-weight: bold;">总销量: ${totalSales}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: ${
							rowCard.dailyColor || '#cccccc'
						}; font-weight: bold;">${rowCard.daily}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowCard.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowLive.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowVideo.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowImage.price
						}</td>
					</tr>
					<tr>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.name
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.vol
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.share
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.daily
						}</td>
						<td style="padding: 8px; border: 1px solid #444; text-align: center; color: #cccccc;">${
							rowShop.price
						}</td>
					</tr>
				</tbody>
			</table>
			<div style="margin-bottom: 30px; font-size: 13px; color: #ccc; line-height: 1.6;">
				<div style="margin-bottom:8px;">
					<strong>直播人均出单数：</strong> 
					<!-- ${'--' || liveSalesDiff.formula} = -->
					<span style="color: #fff; font-weight: bold;">${liveSalesDiff.val}</span>
				</div>
					<strong>直播出单规格：</strong>
					 <!-- ${'--' || specStat.formula} =  -->
					 <span style="font-weight:bold; color: #fff;">${specStat.val.toFixed(2)}</span>
				</div>
			</div>
		`;
	}

	function showPopup(
		results,
		ranges,
		productName,
		productPrice,
		promotionId,
		decision_enter_from,
		isError = false
	) {
		const oldPopup = document.getElementById('douyin-monitor-popup');
		if (oldPopup) oldPopup.remove();

		const container = document.createElement('div');
		container.id = 'douyin-monitor-popup';
		container.style.position = 'fixed';
		container.style.top = '50px';
		container.style.left = '50%';
		container.style.transform = 'translate(-50%, 0%)';
		container.style.zIndex = '10000';
		container.style.display = 'block';
		container.style.backgroundColor = '#1e1e1e';
		container.style.color = '#e0e0e0';
		container.style.padding = '20px';
		container.style.borderRadius = '8px';
		container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
		container.style.width = '98%';
		container.style.maxWidth = '1200px';
		container.style.maxHeight = '95vh';
		container.style.overflowY = 'auto';

		const title = document.createElement('h3');

		const link = document.createElement('a');
		link.href = `https://buyin.jinritemai.com/dashboard/merch-picking-library/merch-promoting?commodity_id=${promotionId}&commodity_location=1&id=${promotionId}`;
		link.target = '_blank';
		link.innerText = productName;
		link.style.color = '#ffffff';
		link.style.textDecoration = 'underline';
		link.style.cursor = 'pointer';
		link.onmousedown = (e) => {
			e.stopPropagation();
		};
		link.onmouseenter = () => {
			// link.style.textDecoration = 'underline';
		};
		link.onmouseleave = () => {
			// link.style.textDecoration = 'none';
		};

		title.appendChild(link);
		title.style.display = 'flex';
		title.style.justifyContent = 'space-between';
		title.style.alignItems = 'center';
		title.style.marginBottom = '20px';
		title.style.color = '#ffffff';
		title.style.borderBottom = '1px solid #444';
		title.style.paddingBottom = '10px';

		// 操作按钮区域
		const actionsDiv = document.createElement('div');
		actionsDiv.style.display = 'flex';
		actionsDiv.style.gap = '10px';
		actionsDiv.style.alignItems = 'center';

		// 刷新按钮
		const refreshBtn = document.createElement('button');
		refreshBtn.className = 'dm-button dm-btn-primary';
		refreshBtn.innerText = '↻ 刷新';
		if (window.DM_UI) {
			refreshBtn.style.cssText = window.DM_UI.getButtonStyle(null);
			refreshBtn.style.width = 'auto';
			refreshBtn.style.padding = '4px 8px !important';
			refreshBtn.style.fontSize = '12px';
		}

		refreshBtn.onclick = (e) => {
			e.stopPropagation(); // 防止触发拖拽
			refreshBtn.innerText = '分析中...';
			refreshBtn.disabled = true;
			refreshBtn.classList.remove('dm-btn-primary');
			refreshBtn.classList.add('dm-btn-warning');
			analyzeAndShow(promotionId, decision_enter_from);
		};
		refreshBtn.onmousedown = (e) => e.stopPropagation(); // 防止触发拖拽
		actionsDiv.appendChild(refreshBtn);

		// 头部关闭按钮
		const headerCloseBtn = document.createElement('button');
		headerCloseBtn.innerText = '✕';
		headerCloseBtn.style.padding = '4px 8px';
		headerCloseBtn.style.fontSize = '14px';
		headerCloseBtn.style.backgroundColor = 'transparent';
		headerCloseBtn.style.border = 'none';
		headerCloseBtn.style.color = '#ccc';
		headerCloseBtn.style.cursor = 'pointer';
		headerCloseBtn.onmouseenter = () => (headerCloseBtn.style.color = '#fff');
		headerCloseBtn.onmouseleave = () => (headerCloseBtn.style.color = '#ccc');
		headerCloseBtn.onclick = (e) => {
			e.stopPropagation();
			container.remove();
		};
		headerCloseBtn.onmousedown = (e) => e.stopPropagation();
		actionsDiv.appendChild(headerCloseBtn);

		// 收起/展开内容按钮
		const toggleBtn = document.createElement('button');
		toggleBtn.className = 'dm-button';
		toggleBtn.innerText = '🔼 收起';
		if (window.DM_UI) {
			toggleBtn.style.cssText = window.DM_UI.getButtonStyle(
				'rgba(255, 255, 255, 0.1)'
			);
			toggleBtn.style.width = 'auto';
			toggleBtn.style.padding = '4px 8px !important';
			toggleBtn.style.fontSize = '12px';
			toggleBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
		}

		let isExpanded = true;
		toggleBtn.onclick = (e) => {
			e.stopPropagation();
			isExpanded = !isExpanded;
			toggleBtn.innerText = isExpanded ? '🔼 收起' : '🔽 展开';

			// 切换表格容器的可见性
			if (tablesContainer) {
				tablesContainer.style.display = isExpanded ? 'flex' : 'none';
			}
		};
		toggleBtn.onmousedown = (e) => e.stopPropagation();
		// 插入到关闭按钮之前
		actionsDiv.insertBefore(toggleBtn, headerCloseBtn);

		title.appendChild(actionsDiv);
		container.appendChild(title);

		makeDraggable(container, title);

		const tablesContainer = document.createElement('div');
		tablesContainer.style.display = 'flex';
		tablesContainer.style.gap = '15px';
		tablesContainer.style.overflowX = 'auto';
		tablesContainer.style.paddingBottom = '10px';

		let adviceStats = null;

		results.forEach((item, index) => {
			// const data = item?.data || {};
			const days = ranges[index];
			// const stats = calculateStats(data, days, productPrice, data.promotion_id);
			const stats = item.stats; // 使用后端计算的结果
			if (!stats) {
				console.error('Stats not found for index', index);
				return;
			}
			const tableHtml = createTableHtml(stats);

			// 获取7天的数据用于生成建议
			if (days === 7) {
				adviceStats = stats;
			}

			const wrapper = document.createElement('div');
			wrapper.style.flex = '1';
			wrapper.style.minWidth = '400px';
			wrapper.innerHTML = tableHtml;
			tablesContainer.appendChild(wrapper);
		});

		// 建议容器
		const adviceContainer = document.createElement('div');
		adviceContainer.style.width = '100%';
		adviceContainer.style.marginTop = '15px';
		adviceContainer.style.padding = '15px';
		adviceContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
		adviceContainer.style.borderRadius = '4px';
		adviceContainer.style.color = '#ccc';
		adviceContainer.style.fontSize = '13px';
		adviceContainer.style.lineHeight = '1.6';

		if (adviceStats) {
			const {overallHtml, advice} = adviceStats;
			const adviceHtmlLines = advice
				.map((item) => {
					const color = item.color ? `color: ${item.color};` : '';
					return `<div style="margin-bottom: 4px; ${color}">• ${item.msg}</div>`;
				})
				.join('');

			adviceContainer.innerHTML = `
                <div style="font-weight:bold; margin-bottom:8px; color:#fff; font-size:14px;">选品建议 (仅供参考): ${overallHtml}</div>
                ${adviceHtmlLines}
            `;
		}

		container.appendChild(tablesContainer);
		container.appendChild(adviceContainer);

		toggleBtn.onclick = null; // 移除之前的事件处理程序引用

		// 更新切换逻辑以同时控制两者显示
		toggleBtn.onclick = (e) => {
			e.stopPropagation();
			isExpanded = !isExpanded;
			toggleBtn.innerText = isExpanded ? '🔼 收起' : '🔽 展开';

			const displayVal = isExpanded ? 'flex' : 'none';
			const displayBlock = isExpanded ? 'block' : 'none';
			if (tablesContainer) tablesContainer.style.display = displayVal;
			if (adviceContainer) adviceContainer.style.display = displayBlock;
		};

		// container.appendChild(tablesContainer); // 已移除 (在上面已添加)
		// container.appendChild(adviceContainer); // 在上面已添加

		document.body.appendChild(container);
	}

	async function analyzeAndShow(
		promotionId,
		decision_enter_from,
		skipPopup = false,
		productName,
		productPrice
	) {
		if (!promotionId) {
			alert('Promotion ID 不能为空');
			return;
		}

		try {
			// 1. 获取 ewid 并请求 pack_detail (商品信息)
			let productData = {};

			// 2. 请求 7/30 天数据
			const ranges = skipPopup ? [7] : [7, 30];
			// 我们可以传递空字符串作为 originalBodyStr，因为它不再用于逻辑
			const promises = ranges.map(async (days) => {
				await new Promise((r) => setTimeout(r, 100 + Math.random() * 600));
				return fetchDataFordays(days, promotionId, decision_enter_from);
			});
			const results = await Promise.all(promises);
			results.forEach((item) => {
				if (item.data === null) {
					throw new Error(`${item.msg}`);
				}
			});

			// 3. 获取商品信息 (如果未传递)
			if (!productName) {
				const titleEl = document.querySelector(
					'[class*="index_module__title____"]'
				);
				productName = titleEl ? titleEl.textContent : '未知商品';
			}
			if (!productPrice) {
				const contentEl = document.querySelector(
					'[class*="index_module__dataContent"]'
				);
				if (contentEl) {
					const ele = contentEl.textContent
						.split(/¥|规/)
						.filter((k) => Number(k));
					productPrice = Number(ele[0] || 0);
				} else {
					productPrice = 0;
				}
			}
			console.log(results, '=========results');

			// 4. 调用后端 API 计算统计数据
			if (results && results.length > 0) {
				console.log('正在调用后端计算统计数据...');
				const statsPromises = results.map((res, index) => {
					const days = ranges[index];
					const data = res.data;
					return fetchBackendStats({data, days, productPrice, promotionId});
				});

				try {
					const statsResults = await Promise.all(statsPromises);
					results.forEach((res, index) => {
						// fetchBackendStats(content.js) 已经解包了 .data，所以这里 statsResults[index] 就是 stats 对象本身
						if (statsResults[index]) {
							res.stats = statsResults[index];
						} else {
							console.error(
								'Stats calculation failed for day ' + ranges[index],
								statsResults[index]?.error
							);
							throw new Error(
								`后端计算失败: ${
									statsResults[index]?.error || '返回数据为空'
								} (天数: ${ranges[index]})`
							);
						}
					});
				} catch (e) {
					console.error('Stats batch fetch failed', e);
					if (!skipPopup) alert('后端计算失败: ' + e.message);
					throw e; // 继续抛出，中断流程
				}
			}

			console.log(productName, productPrice);

			// Check validity
			const hasData =
				results && results.length > 0 && results[0] && results[0].data;
			if (!hasData) {
				if (!skipPopup) {
					showPopup(
						results,
						ranges,
						productName,
						productPrice,
						promotionId,
						decision_enter_from,
						true
					);
				}
				// Return structure with error, or throw?
				// handleBatchAnalyze catches errors, so throwing is good.
				throw new Error('API returned null data');
			}

			if (!skipPopup) {
				showPopup(
					results,
					ranges,
					productName,
					productPrice,
					promotionId,
					decision_enter_from
				);
			}

			return {
				results,
				ranges,
				productData,
				promotionId,
			};
		} catch (error) {
			console.error('获取数据失败', error);
			if (!skipPopup) {
				alert(error.message);
			}
			throw error;
		}
	}

	function createFloatingButton() {
		if (
			window.location.href.indexOf(
				'/dashboard/merch-picking-library/merch-promoting'
			) === -1
		)
			return;
		if (document.getElementById('douyin-monitor-btn')) return;

		const btn = document.createElement('button');
		btn.id = 'douyin-monitor-btn';
		btn.className = 'dm-button dm-btn-primary';
		btn.innerText = '获取数据';
		if (window.DM_UI) {
			btn.style.cssText = window.DM_UI.getButtonStyle(null);
		}

		// 防止点击拖拽时触发 click
		let isDrag = false;
		btn.addEventListener('mousedown', () => (isDrag = false));
		btn.addEventListener('mousemove', () => (isDrag = true));
		btn.onclick = async (e) => {
			const localeUrl = new URL(location.href);
			const promotionId =
				localeUrl.searchParams.get('commodity_id') ||
				localeUrl.searchParams.get('id');

			const decision_enter_from = localeUrl.searchParams.get(
				'decision_enter_from'
			);
			btn.innerText = '分析中...';
			btn.classList.add('dm-btn-warning');
			btn.classList.remove('dm-btn-primary');
			if (!isDrag && promotionId) {
				await analyzeAndShow(promotionId, decision_enter_from);
				btn.innerText = '获取数据';
				btn.classList.remove('dm-btn-warning');
				btn.classList.add('dm-btn-primary');
			} else if (!promotionId) {
				console.warn('URL中未找到 commodity_id');
			}
		};
		function append() {
			const container = document.getElementById('dm-widget-body');
			if (container) {
				container.appendChild(btn);
			} else if (document.body) {
				// 如果 Widget 还没加载，等一下
				setTimeout(append, 500);
			} else {
				requestAnimationFrame(append);
			}
		}
		append();
	}

	// 监听路由变化
	if (window.DM_Utils) {
		window.DM_Utils.watchRouteChange({
			urlPattern: '/dashboard/merch-picking-library/merch-promoting',
			onMatch: () => {
				createFloatingButton();
			},
			onUnmatch: () => {
				const btn = document.getElementById('douyin-monitor-btn');
				if (btn) btn.remove();
				const popup = document.getElementById('douyin-monitor-popup');
				if (popup) popup.remove();
			},
		});
	} else {
		// 回退方案
		createFloatingButton();
	}

	window.ProductInfo = {
		makeDraggable,
		sendInjectedRequest,
		fetchProductData,
		fetchDataFordays,
		// calculateStats, // Removed
		createTableHtml,
		showPopup,
		analyzeAndShow,
		createFloatingButton,
	};
})();
