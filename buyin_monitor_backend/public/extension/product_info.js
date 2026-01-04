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
			const handler = (event) => {
				if (
					event.source === window &&
					event.data.type === 'DOUYIN_MONITOR_FETCH_RESULT' &&
					event.data.requestId === requestId
				) {
					window.removeEventListener('message', handler);
					if (event.data.success) {
						resolve(event.data.data);
					} else {
						reject(new Error(event.data.error));
					}
				}
			};

			window.addEventListener('message', handler);

			// Use the new Generic API Call
			window.postMessage(
				{
					type: 'DOUYIN_MONITOR_API_CALL',
					requestId,
					payload: {
						url: '/api/extension/get_promotion_status',
						method: 'POST',
						body: payload,
					},
				},
				'*'
			);

			setTimeout(() => {
				window.removeEventListener('message', handler);
				reject(new Error('计算请求超时'));
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
			<div style="margin-bottom: 20px; overflow-x: auto;">
                <table class="dm-dark-table">
				<thead>
					<tr>
						<th style="width: 15%;">${days}天</th>
						<th style="text-align: center;">销售渠道</th>
						<th style="text-align: center;">销售量</th>
						<th style="text-align: center;">销售占比</th>
						<th style="text-align: center;">日均销售单数</th>
						<th style="text-align: center;">平均客单价</th>
						<th style="text-align: center;">浏览购买率</th> <!-- 新增: 浏览购买率列 -->
					</tr>
				</thead>
				<tbody style="text-align: center;">
				<tbody style="text-align: center;">
					<tr>
						<td rowspan="5" style="${
							stats.totalSalesColor ? `color: ${stats.totalSalesColor};` : ''
						} font-weight: bold;">总销量: ${totalSales}</td>
						<td style="color: #4ea1ff;">${rowCard.name}</td>
						<td style="${rowCard.volStyle || ''}">${rowCard.vol}</td>
						<td style="${rowCard.shareStyle || ''}">${rowCard.share}</td>
						<td style="${
							rowCard.dailyStyle ||
							(rowCard.dailyColor
								? `color:${rowCard.dailyColor}; font-weight:bold;`
								: '')
						}">${rowCard.daily}</td>
						<td style="${rowCard.priceStyle || ''}">${rowCard.price}</td>
						<td>${rowCard.buyRate}</td>
					</tr>
					<tr>
						<td style="color: #4ea1ff;">${rowLive.name}</td>
						<td style="${rowLive.volStyle || ''}">${rowLive.vol}</td>
						<td style="${rowLive.shareStyle || ''}">${rowLive.share}</td>
						<td style="${rowLive.dailyStyle || ''}">${rowLive.daily}</td>
						<td style="${rowLive.priceStyle || ''}">${rowLive.price}</td>
						<td>${rowLive.buyRate}</td>
					</tr>
					<tr>
						<td style="color: #4ea1ff;">${rowVideo.name}</td>
						<td style="${rowVideo.volStyle || ''}">${rowVideo.vol}</td>
						<td style="${rowVideo.shareStyle || ''}">${rowVideo.share}</td>
						<td style="${rowVideo.dailyStyle || ''}">${rowVideo.daily}</td>
						<td style="${rowVideo.priceStyle || ''}">${rowVideo.price}</td>
						<td>${rowVideo.buyRate}</td>
					</tr>
					<tr>
						<td style="color: #4ea1ff;">${rowImage.name}</td>
						<td style="${rowImage.volStyle || ''}">${rowImage.vol}</td>
						<td style="${rowImage.shareStyle || ''}">${rowImage.share}</td>
						<td style="${rowImage.dailyStyle || ''}">${rowImage.daily}</td>
						<td style="${rowImage.priceStyle || ''}">${rowImage.price}</td>
						<td>${rowImage.buyRate}</td>
					</tr>
					<tr>
						<td style="color: #4ea1ff;">${rowShop.name}</td>
						<td style="${rowShop.volStyle || ''}">${rowShop.vol}</td>
						<td style="${rowShop.shareStyle || ''}">${rowShop.share}</td>
						<td style="${rowShop.dailyStyle || ''}">${rowShop.daily}</td>
						<td style="${rowShop.priceStyle || ''}">${rowShop.price}</td>
						<td>${rowShop.buyRate}</td>
					</tr>
				</tbody>
			</table>
            </div>
			<div style="margin-bottom: 30px; font-size: 13px; color: #ccc; line-height: 1.6;">
				<div style="margin-bottom:8px;">
					<strong>直播人均出单数：</strong> 
					<!-- ${'--' || liveSalesDiff.formula} = -->
					<span style="${
						liveSalesDiff.color
							? `color:${liveSalesDiff.color};`
							: 'color: #fff;'
					} font-weight: bold;">${liveSalesDiff.val}</span>
				</div>
				<div>
					<strong>直播出单规格：</strong>
					 <!-- ${'--' || specStat.formula} =  -->
					 <span style="${
							specStat.color ? `color:${specStat.color};` : 'color: #fff;'
						} font-weight:bold;">${specStat.val.toFixed(2)}</span>
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
		// 清除旧弹窗
		const oldPopup = document.getElementById('douyin-monitor-popup');
		if (oldPopup) oldPopup.remove();

		if (!window.DM_UI || !window.DM_UI.createDarkPopup) {
			alert('UI 库未加载，请重载扩展并刷新页面');
			return;
		}

		const {container, header, content, actionsDiv, closeBtn} =
			window.DM_UI.createDarkPopup({
				id: 'douyin-monitor-popup',
				title: '', // Will populate manually
				width: '98%',
				zIndex: 10000,
				onClose: () => {
					// 关闭时从 DOM 中完全移除，以确保下次打开时状态新鲜
					container.remove();
				},
			});

		// 1. 设置 Title (Link)
		const titleEl = header.querySelector('.dm-popup-title');
		if (titleEl) {
			const link = document.createElement('a');
			link.href = `https://buyin.jinritemai.com/dashboard/merch-picking-library/merch-promoting?commodity_id=${promotionId}&commodity_location=1&id=${promotionId}`;
			link.target = '_blank';
			link.innerText = productName;
			link.className = 'dm-popup-title'; // Keep same style class if needed, or inherit
			link.style.textDecoration = 'underline';
			link.style.cursor = 'pointer';
			link.style.color = '#fff'; // Inherit color
			link.onmousedown = (e) => e.stopPropagation();

			titleEl.innerHTML = ''; // 清除空文本
			titleEl.appendChild(link);
		}

		// 2. 添加操作按钮

		// 刷新按钮
		const refreshBtn = document.createElement('button');
		refreshBtn.className = 'dm-button dm-btn-primary dm-btn-small';
		refreshBtn.innerText = '↻ 刷新';
		refreshBtn.onclick = (e) => {
			e.stopPropagation();
			refreshBtn.innerText = '分析中...';
			refreshBtn.disabled = true;
			refreshBtn.classList.remove('dm-btn-primary');
			refreshBtn.classList.add('dm-btn-warning');
			analyzeAndShow(promotionId, decision_enter_from);
		};
		refreshBtn.onmousedown = (e) => e.stopPropagation();

		// 检测达人卷按钮
		const snifferBtn = document.createElement('button');
		snifferBtn.className = 'dm-button dm-btn-primary dm-btn-small';
		snifferBtn.innerText = '检测达人卷';
		snifferBtn.onclick = (e) => {
			e.stopPropagation();
			if (!window.CouponSniffer) {
				alert('达人卷嗅探模块未加载');
				return;
			}
			const sevenDayIndex = ranges.indexOf(7);
			let targetProductId = null;
			let targetPromotionId = promotionId;

			if (sevenDayIndex !== -1 && results[sevenDayIndex]) {
				const sevenDayData = results[sevenDayIndex].data;
				targetProductId =
					sevenDayData?.product_id || sevenDayData?.data?.product_id;
				const apiPromotionId =
					sevenDayData?.promotion_id || sevenDayData?.data?.promotion_id;
				if (apiPromotionId) targetPromotionId = apiPromotionId;
			}

			if (!targetProductId) {
				console.warn(
					'未能在7天数据中找到 product_id, 将尝试使用 promotionId:',
					promotionId
				);
				targetProductId = promotionId;
			}
			window.CouponSniffer.runSniff(
				targetProductId,
				targetPromotionId,
				snifferBtn
			);
		};
		snifferBtn.onmousedown = (e) => e.stopPropagation();

		// 按顺序插入按钮
		actionsDiv.insertBefore(refreshBtn, closeBtn);
		actionsDiv.insertBefore(snifferBtn, closeBtn);

		// 3. 构建 Popover 内容 (Tables & Advice)
		const tablesContainer = document.createElement('div');
		tablesContainer.style.display = 'flex';
		tablesContainer.style.gap = '15px';
		tablesContainer.style.overflowX = 'auto';
		tablesContainer.style.paddingBottom = '10px';

		let adviceStats = null;

		results.forEach((item, index) => {
			const days = ranges[index];
			const stats = item.stats;
			if (!stats) {
				console.error('Stats not found for index', index);
				return;
			}
			const tableHtml = createTableHtml(stats);
			if (days === 7) adviceStats = stats;

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

		content.appendChild(tablesContainer);
		content.appendChild(adviceContainer);

		// DM_UI 自动处理追加到 body，DM_Utils 处理拖拽（如果可用）
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

			// 2. 请求 7/30/90 天数据
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

			// 检查有效性
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
				// 返回带有错误的结构，或者抛出？
				// handleBatchAnalyze 捕获错误，所以抛出是好的。
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
		btn.className = 'dm-button dm-btn-primary dm-btn-large';
		btn.innerText = '获取数据';

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
