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

		/**
		 * 让元素可拖拽
		 * @param {HTMLElement} element 要移动的元素
		 * @param {HTMLElement} handle 触发拖拽的手柄元素
		 */
		makeDraggable: function (element, handle) {
			handle = handle || element;
			handle.style.cursor = 'move';

			let isDragging = false;
			let startX, startY, initialLeft, initialTop;

			handle.onmousedown = function (e) {
				// 如果点击的是按钮或链接，不触发拖拽
				if (['BUTTON', 'A', 'INPUT'].includes(e.target.tagName)) return;

				e.preventDefault();
				isDragging = true;
				startX = e.clientX;
				startY = e.clientY;

				const rect = element.getBoundingClientRect();
				initialLeft = rect.left;
				initialTop = rect.top;

				// 切换为 Fixed 定位以便控制
				element.style.position = 'fixed';
				element.style.margin = '0';
				element.style.transform = 'none'; // 清除 transform 居中
				element.style.left = initialLeft + 'px';
				element.style.top = initialTop + 'px';

				document.addEventListener('mousemove', onMouseMove);
				document.addEventListener('mouseup', onMouseUp);
			};

			let rafId = null;
			let currentE = null; // Store latest event to calculate safely

			function updatePosition() {
				if (!isDragging || !currentE) {
					rafId = null;
					return;
				}
				const dx = currentE.clientX - startX;
				const dy = currentE.clientY - startY;
				element.style.left = initialLeft + dx + 'px';
				element.style.top = initialTop + dy + 'px';
				rafId = null;
			}

			function onMouseMove(e) {
				if (!isDragging) return;
				currentE = e; // Update latest event reference

				if (!rafId) {
					rafId = requestAnimationFrame(updatePosition);
				}
			}

			function onMouseUp() {
				isDragging = false;
				if (rafId) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
			}
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
