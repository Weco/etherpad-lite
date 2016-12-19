'use strict';

module.exports = {
	up: function(queryInterface, Sequelize) {
		return queryInterface.createTable('permissions', {
			id: {
				autoIncrement: false,
				primaryKey: true,
				type: Sequelize.UUID
			},
			pad_id: Sequelize.STRING,
			operation: Sequelize.STRING,
			role: Sequelize.STRING,
			owner_id: Sequelize.UUID,
			created_at: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updated_at: {
				allowNull: false,
				type: Sequelize.DATE
			}
		}).then(() => {
			return queryInterface.sequelize.query(`
				INSERT INTO
					permissions (id, pad_id, owner_id, operation, role, created_at, updated_at)
				SELECT
					uuid_in(md5(random()::text || now()::text)::cstring) as id,
					id as pad_id,
					owner_id,
					'write' as operation,
					'user' as role,
					now() as created_at,
					now() as updated_at
				FROM pads
			`);
		});
	},

	down: function(queryInterface) {
		return queryInterface.dropTable('permissions');
	}
};