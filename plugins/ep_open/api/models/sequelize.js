'use strict';

const _ = require('lodash');
const Sequelize = require('sequelize');
const CircularJSON = require('circular-json');
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
	return new Promise((resolve, reject) => {
		const scope = {};
		const formatScope = (target, source, depth) => {
			depth--;

			Object.keys(source).forEach(key => {
				const value = source[key];

				if (typeof value === 'object') {
					if (value instanceof sequelize.Model) {
						target[key] = value.name;
					} else {
						const isArray = Array.isArray(value);

						target[key] = isArray ? [] : {};

						if (depth > 0) {
							formatScope(target[key], value, depth);
						}
					}
				} else {
					target[key] = value;
				}
			});
		};

		formatScope(scope, this.$scope, 3);

		const key = `${this.name}__${CircularJSON.stringify(options)}__${CircularJSON.stringify(scope)}`;

		redis.get(key).then(value => {
			if (value === null) {
				console.log('NEW_REQUEST', key);

				findAll.apply(this, arguments)
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
				console.log('CACHED_REQUEST', key);
				this.$injectScope(options);
				resolve(_.isArray(value) ? value.map(object => this.build(object, options)) : this.build(value, options));
			}
		}).catch(error => console.error('ERROR', error));
	});
}

module.exports = sequelize;