const {DataTypes} = require('sequelize');
const sequelize = require('../database/connection');

const RenewalLog = sequelize.define(
	'RenewalLog',
	{
		id: {
			type: DataTypes.BIGINT,
			primaryKey: true,
			autoIncrement: true,
		},
		adminUsername: {
			type: DataTypes.STRING,
			allowNull: true, // In case admin is deleted or system action, though usually required
		},
		targetUserId: {
			type: DataTypes.BIGINT,
			allowNull: false,
		},
		targetPhone: {
			type: DataTypes.STRING, // Encrypted phone snapshot
			allowNull: false,
		},
		targetBuyinId: {
			type: DataTypes.STRING, // Snapshot
			allowNull: true,
		},
		oldExpirationTime: {
			type: DataTypes.STRING, // Store as string to match User model style
			allowNull: true,
		},
		newExpirationTime: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	},
	{
		timestamps: true, // Adds createdAt and updatedAt automatically
	}
);

module.exports = RenewalLog;
