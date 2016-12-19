'use strict';

module.exports = {
	up: function(queryInterface, Sequelize) {
		return queryInterface.addColumn('tokens', 'etherpad_token', Sequelize.STRING);
	},

	down: function(queryInterface) {
		return queryInterface.removeColumn('tokens', 'etherpad_token');
	}
};