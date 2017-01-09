import { uniqBy, intersection } from 'lodash';
import moment from 'moment';
import * as JsDiff from 'diff';
import { merge, calcLineCount } from 'diff/lib/patch/merge';
import { builder } from '../../../../../src/static/js/Changeset';
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

export function getUserIdFromRole(role) {
	const regExp = /^user\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

	return regExp.test(role) ? role.replace(regExp, '$1') : '';
}

export function mergedChanges(mine, theirs, base, author) {
	const patch = {
		hunks: merge(mine, theirs, base).hunks.map(hunk => {
			// Resolve conflicts using mine
			if (hunk.conflict) {
				const lines = [];

				hunk.lines.forEach(line => {
					if (typeof line === 'string') {
						lines.push(line);
					} else if (line.conflict) {
						lines.push.apply(lines, line.mine);//.concat(line.theirs.slice(line.mine.length)));
					}
				});

				hunk.lines = lines;
				calcLineCount(hunk);
			}

			hunk.linedelimiters = hunk.lines.map(() => '\n');

			return hunk;
		})
	};
	const mergedText = JsDiff.applyPatch(base, patch)
	const mergedTextDiff = JsDiff.diffChars(theirs, mergedText || mine);
	const changesetBuilder = builder(theirs.length);
	const apool = author ? {
		"nextNum": 1,
		"numToAttrib": {
			"0": ["author", author]
		}
	} : {};
	const attrs = author ? '*0' : '';

	mergedTextDiff.forEach(diff => {
		if (diff.added) {
			changesetBuilder.insert(diff.value, attrs, apool);
		} else if (diff.removed) {
			changesetBuilder.remove(diff.value.length, diff.value.split('\n').length - 1);
		} else {
			changesetBuilder.keepText(diff.value);
		}
	});

	return {
		changeset: changesetBuilder.toString(),
		author,
		apool
	}
}