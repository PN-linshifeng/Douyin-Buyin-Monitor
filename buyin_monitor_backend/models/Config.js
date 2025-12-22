const {DataTypes} = require('sequelize');
const sequelize = require('../database/connection');

const Config = sequelize.define(
	'Config',
	{
		id: {
			type: DataTypes.BIGINT,
			primaryKey: true,
			autoIncrement: true,
		},
		key: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		value: {
			type: DataTypes.TEXT,
		},
		description: {
			type: DataTypes.STRING,
		},
	},
	{
		timestamps: true,
	}
);

module.exports = Config;
