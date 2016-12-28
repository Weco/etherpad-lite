'use strict';

module.exports = {
	up: function(queryInterface, Sequelize) {
		return queryInterface.addColumn(
			'users', 'author_id', Sequelize.STRING
		)
		.then(() => queryInterface.sequelize.query(`
			UPDATE users
			SET
				author_id=sub.author
			FROM (
				SELECT
					DISTINCT ON (tokens.etherpad_token)
					tokens.user_id as user,
					trim(both '"' from store.value) as author
				FROM tokens
				LEFT JOIN store
					ON store.key ~~ ('%token2author:' || tokens.etherpad_token || '%')
				WHERE tokens.etherpad_token IS NOT NULL
			) AS sub
			WHERE users.id=sub.user
		`));
	},

	down: function(queryInterface) {
		return queryInterface.removeColumn('users', 'author_id');
	}
};