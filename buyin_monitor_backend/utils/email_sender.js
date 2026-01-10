/**
 * QQ邮箱发送工具类
 * 使用独立的 nodemailer 实现
 */
const nodemailer = require('nodemailer');

// 配置信息
const EMAIL_CONFIG = {
	host: 'smtp.qq.com',
	port: 465,
	secure: true, // 使用 SSL
	auth: {
		user: '245810159@qq.com',
		pass: 'bxkymuraioqocaed', // 这里的授权码请确保已在QQ邮箱设置中开启并获取
	},
};

/**
 * 发送邮件函数
 * @param {string} to 收件人邮箱
 * @param {string} subject 邮件主题
 * @param {string} text 邮件纯文本内容
 * @param {string} html 邮件HTML内容 (可选)
 * @returns {Promise}
 */
async function sendMail(to, subject, text, html = '') {
	const transporter = nodemailer.createTransport(EMAIL_CONFIG);

	const mailOptions = {
		from: `"Douyin Monitor" <${EMAIL_CONFIG.auth.user}>`,
		to: to,
		subject: subject,
		subject: subject,
		text: text,
		html: html,
	};

	try {
		const info = await transporter.sendMail(mailOptions);
		console.log('[Email] 发送成功:', info.messageId);
		return {success: true, messageId: info.messageId};
	} catch (error) {
		console.error('[Email] 发送失败:', error);
		return {success: false, error: error.message};
	}
}

module.exports = {
	sendMail,
};

// 示例用法:
// const { sendMail } = require('./utils/email_sender');
// sendMail('recipient@example.com', '测试邮件', '这是一封测试邮件的内容');
