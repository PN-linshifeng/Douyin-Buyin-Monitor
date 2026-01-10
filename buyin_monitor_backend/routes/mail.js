const express = require('express');
const router = express.Router();
const {sendMail} = require('../utils/email_sender');

/**
 * 发送邮件接口
 * POST /api/mail/send
 * body: { to, content, subject }
 */
router.post('/send', async (req, res) => {
	const {to, content, subject} = req.body;

	if (!to || !content) {
		return res.status(400).json({
			success: false,
			msg: '参数缺失: 邮箱地址(to)和邮件内容(content)为必填项',
		});
	}

	try {
		const result = await sendMail(
			to,
			subject || '系统通知',
			content,
			`<div>${content}</div>` // 同时提供简单的 HTML 格式
		);

		if (result.success) {
			res.json({
				success: true,
				msg: '邮件发送成功',
				messageId: result.messageId,
			});
		} else {
			res
				.status(500)
				.json({success: false, msg: '邮件发送失败', error: result.error});
		}
	} catch (error) {
		res
			.status(500)
			.json({success: false, msg: '系统错误', error: error.message});
	}
});

module.exports = router;
