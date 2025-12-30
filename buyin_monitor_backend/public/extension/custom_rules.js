/**
 * 自定义规则配置 UI
 * 为用户提供一个弹出窗口来定义他们的选品规则。
 */
(function () {
	console.log(
		'%c [抖音选品] 自定义规则模块已加载',
		'color: #4eca06; font-weight: bold; font-size: 14px;'
	);

	let currentConfig = {
		rules: [], // { target, op, val, msg, color, status }
		overall_rules: [], // { result, criteria: {good, passed, bad} }
	};

	// 辅助函数：通过 content.js 代理发送 API 请求
	function callApi(endpoint, body) {
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
			window.postMessage(
				{
					type: 'DOUYIN_MONITOR_API_CALL',
					requestId,
					payload: {
						url: `/api/extension/${endpoint}`,
						method: 'POST',
						body: body,
					},
				},
				'*'
			);
			// 超时
			setTimeout(() => {
				window.removeEventListener('message', handler);
				reject(new Error('Timeout'));
			}, 5000);
		});
	}

	async function loadConfig() {
		try {
			// 代理默认发送 POST 请求体，让我们尝试使用空请求体或更改代理以支持 GET
			const result = await new Promise((resolve, reject) => {
				const requestId = Date.now() + '_get_' + Math.random();
				const handler = (event) => {
					if (
						event.source === window &&
						event.data.type === 'DOUYIN_MONITOR_FETCH_RESULT' &&
						event.data.requestId === requestId
					) {
						window.removeEventListener('message', handler);
						if (event.data.success) resolve(event.data.data);
						else reject(new Error(event.data.error));
					}
				};
				window.addEventListener('message', handler);
				window.postMessage(
					{
						type: 'DOUYIN_MONITOR_API_CALL',
						requestId,
						payload: {
							url: '/api/extension/get_selection_config',
							method: 'GET',
						},
					},
					'*'
				);
			});

			if (result && result.selection_config) {
				try {
					currentConfig = JSON.parse(result.selection_config);
				} catch (e) {
					console.error('Parse config error', e);
				}
			}
		} catch (e) {
			console.error('获取配置失败', e);
		}
	}

	async function saveConfig() {
		try {
			const jsonStr = JSON.stringify(currentConfig);
			await callApi('save_selection_config', {selection_config: jsonStr});
			alert('保存成功');
		} catch (e) {
			alert('保存失败: ' + e.message);
		}
	}

	// UI 渲染器
	function renderRulesList(container) {
		container.innerHTML = '';
		if (!currentConfig.rules || currentConfig.rules.length === 0) {
			container.innerHTML = '<div style="color:#888;">暂无规则</div>';
			return;
		}

		currentConfig.rules.forEach((rule, index) => {
			const row = document.createElement('div');
			row.className = 'dm-rule-item';
			// Removed inline style: display, gap, margin-bottom, align-items, background, padding, border-radius

			const info = document.createElement('div');
			info.style.flex = '1';
			info.innerHTML = `
                <strong style="color: #4ea1ff;">${getFieldName(
									rule.target
								)}</strong> 
                ${rule.op} 
                <span style="color: #ffca28;">${rule.val}</span> 
                => <span style="color: ${rule.color || '#fff'}">${
				rule.msg
			}</span>
                [${rule.status || 'normal'}]
            `;

			const delBtn = document.createElement('button');
			delBtn.innerText = '删除';
			delBtn.className = 'dm-button dm-btn-danger dm-btn-small';
			delBtn.onclick = () => {
				currentConfig.rules.splice(index, 1);
				renderRulesList(container);
			};

			row.appendChild(info);
			row.appendChild(delBtn);
			container.appendChild(row);
		});
	}

	function getFieldName(key) {
		const map = {
			card_vol: '商品卡-销量',
			card_share: '商品卡-占比(%)',
			card_daily: '商品卡-日销',
			card_price: '商品卡-客单价',
			live_vol: '直播-销量',
			live_share: '直播-占比(%)',
			live_daily: '直播-日销',
			live_price: '直播-客单价',
			video_vol: '短视频-销量',
			video_share: '短视频-占比(%)',
			video_daily: '短视频-日销',
			video_price: '短视频-客单价',
			imageText_vol: '图文-销量',
			imageText_share: '图文-占比(%)',
			imageText_daily: '图文-日销',
			imageText_price: '图文-客单价',
			bindShop_vol: '橱窗-销量',
			bindShop_share: '橱窗-占比(%)',
			bindShop_daily: '橱窗-日销',
			bindShop_price: '橱窗-客单价',
			liveSpec: '直播规格(差值)',
			liveSalesDiff: '直播人均出单数',
			totalSales: '总销量',
			// 遗留映射
			cardShare: '商品卡占比(%)',
			cardDaily: '商品卡日销',
		};
		return map[key] || key;
	}

	function renderOverallList(container) {
		container.innerHTML = '';
		if (
			!currentConfig.overall_rules ||
			currentConfig.overall_rules.length === 0
		) {
			container.innerHTML = '<div style="color:#888;">暂无综合规则</div>';
			return;
		}

		currentConfig.overall_rules.forEach((rule, index) => {
			const row = document.createElement('div');
			row.className = 'dm-rule-item';
			// Removed inline style

			const c = rule.criteria || {};
			const desc = [];
			if (c.good) desc.push(`Good >= ${c.good}`);
			if (c.passed) desc.push(`Passed >= ${c.passed}`);
			if (c.bad) desc.push(`Bad >= ${c.bad}`);

			const info = document.createElement('div');
			info.style.flex = '1';
			info.innerHTML = `
                满足: [${desc.join(' , ')}] => 
                <strong style="color: ${
									rule.result === 'bad' ? '#ff4d4f' : '#25c260'
								}">${rule.result}</strong>
            `;

			const delBtn = document.createElement('button');
			delBtn.innerText = '删除';
			delBtn.className = 'dm-button dm-btn-danger dm-btn-small';
			delBtn.onclick = () => {
				currentConfig.overall_rules.splice(index, 1);
				renderOverallList(container);
			};

			row.appendChild(info);
			row.appendChild(delBtn);
			container.appendChild(row);
		});
	}

	function showConfigPopup() {
		if (!window.DM_UI) {
			alert('UI 库未加载');
			return;
		}

		// 清除旧弹窗
		const oldPopup = document.getElementById('dm-custom-rules-popup');
		if (oldPopup) oldPopup.remove();

		const {container, header, content, actionsDiv, closeBtn} =
			window.DM_UI.createDarkPopup({
				id: 'dm-custom-rules-popup',
				title: '自定义选品规则配置',
				onClose: () => {
					container.remove();
				},
			});

		// 确保重新加载配置
		loadConfig().then(() => {
			renderUI();
		});

		function renderUI() {
			content.innerHTML = ''; // 清除

			// --- 布局：上下分割 ---

			// 1. 单项规则
			const section1 = document.createElement('div');
			section1.className = 'dm-section';
			section1.innerHTML =
				'<h3 class="dm-section-title">1. 单项指标文案规则</h3>';
			section1.style.marginBottom = '20px';
			section1.style.padding = '15px';
			section1.style.border = '1px solid rgba(255,255,255,0.1)';
			section1.style.borderRadius = '8px';

			// 添加表单
			const ruleForm = document.createElement('div');
			ruleForm.className = 'dm-form-row';
			ruleForm.style.display = 'flex';
			ruleForm.style.gap = '10px';
			ruleForm.style.marginBottom = '10px';
			ruleForm.style.flexWrap = 'wrap';
			ruleForm.style.alignItems = 'flex-end';

			// 指标选择
			ruleForm.innerHTML = `
                <div class="dm-form-group" style="flex:1; min-width: 120px;">
                    <label>指标</label>
                    <select id="cr-target" class="dm-input">
                        <optgroup label="商品卡">
                            <option value="card_vol">商品卡-销售量</option>
                            <option value="card_share">商品卡-销售占比(%)</option>
                            <option value="card_daily">商品卡-日均销售(单)</option>
                            <option value="card_price">商品卡-平均客单价</option>
                        </optgroup>
                        <optgroup label="直播">
                            <option value="live_vol">直播-销售量</option>
                            <option value="live_share">直播-销售占比(%)</option>
                            <option value="live_daily">直播-日均销售(单)</option>
                            <option value="live_price">直播-平均客单价</option>
                        </optgroup>
                        <optgroup label="短视频">
                            <option value="video_vol">短视频-销售量</option>
                            <option value="video_share">短视频-销售占比(%)</option>
                            <option value="video_daily">短视频-日均销售(单)</option>
                            <option value="video_price">短视频-平均客单价</option>
                        </optgroup>
                        <optgroup label="图文">
                            <option value="imageText_vol">图文-销售量</option>
                            <option value="imageText_share">图文-销售占比(%)</option>
                            <option value="imageText_daily">图文-日均销售(单)</option>
                            <option value="imageText_price">图文-平均客单价</option>
                        </optgroup>
                        <optgroup label="橱窗">
                            <option value="bindShop_vol">橱窗-销售量</option>
                            <option value="bindShop_share">橱窗-销售占比(%)</option>
                            <option value="bindShop_daily">橱窗-日均销售(单)</option>
                            <option value="bindShop_price">橱窗-平均客单价</option>
                        </optgroup>
                        <optgroup label="其他">
                            <option value="liveSpec">直播规格(差值)</option>
                            <option value="liveSalesDiff">直播人均出单数</option>
                             <option value="totalSales">总销量</option>
                        </optgroup>
                    </select>
                </div>
                <div class="dm-form-group" style="flex:0.5; min-width: 80px;">
                    <label>运算符</label>
                    <select id="cr-op" class="dm-input">
                        <option value="<">&lt; 小于</option>
                        <option value="<=">&le; 小于等于</option>
                        <option value=">">&gt; 大于</option>
                        <option value=">=">&ge; 大于等于</option>
                    </select>
                </div>
                 <div class="dm-form-group" style="flex:1; min-width: 80px;">
                    <label>阈值</label>
                    <input id="cr-val" type="number" class="dm-input" placeholder="e.g. 13">
                </div>
                 <div class="dm-form-group" style="flex:2; min-width: 200px;">
                    <label>提示文案</label>
                    <input id="cr-msg" type="text" class="dm-input" placeholder="e.g. 销量占比过低">
                </div>
                 <div class="dm-form-group" style="flex:1; min-width: 100px;">
                    <label>颜色 & 状态</label>
                    <select id="cr-status" class="dm-input">
                        <option value="bad" style="color:var(--dm-danger)">Bad (Red)</option>
                        <option value="passed" style="color:var(--dm-warning)">Passed (Orange)</option>
                        <option value="good" style="color:var(--dm-success)">Good (Green)</option>
                    </select>
                </div>
            `;

			const addRuleBtn = document.createElement('button');
			addRuleBtn.innerText = '添加规则';
			addRuleBtn.className = 'dm-button dm-btn-primary';
			addRuleBtn.style.height = '36px';
			addRuleBtn.onclick = () => {
				const target = document.getElementById('cr-target').value;
				const op = document.getElementById('cr-op').value;
				const val = document.getElementById('cr-val').value;
				const msg = document.getElementById('cr-msg').value;
				const statusMap = document.getElementById('cr-status');
				const status = statusMap.value;
				const color =
					status === 'bad'
						? '#ff4d4f'
						: status === 'good'
						? '#25c260'
						: '#faad14';

				if (!val) {
					alert('请输入阈值');
					return;
				}

				if (!currentConfig.rules) currentConfig.rules = [];
				currentConfig.rules.push({
					target,
					op,
					val,
					msg,
					color,
					status,
				});
				renderRulesList(rulesListDiv);
			};
			ruleForm.appendChild(addRuleBtn);

			const rulesListDiv = document.createElement('div');
			rulesListDiv.className = 'dm-rule-list';

			section1.appendChild(ruleForm);
			section1.appendChild(rulesListDiv);

			// 2. 综合判定规则
			const section2 = document.createElement('div');
			section2.className = 'dm-section';
			section2.innerHTML = '<h3 class="dm-section-title">2. 综合选品判定</h3>';

			const overallForm = document.createElement('div');
			overallForm.className = 'dm-form-row';

			overallForm.innerHTML = `
                <div class="dm-form-group" style="flex:1;">
                    <label>Good 数量 >=</label>
                    <input id="or-good" type="number" class="dm-input" value="0">
                </div>
                 <div class="dm-form-group" style="flex:1;">
                    <label>Passed 数量 >=</label>
                    <input id="or-passed" type="number" class="dm-input" value="0">
                </div>
                 <div class="dm-form-group" style="flex:1;">
                    <label>Bad 数量 >=</label>
                    <input id="or-bad" type="number" class="dm-input" value="0">
                </div>
                 <div class="dm-form-group" style="flex:1;">
                    <label>判定结果</label>
                    <select id="or-result" class="dm-input">
                        <option value="good" style="color:var(--dm-success)">推荐 (Good)</option>
                        <option value="passed" style="color:var(--dm-warning)">通过 (Passed)</option>
                        <option value="bad" style="color:var(--dm-danger)">不推荐 (Bad)</option>
                    </select>
                </div>
            `;

			const addOverallBtn = document.createElement('button');
			addOverallBtn.innerText = '添加判定';
			addOverallBtn.className = 'dm-button dm-btn-primary';
			addOverallBtn.style.height = '36px';
			addOverallBtn.onclick = () => {
				const g = parseInt(document.getElementById('or-good').value) || 0;
				const p = parseInt(document.getElementById('or-passed').value) || 0;
				const b = parseInt(document.getElementById('or-bad').value) || 0;
				const res = document.getElementById('or-result').value;

				if (g === 0 && p === 0 && b === 0) {
					alert('请至少设置一个条件数量');
					return;
				}

				if (!currentConfig.overall_rules) currentConfig.overall_rules = [];
				currentConfig.overall_rules.push({
					result: res,
					criteria: {
						good: g,
						passed: p,
						bad: b,
					},
				});
				renderOverallList(overallListDiv);
			};
			overallForm.appendChild(addOverallBtn);

			const overallListDiv = document.createElement('div');
			overallListDiv.className = 'dm-rule-list';
			overallListDiv.style.maxHeight = '150px';

			section2.appendChild(overallForm);
			section2.appendChild(overallListDiv);

			// 追加各部分
			content.appendChild(section1);
			content.appendChild(section2);

			// 渲染初始列表
			renderRulesList(rulesListDiv);
			renderOverallList(overallListDiv);
		}

		// 保存按钮逻辑
		const saveBtn = document.createElement('button');
		saveBtn.className = 'dm-button dm-btn-success dm-btn-large';
		saveBtn.innerText = '💾 保存配置';
		saveBtn.onclick = saveConfig;

		actionsDiv.insertBefore(saveBtn, closeBtn);
	}

	function createConfigButton(container) {
		if (!container) return;
		if (document.getElementById('douyin-monitor-config-btn')) return;

		const configBtn = document.createElement('button');
		configBtn.id = 'douyin-monitor-config-btn';
		configBtn.innerText = '规则配置';
		configBtn.className = 'dm-button dm-btn-primary dm-btn-large';
		if (window.DM_UI) {
			configBtn.style.setProperty('width', '100%', 'important');
		}
		configBtn.onclick = () => {
			showConfigPopup();
		};
		container.appendChild(configBtn);
	}

	// Auto-mount button logic
	function autoMount() {
		const container = document.getElementById('dm-widget-body');
		if (container) {
			createConfigButton(container);
		} else {
			// Retry if widget not ready
			setTimeout(autoMount, 1000);
		}
	}

	// Start auto-mount attempt
	autoMount();

	window.CustomRules = {
		showConfigPopup,
		createConfigButton,
	};
})();
