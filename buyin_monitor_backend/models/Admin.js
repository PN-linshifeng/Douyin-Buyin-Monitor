const {DataTypes} = require('sequelize');
const sequelize = require('../database/connection');

const Admin = sequelize.define(
	'Admin',
	{
		username: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	},
	{
		timestamps: true,
	}
);

module.exports = Admin;
