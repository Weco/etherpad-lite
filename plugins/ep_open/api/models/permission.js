'use strict';

const Sequelize = require('sequelize');
const ModelBase = require('./base');

const Permission = ModelBase('permission', {
	id: {
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: Sequelize.UUIDV4
	},
	padId: Sequelize.STRING,
	operation: {
		type: Sequelize.STRING,
		validate: {
			isIn: {
				args: [['read', 'write', 'manage']],
				msg: 'Operation must be read, write or manage'
			}
		}
	},
	role: {
		type: Sequelize.STRING,
		validate: {
			is: {
				args: /^(user|authorizedUser|user\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/,
				msg: 'Role must be user, authorizedUser or user/{user_id}'
			}
		}
	},
	ownerId: Sequelize.UUID
}, {
	defaultScope: {
		attributes: ['id', 'operation', 'role']
	}
});

module.exports = Permission;