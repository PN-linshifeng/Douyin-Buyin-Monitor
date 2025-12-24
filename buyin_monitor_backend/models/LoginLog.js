const {DataTypes} = require('sequelize');
const sequelize = require('../database/connection');

const LoginLog = sequelize.define(
	'LoginLog',
	{
		id: {
			type: DataTypes.BIGINT,
			primaryKey: true,
			autoIncrement: true,
		},
		userId: {
			type: DataTypes.BIGINT,
			allowNull: true, // Could be null if login fails for non-existent user, but we usually log successes
		},
		phone: {
			type: DataTypes.STRING, // Encrypted snapshot
			allowNull: false,
		},
		buyinId: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		fingerprint: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		oldFingerprint: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		ip: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		userAgent: {
			type: DataTypes.TEXT, // UA can be long
			allowNull: true,
		},
		status: {
			type: DataTypes.STRING, // 'SUCCESS', 'FAIL'
			defaultValue: 'SUCCESS',
		},
	},
	{
		timestamps: true,
		indexes: [
			{
				fields: ['userId'],
			},
			{
				fields: ['createdAt'],
			},
		],
	}
);

module.exports = LoginLog;
