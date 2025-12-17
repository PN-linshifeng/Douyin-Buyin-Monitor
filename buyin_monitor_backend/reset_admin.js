const fs = require('fs');
const path = require('path');
const crypto = require('crypto-js');

const SECRET_KEY = 'your_secret_key_here';
const ADMIN_FILE = path.join(__dirname, 'admin.json');

function encrypt(text) {
	return crypto.AES.encrypt(text, SECRET_KEY).toString();
}

const admins = [
	{
		username: 'admin',
		password: encrypt('123456'),
	},
];

fs.writeFileSync(ADMIN_FILE, JSON.stringify(admins, null, 2));
console.log('Admin password reset to: 123456');
