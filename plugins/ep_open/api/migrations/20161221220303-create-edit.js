'use strict';

module.exports = {
	up: function(queryInterface, Sequelize) {
		return queryInterface.createTable('edits', {
			id: {
				autoIncrement: false,
				primaryKey: true,
				type: Sequelize.UUID
			},
			pad_id: Sequelize.STRING,
			message: Sequelize.TEXT,
			changes: Sequelize.JSONB,
			status: Sequelize.STRING,
			owner_id: Sequelize.UUID,
			created_at: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE
			}
		});
	},

	down: function(queryInterface) {
		return queryInterface.dropTable('edits');
	}
};