const co = require('co');
const _ = require('lodash');
const Pad = require('../models/pad');
const Token = require('../models/token');
const responseError = require('./helpers').responseError;
const logger = require('ep_etherpad-lite/node_modules/log4js').getLogger('ACL');

/**
 * Check whether user has permissions for specified opetation in pad
 * @param {String} padId - Pad id
 * @param {String} operation - Operation to check (read, write, manage)
 * @param {String} etherpadToken - Etherpad token
 * @param {Object} token - User's token object
 * @return {Boolean} - Flag with result of check
 */
module.exports.checkPermissions = co.wrap(function* (padId, operation, etherpadToken, token) {
	const allowedOperations = yield module.exports.getAllowedOperations(padId, etherpadToken, token);
	const isAllowed = allowedOperations.indexOf(operation) !== -1;

	logger.info('CHECK PERMISSIONS', isAllowed, padId, operation, etherpadToken, token);

	return isAllowed;
});

/**
 * Returns middleware function that check whether user has permissions for specified opetation in pad
 * @param {String} operation - Operation to check (read, write, manage)
 * @param {String} [padIdPath=params.id] - Path for padId in request
 * @return {Function} - Middleware function
 */
exports.checkPermissionsMW = (operation, padIdPath = 'params.id') => {
	return function(request, response, next) {
		const padId = padIdPath.split('.').reduce((obj, path) => obj[path], request);

		if (padId) {
			module.exports.checkPermissions(padId, operation, null, request.token).then(isAllowed => {
				if (isAllowed) {
					next();
				} else {
					responseError(response, 'You don\'t have permissions for this action', 401);
				}
			})
		} else {
			responseError(response, 'Pad id is not found');
		}
	};
};

/**
 * Check whether user has permissions for specified opetation in pad
 * @param {String} padId - Pad id
 * @param {String} operation - Operation to check (read, write, manage)
 * @param {String} etherpadToken - Etherpad token
 * @param {Object} token - User's token object
 * @return {Boolean} - Flag with result of check
 */
module.exports.getAllowedOperations = co.wrap(function* (padId, etherpadToken, token) {
	const pad = yield Pad.scope('withPermissions').findById(padId);
	const currentUserRoles = ['user'];
	const permissions = {
		read: [],
		write: [],
		manage: []
	};
	const operations = ['manage', 'write', 'read'];
	let allowedOperations = [];

	if (!token && etherpadToken) {
		token = yield Token.find({ where: { etherpadToken } });

		if (token && !token.isActive()) {
			Token.destroy({ where: { id: token.id }});
			token = null;
		}
	}

	if (token) {
		const userId = token.user ? token.user.id : token.userId;
		const ownerId = pad.owner ? pad.owner.id : pad.ownerId;

		currentUserRoles.push('authorizedUser');
		userId && currentUserRoles.push(`user/${userId}`);

		if (userId === ownerId) {
			return operations.reverse();
		}
	}

	pad.permissions.forEach(permission => {
		const allowedRoles = permissions[permission.operation];

		if (allowedRoles && allowedRoles.push) {
			allowedRoles.push(permission.role);
		}
	});

	for (var i = 0; i < operations.length; i++) {
		const roles = permissions[operations[i]];

		if (roles && _.intersection(roles, currentUserRoles).length !== 0) {
			allowedOperations = operations.slice(i).reverse();
			break;
		}
	}

	return allowedOperations;
});