const redis = require('redis');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const client = redis.createClient(settings.redisSettings.port, settings.redisSettings.host);

exports.client = client;

client.on('error', function (err) {
	console.error('REDIS ERROR: ' + err);
});

exports.get = function(key) {
	return new Promise((resolve, reject) => {
		client.get(key, function(error, value) {
			if (error) {
				return reject(error);
			}

			if (value) {
				try {
					return resolve(JSON.parse(value));
				} catch (e) {}

				const numberValue = Number(value);

				if (!Number.isNaN(numberValue)) {
					return resolve(numberValue);
				}
			}

			resolve(value);
		});
	});
};

exports.set = function(key, value, ttl) {
	const args = [key, typeof value === 'object' ? JSON.stringify(value) : value];

	if (ttl) {
		args.push('EX', ttl);
	}

	client.set(args);
};