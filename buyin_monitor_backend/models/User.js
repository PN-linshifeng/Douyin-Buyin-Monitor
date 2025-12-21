const {DataTypes} = require('sequelize');
const sequelize = require('../database/connection');

const User = sequelize.define(
	'User',
	{
		id: {
			type: DataTypes.BIGINT, // Use BIGINT to accommodate Date.now() style IDs if we keep them, or just standard auto-increment
			primaryKey: true,
			autoIncrement: true,
		},
		phone: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		buyinId: {
			type: DataTypes.STRING,
		},
		fingerprint: {
			type: DataTypes.STRING,
		},
		expirationTime: {
			type: DataTypes.STRING, // Keeping as string to match existing logic, or can convert to DATE.
			// Existing logic uses new Date(user.expirationTime), so string is fine if ISO formatted.
		},
	},
	{
		timestamps: true, // Adds createdAt and updatedAt automatically
	}
);

module.exports = User;
