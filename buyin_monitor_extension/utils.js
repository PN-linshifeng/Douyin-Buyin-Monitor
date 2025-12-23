(function () {
	const registry = [];
	let lastUrl = window.location.href;

	const DM_Utils = {
		/**
		 * 监听路由并在 URL 匹配时执行回调
		 * @param {Object} config
		 * @param {string|RegExp} config.urlPattern 匹配的 URL 模式
		 * @param {Function} config.onMatch 匹配成功时的回调 (创建 UI)
		 * @param {Function} config.onUnmatch 匹配失败时的回调 (清理 UI)
		 */
		watchRouteChange: function (config) {
			registry.push({
				...config,
				isActive: false,
			});
			// 立即检查一次
			this.checkAll();
		},

		checkAll: function () {
			const currentUrl = window.location.href;
			registry.forEach((item) => {
				const isMatch =
					typeof item.urlPattern === 'string'
						? currentUrl.indexOf(item.urlPattern) !== -1
						: item.urlPattern.test(currentUrl);

				if (isMatch && !item.isActive) {
					// 状态从不匹配变为匹配 -> 执行创建
					item.isActive = true;
					if (item.onMatch) item.onMatch();
				} else if (!isMatch && item.isActive) {
					// 状态从匹配变为不匹配 -> 执行清理
					item.isActive = false;
					if (item.onUnmatch) item.onUnmatch();
				}
			});
		},

		init: function () {
			// 1. 监听浏览器事件
			window.addEventListener('popstate', () => this.checkAll());
			window.addEventListener('hashchange', () => this.checkAll());

			// 2. 轮询检查 (兼容 pushState/replaceState)
			setInterval(() => {
				if (window.location.href !== lastUrl) {
					lastUrl = window.location.href;
					this.checkAll();
				}
			}, 1000);

			console.log(
				'%c [Douyin Monitor Utils] Route Watcher Active',
				'color: #1966ff; font-weight: bold;'
			);
		},
	};

	window.DM_Utils = DM_Utils;
	DM_Utils.init();
})();
