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

const checkedIPs = [];
const blacklistedIPs = [];

exports.expressCreateServer = function(hookName, args) {
	const { app } = args;

	// Check IP address in blacklist of spammers
	app.use(function(request, response, next) {
		const ip = (
			request.ip ||
			request.connection.remoteAddress ||
			request.socket.remoteAddress ||
			request.connection.socket.remoteAddress
		);

		if (blacklistedIPs.indexOf(ip) !== -1) {
			return response.status(403).send('Access denied! Your IP address is on the blacklist of suspicious and malicious IPs.');
		}

		if (checkedIPs.indexOf(ip) === -1) {
			checkedIPs.push(ip);
			honeypot.query(ip, function(error, response) {
				if (response) {
					blacklistedIPs.push(ip);
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