const sequelize = require('./database/connection');
const User = require('./models/User');
const Admin = require('./models/Admin');
const RenewalLog = require('./models/RenewalLog');
const fs = require('fs');
const path = require('path');

const USER_FILE = path.join(__dirname, 'user.json');
const ADMIN_FILE = path.join(__dirname, 'admin.json');

async function initDB() {
	try {
		await sequelize.sync({force: false});
		console.log('Database synced.');

		// Check if data exists
		const userCount = await User.count();
		if (userCount === 0 && fs.existsSync(USER_FILE)) {
			const users = JSON.parse(fs.readFileSync(USER_FILE, 'utf8'));
			for (const u of users) {
				try {
					await User.create({
						id: u.id,
						phone: u.phone,
						buyinId: u.buyinId,
						fingerprint: u.fingerprint,
						expirationTime: u.expirationTime,
						createdAt: u.createTime ? new Date(u.createTime) : new Date(),
						updatedAt: u.updateTime ? new Date(u.updateTime) : new Date(),
					});
				} catch (e) {
					console.error(`Failed to migrate user ${u.id}:`, e);
				}
			}
			console.log('Users migrated.');
		}

		const adminCount = await Admin.count();
		if (adminCount === 0 && fs.existsSync(ADMIN_FILE)) {
			const admins = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
			for (const a of admins) {
				await Admin.create({
					username: a.username,
					password: a.password,
				});
			}
			console.log('Admins migrated.');
		}
	} catch (error) {
		console.error('DB Init Error:', error);
	}
}

module.exports = initDB;
