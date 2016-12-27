'use strict';

module.exports = {
	up: function(queryInterface) {
		return queryInterface.sequelize.query(`
				UPDATE users
				SET
					name=sub.nickname
				FROM (
					SELECT id, nickname
					FROM users
					WHERE name IS NULL
				) AS sub
				WHERE users.id=sub.id
		`)
		.then(() => queryInterface.removeColumn('users', 'nickname'));
	},

	down: function(queryInterface, Sequelize) {
		return queryInterface.addColumn('users', 'nickname', {
			type: Sequelize.STRING,
			unique: true
		})
		.then(() => queryInterface.sequelize.query(`
				UPDATE users
				SET
					nickname=sub.email
				FROM (
					SELECT id, email
					FROM users
				) AS sub
				WHERE users.id=sub.id
		`));
	}
};