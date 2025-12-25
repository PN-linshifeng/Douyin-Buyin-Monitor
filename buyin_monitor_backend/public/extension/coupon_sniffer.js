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
	/**
	 * 检查商品是否在达人卷列表中
	 */
	async function checkProductInCouponList(productId) {
		const timestamp = Date.now();
		const listUrl = `/api/buyin/marketing/anchor_coupon/promotion_list?_bid=mcenter_buyin&_luckybag_bid=buyin_luckybag&_=${timestamp}&s=485333&promotion_name_or_id=${productId}&page=1&size=10&search_type=0&need_channel=true`;

		const res = await fetch(listUrl, {
			method: 'GET',
			credentials: 'include',
		});
		const resData = await res.json();
		const list = resData?.data?.data || [];
		return list.find(
			(it) => it.product_id === productId || it.promotion_id === productId
		);
	}

	/**
	 * 根据 item 判断结果文案和类型
	 */
	function getResultFromItem(item) {
		if (item.reject_reason === '该商家不允许达人配置达人券') {
			return {text: '商家不参加达人卷', type: 'error'};
		}
		return {text: '参加达人卷', type: 'success'};
	}

	/**
	 * 核心嗅探逻辑
	 */
	async function runSniff(productId, promotionId, btnElement) {
		productId = productId || getQueryParam('product_id');
		promotionId = promotionId || getQueryParam('commodity_id');

		const targetBtn = btnElement || snifferBtn;

		if (!productId) {
			alert('未能在 URL 中找到商品 ID');
			return;
		}

		console.log('[达人卷嗅探] 开始嗅探 ID:', productId);
		const originalText = targetBtn ? targetBtn.innerText : '检测达人卷';

		// 更新 UI 状态 helper
		const updateBtn = (text, type) => {
			if (!targetBtn) return;
			targetBtn.innerText = text;
			targetBtn.disabled = false;
			targetBtn.classList.remove(
				'dm-btn-primary',
				'dm-btn-success',
				'dm-btn-danger',
				'dm-btn-warning'
			);
			if (type === 'loading') {
				targetBtn.disabled = true;
				targetBtn.classList.add('dm-btn-warning');
			} else if (type === 'success') {
				targetBtn.classList.add('dm-btn-success');
			} else if (type === 'error') {
				targetBtn.classList.add('dm-btn-danger');
			} else {
				targetBtn.classList.add('dm-btn-primary');
			}
		};

		updateBtn(`正在${originalText}...`, 'loading');

		try {
			// 步骤 0: 先检查是否已经在列表中
			console.log('[达人卷嗅探] 步骤 0: 预检查达人卷列表');
			try {
				const existingItem = await checkProductInCouponList(productId);
				if (existingItem) {
					const {text, type} = getResultFromItem(existingItem);
					console.log('[达人卷嗅探] 预检查命中:', text);
					updateBtn(text, type);
					return; // 直接结束
				}
			} catch (err) {
				console.warn('[达人卷嗅探] 预检查失败，继续执行常规流程:', err);
			}

			// 如果不在列表中，执行原本的 1-2-3 流程
			// 第一步: 加橱窗
			console.log('[达人卷嗅探] 步骤 1: 加橱窗');
			const addBody = `product_id=${productId}&item_type=4&pick_first_source=%E7%99%BE%E5%BA%94&pick_second_source=%E9%80%89%E5%93%81%E5%B9%BF%E5%9C%BA&pick_third_source=category_recommend&pick_source_id=`;
			const addRes = await fetch('/pc/selection/window/pmt/add', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
				},
				body: addBody,
				credentials: 'include',
			});
			const addResData = await addRes.json();
			if (addResData.code !== 0) {
				// 如果已经在橱窗里但刚才没查到（罕见），或者其他错误
				// 这里如果是"商品已在橱窗"，其实也可以继续去查一次，但为了保险起见，如果添加失败主要还是报错
				if (addResData.msg && addResData.msg.includes('橱窗')) {
					// 可能是"商品已在橱窗中"，这种情况下继续往下执行 Step 2
					console.warn('[达人卷嗅探] 加橱窗提示:', addResData.msg);
				} else {
					alert(addResData.msg);
					throw new Error(addResData.msg);
				}
			}

			// 第二步：请求达人卷列表 (循环检查)
			console.log('[达人卷嗅探] 步骤 2: 获取达人卷列表 (循环)');
			let resultText = '未找到数据';
			let resultType = 'error'; // 默认是失败/未找到
			let found = false;
			const times = 10;

			for (let i = 1; i <= times; i++) {
				try {
					const item = await checkProductInCouponList(productId);
					if (item) {
						const res = getResultFromItem(item);
						resultText = res.text;
						resultType = res.type;
						found = true;
						break; // 找到数据，退出循环
					}
				} catch (err) {
					console.warn(`[达人卷嗅探] 第 ${i} 次尝试失败:`, err);
				}

				if (i < times) {
					console.log(`[达人卷嗅探] 第 ${i} 次尝试未找到数据，3秒后重试...`);
					await sleep(5000);
				}
			}

			if (targetBtn) {
				updateBtn(resultText, found ? resultType : 'error');
			}

			// 第三步：从橱窗删除
			await new Promise((r) => setTimeout(r, 1000)); // 稍微等一下再删，避免操作过快
			console.log('[达人卷嗅探] 步骤 3: 移除橱窗');
			await fetch('/api/anchor/shop/unbind', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({promotion_id: promotionId}),
				credentials: 'include',
			});
		} catch (e) {
			console.error('[达人卷嗅探] 嗅探失败:', e);
			updateBtn('检测达人卷失败', 'error');
			setTimeout(() => {
				updateBtn(originalText, 'primary'); // 恢复
			}, 3000);
		}
	}

	// 暴露接口
	window.CouponSniffer = {
		runSniff,
	};
})();
