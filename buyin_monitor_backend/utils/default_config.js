// ==========================================
// 综合选品配置 (默认配置)
// ==========================================
const DEFAULT_SELECTION_CONFIG = {
	rules: [
		// --- 1. 商品卡销量占比 (D2) ---
		{
			target: 'cardShare',
			op: '<',
			val: 13,
			msg: '该品的商品卡销量占比过低',
			type: 'share',
			color: '#ff4d4f',
			status: 'bad',
		},
		{
			target: 'cardShare',
			op: '<',
			val: 40,
			msg: '该品的商品卡占比还不错',
			type: 'share',
		},
		{
			target: 'cardShare',
			op: '>=',
			val: 40,
			msg: '该品的商品卡占比优秀',
			type: 'share',
			color: '#25c260',
			status: 'good',
		},

		// --- 2. 商品卡日均销售单数 (E2) ---
		// 绿色特殊逻辑 (优先级较高，放在前面)
		{
			conditions: [
				{target: 'cardShare', op: '<', val: 13},
				{target: 'cardDaily', op: '>', val: 500},
			],
			msg: '商品卡日销量很不错',
			type: 'daily',
			color: '#25c260',
			status: 'good',
		},
		{
			conditions: [
				{target: 'cardShare', op: '>=', val: 13},
				{target: 'cardDaily', op: '>', val: 200},
			],
			msg: '商品卡日销量很不错',
			type: 'daily',
			color: '#25c260',
			status: 'good',
		},
		// 常规阈值逻辑
		{
			target: 'cardDaily',
			op: '<',
			val: 100,
			msg: '商品卡日销量较低',
			color: '#ff4d4f',
			status: 'bad',
			type: 'daily',
		},
		{
			target: 'cardDaily',
			op: '<',
			val: 300,
			msg: '商品卡日销量为一般',
			type: 'daily',
		},
		{
			target: 'cardDaily',
			op: '<',
			val: 500,
			msg: '商品卡日销量不错',
			type: 'daily',
		},
		{
			target: 'cardDaily',
			op: '>=',
			val: 500,
			msg: '商品卡日销量很好',
			type: 'daily',
		},

		// --- 3. 直播出单规格 (specDiff) ---
		{
			target: 'liveSpec',
			op: '<=',
			val: -5,
			msg: '出单大部分严重亏损，佣金高于{y}元，才能盈利，请谨慎选品。',
			color: '#ff4d4f',
			status: 'bad',
			type: 'spec',
		},
		{
			target: 'liveSpec',
			op: '<=',
			val: -2,
			msg: '出单大部分为低规格，且亏损，佣金高于{y}元，才能盈利，请谨慎选品',
			color: '#ff4d4f',
			status: 'bad',
			type: 'spec',
		},
		{
			target: 'liveSpec',
			op: '<',
			val: 0,
			msg: '出单大部分为低规格，佣金高于{y}元，才能盈利。',
			type: 'spec',
		},
		{
			conditions: [
				{target: 'liveSpec', op: '>', val: 4},
				{target: 'liveSpec', op: '<', val: 10},
			],
			msg: '出单大部分为中等规格，可作为利润品',
			color: '#25c260',
			status: 'good',
			type: 'spec',
		},
		{
			conditions: [
				{target: 'liveSpec', op: '>=', val: 10},
				{target: 'liveSpec', op: '<', val: 20},
			],
			msg: '出单大部分为高规格，可作为利润品。',
			color: '#25c260',
			status: 'good',
			type: 'spec',
		},
		{
			target: 'liveSpec',
			op: '>=',
			val: 20,
			msg: '出单大部分为超高规格，可作为高额利润品。',
			color: '#25c260',
			status: 'good',
			type: 'spec',
		},
	],
	overall_rules: [
		{
			result: 'good',
			criteria: {good: 3}, // 3 good signals
		},
		{
			result: 'passed',
			conditions: [
				{target: 'liveSalesDiff', op: '>', val: 10},
				{target: 'liveSpec', op: '>', val: 0},
			],
		},
		{
			result: 'bad',
			criteria: {bad: 3}, // 3 bad signals
		},
	],
	status_config: {
		good: {
			html: '<span style="color:#25c260; font-weight:bold;">👍 带利润的好品！</span>',
		},
		passed: {
			html: '<span style="color:#faad14; font-weight:bold;">✅ 已通过初筛</span>',
		},
		normal: {html: '<span style="color:#333; font-weight:bold;">正常</span>'},
		bad: {
			html: '<span style="color:#ff4d4f; font-weight:bold;">⚠️ 请谨慎选择！</span>',
		},
	},
};

module.exports = DEFAULT_SELECTION_CONFIG;
