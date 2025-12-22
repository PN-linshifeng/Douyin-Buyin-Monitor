const crypto = require('crypto-js');

const SECRET_KEY = 'your_secret_key_here'; // 在实际生产中应放在环境变量

function encrypt(text) {
	return crypto.AES.encrypt(text, SECRET_KEY).toString();
}

function decrypt(cipherText) {
	const bytes = crypto.AES.decrypt(cipherText, SECRET_KEY);
	return bytes.toString(crypto.enc.Utf8);
}

module.exports = {
	encrypt,
	decrypt,
};
