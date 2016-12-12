'use strict';

module.exports = {
	up: function(queryInterface) {
		return queryInterface.sequelize.query(`
			SELECT
				pads.etherpad_id as etherpad_id,
				pads.id as id,
				store.key as key
			FROM
				pads
			LEFT JOIN
				store
			ON
				key LIKE CONCAT('%', etherpad_id, '%')
		`)
		.then(results => {
			const values = (
				results[0]
					.filter(item => item.key && item.etherpad_id && item.id && item.etherpad_id !== item.id)
					.map(item => `('${item.key.replace(item.etherpad_id, item.id)}', '${item.key}')`)
			);

			if (!values.length) {
				return;
			}

			return queryInterface.sequelize.query(`
				UPDATE
					store
				SET
					key = list.new_key
				FROM (
					VALUES ${values.join(',')}
				) AS list(new_key, old_key)
				WHERE key = list.old_key
			`);
		})
		.then(() => queryInterface.removeColumn('pads', 'etherpad_id'));
	},

	down: function(queryInterface, Sequelize) {
		return queryInterface.addColumn('pads', 'etherpad_id', Sequelize.STRING)
			.then(() => queryInterface.sequelize.query('UPDATE pads SET etherpad_id = id'));
	}
};