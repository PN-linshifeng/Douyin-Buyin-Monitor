(function () {
	console.log(
		'%c [Douyin Monitor] Main Script Loaded',
		'color: #1966ff; font-weight: bold;'
	);

	function addWechatInfo() {
		// 定义统一的 HTML 内容
		const wechatHtml = `
            <div class="dm-wechat-info" style="margin-top: 5px; padding-top: 10px; border-top: 1px dashed #eee; font-size: 13px; color: #666; width: 100%; text-align: center; display: block;">
                微信：xxxx
            </div>
        `;

		// 1. 查找登录容器
		const loginModal = document.getElementById('douyin-monitor-login');
		if (loginModal && !loginModal.querySelector('.dm-wechat-info')) {
			const container = document.createElement('div');
			container.className = 'dm-wechat-info';
			container.innerHTML = wechatHtml;
			loginModal.appendChild(container);
			console.log('[Main] Logged wechat into login modal');
		}

		// 2. 查找按钮容器
		const widgetBody = document.getElementById('dm-widget-body');
		if (widgetBody && !widgetBody.querySelector('.dm-wechat-info')) {
			const container = document.createElement('div');
			container.className = 'dm-wechat-info';
			container.innerHTML = wechatHtml;
			widgetBody.appendChild(container);
			console.log('[Main] Logged wechat into widget body');
		}
	}

	// 使用定时器持续检查，因为这些容器是异步创建的
	setInterval(addWechatInfo, 1000);
})();
