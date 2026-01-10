const {sendMail} = require('./utils/email_sender');

const testParams = {
	to: '245810159@qq.com',
	content: '这是一封测试邮件的内容',
	subject: 'test主题',
};

async function runTest() {
	console.log('开始邮件发送测试...');
	const result = await sendMail(
		testParams.to,
		testParams.subject,
		testParams.content
	);
	if (result.success) {
		console.log('测试成功！邮件 ID:', result.messageId);
	} else {
		console.log('测试失败！错误信息:', result.error);
		process.exit(1);
	}
}

runTest();
