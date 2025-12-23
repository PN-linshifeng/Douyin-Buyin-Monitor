(function () {
	console.log(
		'%c [达人卷嗅探] 模块已加载',
		'color: #fe2c55; font-weight: bold; font-size: 14px;'
	);

	let snifferBtn = null;
	const TARGET_PAGE = '/dashboard/merch-picking-library/merch-promoting';

	/**
	 * 获取 URL 参数
	 */
	function getQueryParam(name) {
		const urlParams = new URLSearchParams(window.location.search);
		return urlParams.get(name);
	}

	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	/**
	 * 核心嗅探逻辑
	 */
	async function runSniff(productId, promotionId) {
		//
		productId = productId || getQueryParam('product_id');
		promotionId = promotionId || getQueryParam('commodity_id');

		if (!productId) {
			alert('未能在 URL 中找到商品 ID');
			return;
		}

		console.log('[Sniffer] 开始嗅探 ID:', productId);
		const originalText = snifferBtn ? snifferBtn.innerText : '达人卷嗅探';
		if (snifferBtn) {
			snifferBtn.innerText = '正在嗅探...';
			snifferBtn.disabled = true;
		}

		try {
			// 第一步: 加橱窗
			console.log('[Sniffer] Step 1: 加橱窗');
			const addBody = `product_id=${productId}&item_type=4&pick_first_source=%E7%99%BE%E5%BA%94&pick_second_source=%E9%80%89%E5%93%81%E5%B9%BF%E5%9C%BA&pick_third_source=category_recommend&pick_source_id=`;
			await fetch('/pc/selection/window/pmt/add', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: addBody,
				credentials: 'include',
			});

			// 第二步：请求达人卷列表
			console.log('[Sniffer] Step 2: 获取达人卷列表');
			let resultText = '未找到数据';
			await sleep(10000);
			const times = 5;
			for (let i = 1; i <= times; i++) {
				// if (snifferBtn) snifferBtn.innerText = `获取中(${i}/3)...`;

				try {
					const timestamp = Date.now();
					const listUrl = `/api/buyin/marketing/anchor_coupon/promotion_list?_bid=mcenter_buyin&_luckybag_bid=buyin_luckybag&_=${timestamp}&s=485333&promotion_name_or_id=${productId}&page=1&size=10&search_type=0&need_channel=true`;

					const listRes = await fetch(listUrl, {
						method: 'GET',
						credentials: 'include',
					});
					const listData = await listRes.json();

					if (listData?.data?.data?.length > 0) {
						const item =
							listData.data.data.find(
								(d) =>
									d.product_id === promotionId || d.promotion_id === promotionId
							) || listData.data.data[0];

						if (item.reject_reason === '该商家不允许达人配置达人券') {
							resultText = item.reject_reason;
						} else {
							resultText = `达人卷，价格：${item.discount_price_display}，佣金率：${item.cos_ratio_display}`;
						}
						break; // 找到数据，退出循环
					}
				} catch (err) {
					console.warn(`[Sniffer] 第 ${i} 次尝试失败:`, err);
				}

				if (i < times) {
					console.log(`[Sniffer] 第 ${i} 次尝试未找到数据，7秒后重试...`);
					await sleep(3000);
				}
			}

			if (snifferBtn) {
				snifferBtn.innerText = resultText;
				snifferBtn.style.backgroundColor = resultText.includes('价格')
					? '#25c260'
					: '#ffa39e';
			} else {
				console.log('[Sniffer] 结果:', resultText);
			}
			// return;

			// 第三步：从橱窗删除
			await new Promise((r) => setTimeout(r, 3000));
			console.log('[Sniffer] Step 3: 移除橱窗');
			await fetch('/api/anchor/shop/unbind', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({promotion_id: promotionId}),
				credentials: 'include',
			});
		} catch (e) {
			console.error('[Sniffer] 嗅探失败:', e);
			if (snifferBtn) {
				snifferBtn.innerText = '嗅探失败';
				snifferBtn.disabled = false;
				setTimeout(() => {
					if (snifferBtn) {
						snifferBtn.innerText = originalText;
						snifferBtn.style.backgroundColor = '#fe2c55';
					}
				}, 3000);
			}
		}
	}

	/**
	 * 创建按钮
	 */
	function createSnifferButton() {
		if (snifferBtn) return;

		snifferBtn = document.createElement('button');
		snifferBtn.id = 'douyin-monitor-sniffer-btn';
		snifferBtn.className = 'dm-button dm-btn-primary';
		snifferBtn.innerText = '达人卷嗅探';
		if (window.DM_UI) {
			snifferBtn.style.cssText = window.DM_UI.getButtonStyle(null);
		}

		snifferBtn.onclick = () => runSniff();

		const mountBtn = () => {
			const container = document.getElementById('dm-widget-body');
			if (container) {
				container.appendChild(snifferBtn);
			} else {
				setTimeout(mountBtn, 500);
			}
		};
		mountBtn();
	}

	function removeSnifferButton() {
		if (snifferBtn) {
			snifferBtn.remove();
			snifferBtn = null;
		}
	}

	function checkPage() {
		if (window.location.href.indexOf(TARGET_PAGE) !== -1) {
			createSnifferButton();
		} else {
			removeSnifferButton();
		}
	}

	// 暴露接口
	window.CouponSniffer = {
		runSniff,
	};

	checkPage();
	setInterval(checkPage, 2000);
})();
