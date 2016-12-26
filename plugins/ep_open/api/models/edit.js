'use strict';

const Sequelize = require('sequelize');
const ModelBase = require('./base');
const User = require('./user');

const Edit = ModelBase('edit', {
	id: {
		primaryKey: true,
		type: Sequelize.UUID,
		defaultValue: Sequelize.UUIDV4
	},
	padId: Sequelize.STRING,
	message: Sequelize.TEXT,
	changes: Sequelize.JSONB,
	status: {
		type: Sequelize.STRING,
		defaultValue: 'pending',
		validate: {
			isIn: {
				args: [['pending', 'approved', 'rejected']],
				msg: 'Status must be pending, approved or rejected'
			}
		}
	},
	ownerId: Sequelize.UUID
}, {
	defaultScope: {
		attributes: {
			exclude: ['ownerId']
		},
		include: [{
			model: User,
			as: 'owner'
		}]
	}
});

User.hasMany(Edit, { foreignKey: 'ownerId', as: 'owner' });
Edit.belongsTo(User, { foreignKey: 'ownerId', as: 'owner' });

module.exports = Edit;