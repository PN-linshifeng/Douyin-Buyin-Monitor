(function () {
	const colors = {
		primary: '#1966ff', // 蓝色
		success: '#25c260', // 绿色
		warning: '#faad14', // 黄色
		danger: '#ff4d4f', // 红色
		disabled: '#999999',
		batch: '#1966ff',
	};

	const borderRadius = '50px';

	let globalMaxZIndex = 11000;

	window.DM_UI = {
		borderRadius: borderRadius,
		colors: colors,
		// 基础样式生成 (保留兼容性)
		getButtonStyle: function (bgColor, isTable = false) {
			const baseRadius = isTable ? '20px' : this.borderRadius;
			const padding = isTable ? '6px 12px' : '10px 20px';
			return `
                display: block;
                background-color: ${bgColor || colors.primary};
                color: white;
                border: none;
                border-radius: ${baseRadius};
                cursor: pointer;
                font-weight: bold;
                padding: ${padding} !important;
                transition: all 0.2s ease;
                box-shadow: 0 4px 10px rgba(0,0,0,0.1);
            `;
		},

		createDarkPopup: function (config) {
			// config: { id, title, width, onClose, zIndex }
			const {id, title, width = '90%', onClose, zIndex} = config;
			// Use global Z-index if not specified, or max of both
			let currentZ = zIndex
				? Math.max(zIndex, globalMaxZIndex + 1)
				: globalMaxZIndex + 1;
			globalMaxZIndex = currentZ;

			let container = document.getElementById(id);
			if (container) {
				// Determine if existing needs Z update
				container.style.display = 'block'; // Ensure visible
				container.style.zIndex = ++globalMaxZIndex;
				return {container, exists: true};
			}

			container = document.createElement('div');
			container.id = id;
			container.className = 'dm-dark-popup';
			// Dynamic overrides
			container.style.zIndex = currentZ;
			container.style.width = width;

			// Bring to front on click
			container.onmousedown = () => {
				container.style.zIndex = ++globalMaxZIndex;
			};

			// Header
			const header = document.createElement('div');
			header.className = 'dm-popup-header';

			const titleEl = document.createElement('h3');
			titleEl.className = 'dm-popup-title';
			titleEl.innerText = title;

			const actionsDiv = document.createElement('div');
			actionsDiv.style.cssText = 'display:flex; gap:8px; align-items:center;';

			// Close Button
			const closeBtn = document.createElement('button');
			closeBtn.innerText = '✕';
			closeBtn.className = 'dm-popup-close';
			// Toggle/Collapse Button
			const toggleBtn = document.createElement('button');
			let isExpanded = true;
			// Store initial position or default
			const initialTop = container.style.top || '100px';

			toggleBtn.innerText = '🔼 收起';
			toggleBtn.className = 'dm-button dm-btn-primary dm-btn-small';
			toggleBtn.style.marginRight = '4px';
			toggleBtn.onclick = (e) => {
				e.stopPropagation();
				isExpanded = !isExpanded;
				toggleBtn.innerText = isExpanded ? '🔼 收起' : '🔽 展开';

				content.style.display = isExpanded ? 'block' : 'none';

				// Standard collapse behavior: move to bottom
				if (!isExpanded) {
					// Save current top (computed or style)
					const currentTop =
						container.style.top || window.getComputedStyle(container).top;
					container.dataset.expandedTop = currentTop;

					container.style.top = 'calc(100vh - 60px)'; // Collapsed position
					container.style.transform = 'translate(-50%, 0)'; // Ensure x-centering is kept if used
				} else {
					// Restore top
					container.style.top = container.dataset.expandedTop || initialTop;
				}

				if (config.onToggle) {
					config.onToggle(isExpanded);
				}
			};

			closeBtn.onclick = () => {
				container.style.display = 'none';
				if (onClose) onClose();
			};

			actionsDiv.appendChild(toggleBtn);

			actionsDiv.appendChild(closeBtn);
			header.appendChild(titleEl);
			header.appendChild(actionsDiv);
			container.appendChild(header);

			const content = document.createElement('div');
			container.appendChild(content);

			document.body.appendChild(container);

			// Auto draggable if Utils available
			if (window.DM_Utils && window.DM_Utils.makeDraggable) {
				window.DM_Utils.makeDraggable(container, header);
			}

			return {container, header, content, actionsDiv, closeBtn, exists: false};
		},
	};

	console.log(
		'%c [Douyin Monitor UI] UI Module Loaded',
		'color: #1966ff; font-weight: bold;'
	);
})();
