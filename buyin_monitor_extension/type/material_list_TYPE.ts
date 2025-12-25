// 根类型
interface ApiResponse {
	code: number;
	data: PromotionData;
	log_id: string;
	msg: string;
	st: number;
}

// 主数据结构
interface PromotionData {
	promotion_id: string;
	product_id: string;
	item_type: number;
	model: Model;
}

interface Model {
	promotion_data: PromotionDataDetail;
	content_data: ContentData;
}

// 促销数据部分
interface PromotionDataDetail {
	calculate_data: CalculateData;
	calculate_data_list: CalculateData[];
	stat_data: StatData;
	code: number;
}

// 统计数据
interface StatData {
	promotion_stat_data_list: PromotionStatData[];
}

interface PromotionStatData {
	title: string;
	swith_text: SwitchText[];
	stat_data: {
		sales: StatDetail;
		sales_amount: StatDetail;
	};
}

interface SwitchText {
	key: string;
	name: string;
}

interface StatDetail {
	desc: string;
	stat_list: StatItem[];
}

interface StatItem {
	key: string;
	value: number;
}

// 计算数据（通用）
interface CalculateData {
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

	// 以下字段仅存在于 content_data 中的 calculate_data
	live_sales?: number;
	format_live_sales?: string;
	video_sales?: number;
	format_video_sales?: string;
	image_text_sales?: number;
	format_image_text_sales?: string;
	bind_shop_sales?: number;
	format_bind_shop_sales?: string;
	live_sales_amount?: number;
	format_live_sales_amount?: string;
	video_sales_amount?: number;
	format_video_sales_amount?: string;
	image_text_sales_amount?: number;
	format_image_text_sales_amount?: string;
	bind_shop_sales_amount?: number;
	format_bind_shop_sales_amount?: string;
	live_match_order_num?: number;
	video_match_order_num?: number;
	image_text_match_order_num?: number;
	bind_shop_match_order_num?: number;
	live_count?: number;
	video_count?: number;
	image_text_count?: number;
	live_order_conversion_rate?: number;
	format_live_order_conversion_rate?: string;
	video_order_conversion_rate?: number;
	format_video_order_conversion_rate?: string;
	image_text_order_conversion_rate?: number;
	format_image_text_order_conversion_rate?: string;
	bind_shop_order_conversion_rate?: number;
	format_bind_shop_order_conversion_rate?: string;
	live_sales_content_num?: number;
	video_sales_content_num?: number;
	image_text_sales_content_num?: number;
	live_pv?: number;
	video_pv?: number;
	image_text_pv?: number;
	bind_shop_pv?: number;
}

// 内容数据部分
interface ContentData {
	calculate_data: CalculateData;
	calculate_data_list: CalculateData[];
	code: number;
}

// 如果你需要更严格的类型区分，可以创建两个不同的 CalculateData 类型
// 以下是拆分的版本：

interface PromotionCalculateData {
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

interface ContentCalculateData extends PromotionCalculateData {
	live_sales: number;
	format_live_sales: string;
	video_sales: number;
	format_video_sales: string;
	image_text_sales: number;
	format_image_text_sales: string;
	bind_shop_sales: number;
	format_bind_shop_sales: string;
	live_sales_amount: number;
	format_live_sales_amount: string;
	video_sales_amount: number;
	format_video_sales_amount: string;
	image_text_sales_amount: number;
	format_image_text_sales_amount: string;
	bind_shop_sales_amount: number;
	format_bind_shop_sales_amount: string;
	live_match_order_num: number;
	video_match_order_num: number;
	image_text_match_order_num: number;
	bind_shop_match_order_num: number;
	live_count: number;
	video_count: number;
	image_text_count: number;
	live_order_conversion_rate: number;
	format_live_order_conversion_rate: string;
	video_order_conversion_rate: number;
	format_video_order_conversion_rate: string;
	image_text_order_conversion_rate: number;
	format_image_text_order_conversion_rate: string;
	bind_shop_order_conversion_rate: number;
	format_bind_shop_order_conversion_rate: string;
	live_sales_content_num: number;
	video_sales_content_num: number;
	image_text_sales_content_num: number;
	live_pv: number;
	video_pv: number;
	image_text_pv: number;
	bind_shop_pv: number;
}

// 使用拆分类型的版本
interface StrictPromotionDataDetail {
	calculate_data: PromotionCalculateData;
	calculate_data_list: PromotionCalculateData[];
	stat_data: StatData;
	code: number;
}

interface StrictContentData {
	calculate_data: ContentCalculateData;
	calculate_data_list: ContentCalculateData[];
	code: number;
}

interface StrictModel {
	promotion_data: StrictPromotionDataDetail;
	content_data: StrictContentData;
}

interface StrictPromotionData {
	promotion_id: string;
	product_id: string;
	item_type: number;
	model: StrictModel;
}

interface StrictApiResponse {
	code: number;
	data: StrictPromotionData;
	log_id: string;
	msg: string;
	st: number;
}
