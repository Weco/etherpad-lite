'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const validator = require('express-validator');
const api = require('./api');
const socketio = require('./api/common/socketio');
const cookieParser = require('ep_etherpad-lite/node_modules/cookie-parser');
const settings = require('ep_etherpad-lite/node/utils/Settings');
const Honeypot = require('honeypot');
const honeypot = new Honeypot('ycvyvsukawvu');
const logger = require('ep_etherpad-lite/node_modules/log4js').getLogger('API');
const RateLimit = require('express-rate-limit');

const checkedIPs = {};
const blacklistedIPs = {};

exports.expressCreateServer = function(hookName, args) {
	const { app } = args;

	app.use(new RateLimit({
		windowMs: 10 * 60 * 1000, // 10 minutes
		max: 10000, // limit each IP to 10000 requests per windowMs
		delayMs: 0, // disable delaying - full speed until the max limit is reached
		message: "Too many requests from this IP, please try again after 10 minutes"
	}));
	// Check IP address in blacklist of spammers
	app.use(function(request, response, next) {
		const ip = (
			request.headers['x-forwarded-for'] ||
			request.ip ||
			request.connection.remoteAddress ||
			request.socket.remoteAddress
		);
		const ts = new Date().getTime();
		const expiratedTs = ts - 24 * 60 * 60 * 1000; // Check expiration is 24 hours

		if (blacklistedIPs[ip] && blacklistedIPs[ip] > expiratedTs) {
			return response.status(403).send('Access denied! Your IP address is on the blacklist of suspicious and malicious IPs.');
		} else {
			delete blacklistedIPs[ip];
		}

		if (!checkedIPs[ip] || checkedIPs[ip] < expiratedTs) {
			checkedIPs[ip] = ts;
			honeypot.query(ip, function(error, response) {
				const type = response ? response[0].split('.')[3] : 0;

				// If type of user is harvester or comment spammer, then block it
				if (type > 1) {
					blacklistedIPs[ip] = ts;
					logger.warn('Blacklist check | blocked IP: ' + ip, honeypot.getFormattedResponse());
				} else {
					logger.info('Blacklist check | allowed IP: ' + ip);
				}
			});
		}

		next();
	});
	app.use(helmet());
	app.use(bodyParser.json({ limit: '50mb' }));
	app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
	app.use(validator());
	app.use(cookieParser(settings.sessionKey, {}));
	app.use(express.static(__dirname + '/static'));

	app.use('/api', api);
	app.get('/', indexPageHandler);

	socketio.init(args.server);

	// Add handler for all other client-side pages with timeout, to be sure that etherpad middlewares are applied and
	// none of them will be overridden
	setTimeout(() => app.use(indexPageHandler));

	function indexPageHandler(request, response) {
		response.send(fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf-8'));
	}
};