'use strict';

const Sequelize = require('sequelize');
const ModelBase = require('./base');
const User = require('./user');
const Permission = require('./permission');
const randomString = require('../common/helpers').randomString;

const Pad = ModelBase('pad', {
	id: {
		primaryKey: true,
		type: Sequelize.STRING
	},
	type: {
		type: Sequelize.STRING,
		defaultValue: 'child'
	},
	title: Sequelize.STRING,
	description: Sequelize.TEXT,
	views: Sequelize.INTEGER,
	ownerId: Sequelize.UUID
}, {
	scopes: {
		full: {
			attributes: {
				exclude: ['ownerId']
			},
			include: [{
				model: User,
				as: 'owner'
			}],
			order: [['createdAt']]
		},
		withPermissions: {
			attributes: {
				exclude: ['ownerId']
			},
			include: [{
				model: Permission,
				as: 'permissions'
			}, {
				model: User,
				as: 'owner'
			}]
		}
	}
});

User.hasMany(Pad, { foreignKey: 'ownerId', as: 'owner' });
Pad.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

Pad.hasMany(Permission, { foreignKey: 'padId' });
Permission.belongsTo(Pad, { foreignKey: 'padId' });

module.exports = Pad;