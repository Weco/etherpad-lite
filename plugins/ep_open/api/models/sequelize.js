'use strict';

const _ = require('lodash');
const Sequelize = require('sequelize');
const CircularJSON = require('circular-json');
const logger = require('ep_etherpad-lite/node_modules/log4js').getLogger('API');
const redis = require('../common/redis');
const config = require(__dirname + '/../../../../credentials.json');
const dbConfig = {
	'username': config.dbSettings.user,
	'password': config.dbSettings.password,
	'database': config.dbSettings.database,
	'host': config.dbSettings.host,
	'port': '5432',
	"dialect": config.dbType
};
const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

const findAll = sequelize.Model.prototype.findAll;

// Add 5 seconds cache in redis to findAll method
sequelize.Model.prototype.findAll = function(options) {
	return new sequelize.Promise((resolve, reject) => {
		const jsonReplacer = function(key, value) {
			if (value && (value.DAO || value.sequelize)) {
				return value.name || '';
			}

			return value;
		};
		const key = `${this.name}__${CircularJSON.stringify(options, jsonReplacer)}__${CircularJSON.stringify(this.$scope, jsonReplacer)}`;

		redis.get(key).then(value => {
			if (value === null) {
				logger.info('New request: ', key);

				findAll.call(this, options)
					.then(result => {
						const isArray = _.isArray(result);

						resolve(result);

						result = (isArray ? result : [result]).map(model => model.toJSON ? model.toJSON() : model)

						if (!isArray) {
							result = result[0];
						}

						// Store a fetched value for 5 seconds
						redis.set(key, result, 5);
					})
					.catch(reject);
			} else {
				logger.info('Cached request: ', key);
				this.$injectScope(options);
				resolve(_.isArray(value) ? value.map(object => this.build(object, options)) : this.build(value, options));
			}
		}).catch(error => console.error('ERROR', error));
	});
}

module.exports = sequelize;