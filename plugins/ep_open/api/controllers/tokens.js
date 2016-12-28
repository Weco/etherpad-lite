'use strict';

const co = require('co');
const moment = require('moment');
const helpers = require('../common/helpers');
const authorManager = require('ep_etherpad-lite/node/db/AuthorManager');
const async = helpers.async;
const responseError = helpers.responseError;
const promiseWrapper = helpers.promiseWrapper;
const randomString = helpers.randomString;
const updateAuthorName = require('./users').updateAuthorName;
const User = require('../models/user');
const Token = require('../models/token');

module.exports = api => {
	api.get('/tokens/:id', async(function*(request) {
		return yield Token.findById(request.params.id);
	}));

	api.post('/tokens', async(function*(request, response) {
		request.checkBody('email', 'You should specify email').notEmpty();
		request.checkBody('password', 'You should specify password').notEmpty();
		request.checkErrors();

		const user = yield User.scope('full').find({ where: { email: request.body.email } });

		if (!user || !user.authenticate(request.body.password)) {
			return responseError(response, 'Authentication fails');
		}

		const token = yield createToken(user, request, response);

		return Object.assign(token.toJSON(), { user });
	}));

	api.get('/tokens/:id/prolong', async(function*(request, response) {
		const token = yield Token.findById(request.params.id);

		if (!token) {
			return responseError(response, 'Token is not found');
		}

		token.expires = moment().add(1, 'months');

		return yield token.save();
	}));


	api.delete('/tokens/:id', async(function*(request, response) {
		const token = yield Token.findById(request.params.id);

		if (!token) {
			return responseError(response, 'Token is not found');
		}

		yield token.destroy();
		response.cookie('token', '', { expires: new Date(0) });

		return token;
	}));
};

const createToken = co.wrap(function* (user, request, response) {
	let etherpadToken = request.cookies.token;

	// Check if this user already has etherpad author, then create new etherpad token for this author and use it
	if (user.authorId) {
		etherpadToken = `t.${randomString(20)}`;
		yield promiseWrapper(authorManager, 'setAuthor4Token', [etherpadToken, user.authorId]);
		// Update etherpad token in cookies
		response.cookie('token', etherpadToken, { maxAge: 1000 * 60 * 60 * 24 * 30 });
	} else if (etherpadToken) {
		// If this is no author and there is etherpad token, then get author of this token and use it
		const authorId = yield promiseWrapper(authorManager, 'getAuthor4Token', [etherpadToken]);

		yield user.update({ authorId });
		// Set name of authorized user to etherpad author entity
		updateAuthorName(etherpadToken, user);
	}

	yield Token.destroy({ where: { userId: user.id }})

	return yield Token.create({
		expires: moment().add(1, 'months'),
		userId: user.id,
		etherpadToken
	});
});

module.exports.createToken = createToken;
