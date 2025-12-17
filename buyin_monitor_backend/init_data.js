const fs = require('fs');
const path = require('path');
const crypto = require('crypto-js');

const SECRET_KEY = 'your_secret_key_here';
const USER_FILE = path.join(__dirname, 'user.json');

function encrypt(text) {
	return crypto.AES.encrypt(text, SECRET_KEY).toString();
}

const users = [
	{
		id: 1,
		phone: encrypt('13800138000'), // 测试账号
		buyinId: '',
		createTime: new Date().toISOString(),
		updateTime: new Date().toISOString(),
		expirationTime: '2099-12-31T23:59:59.000Z', // 不过期
	},
];

fs.writeFileSync(USER_FILE, JSON.stringify(users, null, 2));
console.log('User data initialized with encrypted phone 13800138000');
