import { uniqBy, intersection } from 'lodash';
import moment from 'moment';
import tree from '../store';

export function niceDate(date) {
	return moment(date).calendar(null, {
		sameDay: '[today] [at] hh:mm a',
		nextDay: '[tomorrow] [at] hh:mm a',
		nextWeek: 'dddd [at] hh:mm a',
		lastDay: '[yesterday] [at] hh:mm a',
		lastWeek: '[last] dddd [at] hh:mm a',
		sameElse: 'MMMM D, YYYY [at] hh:mm a'
	}).toLowerCase();
}

export function getAllowedOperations(pad) {
	const user = tree.get('currentUser');
	const currentUserRoles = ['user'];
	const permissions = formatPermissions(pad.permissions);
	const operations = ['manage', 'write', 'read'];
	const ownerId = pad.owner ? pad.owner.id : pad.ownerId;
	let allowedOperations = [];

	if (user) {
		currentUserRoles.push('authorizedUser');
		currentUserRoles.push(`user/${user.id}`);

		if (user.id === ownerId) {
			return operations.reverse();
		}
	}

	for (var i = 0; i < operations.length; i++) {
		const roles = permissions[operations[i]];

		if (roles && intersection(roles, currentUserRoles).length !== 0) {
			allowedOperations = operations.slice(i).reverse();
			break;
		}
	}

	return allowedOperations;
}

export function formatPermissions(permissions) {
	const operations = ['manage', 'write', 'read'];
	const formattedPermissions = {
		read: [],
		write: [],
		manage: []
	};

	permissions && permissions.forEach(permission => {
		const roles = formattedPermissions[permission.operation];

		if (roles && roles.push) {
			roles.push(permission.role);
		}
	});

	let topOperationRoles = [];

	operations.forEach(operation => {
		const roles = uniqBy(formattedPermissions[operation].concat(topOperationRoles)).sort((a, b) => {
			const rolesPriorities = ['authorizedUser', 'user'];

			return rolesPriorities.indexOf(a) <= rolesPriorities.indexOf(b);
		});

		formattedPermissions[operation] = topOperationRoles = roles;
	});

	return formattedPermissions;
}

export function isOperationAllowed(operation, pad) {
	return getAllowedOperations(pad || tree.get('currentPad')).indexOf(operation) !== -1;
}