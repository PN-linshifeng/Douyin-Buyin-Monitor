/**
 * 推广商品数据响应类型
 */
export interface PromotionDataResponse {
	code: number;
	data: PromotionData;
	log_id: string;
	msg: string;
	st: number;
}

/**
 * 主数据接口
 */
export interface PromotionData {
	promotion_id: string;
	product_id: string;
	item_type: number;
	model: PromotionModel;
}

/**
 * 推广模型
 */
export interface PromotionModel {
	promotion_data: PromotionDataDetail;
	content_data: ContentDataDetail;
}

/**
 * 推广数据详情
 */
export interface PromotionDataDetail {
	calculate_data: CalculateData;
	calculate_data_list: CalculateData[];
	stat_data: StatData;
	code: number;
}

/**
 * 内容数据详情
 */
export interface ContentDataDetail {
	calculate_data: ContentCalculateData;
	calculate_data_list: ContentCalculateData[];
	code: number;
}

/**
 * 通用计算数据
 */
export interface CalculateData {
	calculate_time: number;
	sales: number;
	pv: number;
	match_num: number;
	order_conversion_rate: number;
	sales_amount: number;
	sales_content_num: number;
	match_order_num: number;
	format_order_conversion_rate: string;
	format_sales_amount: string;
}

/**
 * 内容计算数据
 */
export interface ContentCalculateData {
	calculate_time: number;
	// 各渠道销量
	live_sales: number;
	format_live_sales: string;
	video_sales: number;
	format_video_sales: string;
	image_text_sales: number;
	format_image_text_sales: string;
	bind_shop_sales: number;
	format_bind_shop_sales: string;

	// 各渠道销售额
	live_sales_amount: number;
	format_live_sales_amount: string;
	video_sales_amount: number;
	format_video_sales_amount: string;
	image_text_sales_amount: number;
	format_image_text_sales_amount: string;
	bind_shop_sales_amount: number;
	format_bind_shop_sales_amount: string;

	// 各渠道匹配订单数
	live_match_order_num: number;
	video_match_order_num: number;
	image_text_match_order_num: number;
	bind_shop_match_order_num: number;

	// 各渠道内容数量
	live_count: number;
	video_count: number;
	image_text_count: number;

	// 各渠道转化率
	live_order_conversion_rate: number;
	format_live_order_conversion_rate: string;
	video_order_conversion_rate: number;
	format_video_order_conversion_rate: string;
	image_text_order_conversion_rate: number;
	format_image_text_order_conversion_rate: string;
	bind_shop_order_conversion_rate: number;
	format_bind_shop_order_conversion_rate: string;

	// 各渠道销售内容数
	live_sales_content_num: number;
	video_sales_content_num: number;
	image_text_sales_content_num: number;

	// 各渠道页面浏览量
	live_pv: number;
	video_pv: number;
	image_text_pv: number;
	bind_shop_pv: number;
}

/**
 * 统计数据
 */
export interface StatData {
	promotion_stat_data_list: PromotionStatData[];
}

/**
 * 推广统计数据
 */
export interface PromotionStatData {
	title: string;
	swith_text: SwitchText[];
	stat_data: StatDataDetail;
}

/**
 * 切换文本
 */
export interface SwitchText {
	key: 'sales_amount' | 'sales';
	name: string;
}

/**
 * 统计数据详情
 */
export interface StatDataDetail {
	sales: StatDataItem;
	sales_amount: StatDataItem;
}

/**
 * 统计数据项
 */
export interface StatDataItem {
	desc: string;
	stat_list: StatListItem[];
}

/**
 * 统计数据列表项
 */
export interface StatListItem {
	key: string;
	value: number;
}
