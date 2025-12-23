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
		// 注入全局 CSS 样式
		injectGlobalStyles: function () {
			if (document.getElementById('dm-global-styles')) return;
			const style = document.createElement('style');
			style.id = 'dm-global-styles';
			style.innerHTML = `
                .dm-button {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    cursor: pointer !important;
                    outline: none !important;
                    border: none !important;
                    font-weight: bold !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    user-select: none !important;
                }
                .dm-button:hover {
                    filter: brightness(1.1);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 15px rgba(0,0,0,0.2) !important;
                }
                .dm-button:active {
                    filter: brightness(0.9);
                    transform: translateY(0) scale(0.98);
                }
                .dm-button:disabled {
                    filter: grayscale(0.6);
                    cursor: not-allowed !important;
                    transform: none !important;
                    opacity: 0.7;
                }
                
                /* 颜色变体 */
                .dm-btn-primary { background-color: ${colors.primary} !important; color: white !important; }
                .dm-btn-success { background-color: ${colors.success} !important; color: white !important; }
                .dm-btn-warning { background-color: ${colors.warning} !important; color: white !important; }
                .dm-btn-danger { background-color: ${colors.danger} !important; color: white !important; }
                .dm-btn-disabled { background-color: ${colors.disabled} !important; color: white !important; }
                
                /* Widget Container */
                #dm-main-widget {
                    position: fixed;
                    right: 20px;
                    top: 150px;
                    z-index: 99999;
                    display: flex;
                    flex-direction: column;
                    align-items: center; /* 更改为居中对齐 */
                    gap: 10px;
                    transition: all 0.3s ease;
                }
                #dm-widget-header {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    overflow: hidden;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    background: white;
                    cursor: pointer;
                    transition: transform 0.3s ease;
                    border: 2px solid white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: dm-breathe 3s infinite ease-in-out;
                    z-index: 100;
                }
                @keyframes dm-breathe {
                    0%, 100% { 
                        transform: scale(1); 
                        box-shadow: 0 4px 15px rgba(25, 102, 255, 0.2);
                    }
                    50% { 
                        transform: scale(1.08); 
                        box-shadow: 0 8px 25px rgba(25, 102, 255, 0.4);
                    }
                }
                #dm-widget-header:hover {
                    transform: scale(1.1);
                }
                #dm-widget-header img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                /* 容器面板 */
                #dm-widget-panel {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                    display: flex;
                    flex-direction: column;
                    min-width: 200px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    opacity: 1;
                    transform: translateY(0);
                    border: 1px solid #f0f0f0;
                    overflow: hidden;
                }
                #dm-widget-panel.collapsed {
                    // display: none;
                }

                #dm-widget-body {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    
                }

                #dm-widget-footer {
                    padding: 12px 24px;
                    background: #fafafa;
                    border-top: 1px solid #f5f5f5;
                    
                }
                
                /* Override buttons inside widget body to match width */
                #dm-widget-body .dm-button {
                    width: 100% !important;
                    margin: 0 !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                }
            `;
			document.head.appendChild(style);
		},
	};

	// 自动注入
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () =>
			window.DM_UI.injectGlobalStyles()
		);
	} else {
		window.DM_UI.injectGlobalStyles();
	}

	console.log(
		'%c [Douyin Monitor UI] Widget 容器样式已加载',
		'color: #1966ff; font-weight: bold;'
	);
})();
