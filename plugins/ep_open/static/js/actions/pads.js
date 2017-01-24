import window from 'global';
import { uniqBy, intersection, isEqual } from 'lodash';
import request from '../utils/request';
import { getUserIdFromRole } from '../utils/helpers';
import { addError, errorHandler } from './errors';

export function getCurrentPadId(tree) {
	const currentPadId = tree.get('currentPadId');

	if (currentPadId) {
		return currentPadId;
	} else {
		addError(tree, 'Pad is not selected');
		return false;
	}
}

export function fetchPadsByIds(tree, ids) {
	if (ids.length === 1) {
		return request(`/pads/${ids[0]}`)
		.then(pad => {
			tree.set('pads', [pad]);
		})
		.catch(errorHandler(tree));
	} else {
		return request(`/pads`, {
			data: { ids }
		})
		.then(response => {
			tree.set('pads', response);
		})
		.catch(errorHandler(tree));
	}
}

export function setCurrentPad(tree, id = '') {
	tree.set('currentPadId', id);
}

export function getCurrentPad(tree, id = '') {
	tree.set('currentPadId', id);

	if (!tree.get('currentPad').permissions) {
		request(`/pads/${id}`)
			.then(pad => {
				tree.selectedItem('currentPad').set(pad);
			})
			.catch(errorHandler(tree));
	}
}

export function createPad(tree, data = {}) {
	request(`/pads`, {
		method: 'POST',
		data
	})
	.then(pad => {
		tree.set('newPad', pad);
		tree.push('pads', pad);
	})
	.catch(errorHandler(tree));
}

export function updateCurrentPad(tree, data) {
	const currentPadId = getCurrentPadId(tree);

	if (currentPadId) {
		request(`/pads/${currentPadId}`, {
			method: 'PUT',
			data
		})
		.then(pad => tree.selectedItem('currentPad').set(pad))
		.catch(errorHandler(tree));
	}
}

export function updatePad(tree, padId, data) {
	if (padId) {
		request(`/pads/${padId}`, {
			method: 'PUT',
			data
		})
		.then(updatedPad => {
			const privatePadsHierarchy = tree.get('privatePadsHierarchy');

			tree.set('pads', tree.get('pads').map(pad => {
				return pad.id === updatedPad.id ? Object.assign({}, pad, updatedPad) : pad;
			}));

			// Update private hierarchy
			if (data.title && privatePadsHierarchy) {
				tree.set('privatePadsHierarchy', updateHierarchy(privatePadsHierarchy, updatedPad));
			}
		})
		.catch(errorHandler(tree));
	}
}

export function deletePad(tree, id) {
	request(`/pads/${id}`, { method: 'DELETE' })
		.then(() => {
			const pads = tree.select('pads');

			pads.set(pads.get().filter(pad => pad.id !== id));
		})
		.catch(errorHandler(tree));
}


export function clearNewPad(tree) {
	tree.set('newPad', null);
}

export function fetchHierarchy(tree) {
	request('/pads/root/hierarchy')
		.then(hierarchy => tree.set('padsHierarchy', hierarchy))
		.catch(errorHandler(tree));
}

export function fetchPrivateHierarchy(tree) {
	const currentUser = tree.get('currentUser');

	if (currentUser) {
		request('/private_hierarchy')
			.then(hierarchy => tree.set('privatePadsHierarchy', hierarchy))
			.catch(errorHandler(tree));
	} else {
		tree.set('privatePadsHierarchy', null);
	}
}

function updateHierarchy(hierarchy, pad) {
	const step = (nodes) => {
		return nodes.map(node => (Object.assign({}, node, {
			title: node.id === pad.id ? pad.title : node.title,
			children: node.children ? {
				active: step(node.children.active || []),
				inactive: step(node.children.inactive || [])
			} : node.children
		})));
	}

	return step(Array.isArray(hierarchy) ? hierarchy : [hierarchy], pad);
}

export function initPadsHistory(tree) {
	let padsHistory = [];

	try {
		padsHistory = JSON.parse(sessionStorage.padsHistory);
	} catch(e) {}

	tree.set('padsHistory', padsHistory);
}

export function setPadHistory(tree, padsHistory) {
	tree.set('padsHistory', padsHistory);
	window.sessionStorage.setItem('padsHistory', JSON.stringify(padsHistory));
}

export function addPadsHistoryEntry(tree, entry) {
	setPadHistory(tree, uniqBy([entry].concat(tree.get('padsHistory')), 'url'));
}

export function removePadsHistoryEntry(tree, url) {
	setPadHistory(tree, tree.get('padsHistory').filter(entry => entry.url !== url));
}

export function getPermissions(tree, padId) {
	request(`/pads/${padId}/permissions`)
		.then(permissions => updatePadData(tree, padId, { permissions }))
		.catch(errorHandler(tree));
}

export function updatePermissions(tree, padId, permissions, children) {
	request(`/pads/${padId}/permissions`, {
		method: 'PUT',
		data: { permissions }
	})
	.then(permissions => {
		const roles = permissions.map(permission => permission.role);

		// If pad is private, then this update should affect all its children, update their permissions too
		if (roles.indexOf('user') === -1 && roles.indexOf('authorizedUser') === -1 && children) {
			children.forEach(getPermissions.bind(null, tree));
		}

		updatePadData(tree, padId, { permissions });
	})
	.catch(errorHandler(tree));
}

function updatePadData(tree, padId, data) {
	tree.set('pads', tree.get('pads').map(pad => {
		if (pad.id === padId) {
			if (typeof data === 'function') {
				pad = data(Object.assign({}, pad));
			} else {
				pad = Object.assign({}, pad, data);
			}
		}

		return pad;
	}));
}

export function createSuggestedEdits(tree, padId, data) {
	request(`/pads/${padId}/edits`, {
		method: 'POST',
		data
	})
	.then(edit => {
		tree.set('pads', tree.get('pads').map(pad => {
			if (pad.id === padId) {
				pad = Object.assign({}, pad);
				pad.edits = (pad.edits || []).concat(edit);
			}

			return pad;
		}));
	})
	.catch(errorHandler(tree));
}

export function updateSuggestedEdits(tree, padId, editId, data) {
	request(`/pads/${padId}/edits/${editId}`, {
		method: 'PUT',
		data
	})
	.then(edit => updateEdits(tree, padId, edit))
	.catch(errorHandler(tree));
}

export function approveSuggestedEdits(tree, padId, editId, changes) {
	request(`/pads/${padId}/edits/${editId}/approve`, {
		method: 'POST',
		data: { changes }
	})
	.then(edit => updateEdits(tree, padId, edit))
	.catch(errorHandler(tree));
}

export function rejectSuggestedEdits(tree, padId, editId) {
	request(`/pads/${padId}/edits/${editId}/reject`, {
		method: 'POST'
	})
	.then(edit => updateEdits(tree, padId, edit))
	.catch(errorHandler(tree));
}

function updateEdits(tree, padId, updatedEdit) {
	tree.set('pads', tree.get('pads').map(pad => {
		if (pad.id === padId) {
			pad = Object.assign({}, pad);

			pad.edits = (
				pad.edits || []
			)
			.map(edit => edit.id === updatedEdit.id ? updatedEdit : edit)
			.filter(edit => edit.status === 'pending');
		}

		return pad;
	}));
}

export function fetchCurrentPadEdits(tree) {
	const currentPadId = tree.get('currentPadId');

	if (currentPadId) {
		request(`/pads/${currentPadId}/edits/`)
			.then(edits => {
				const currentPad = tree.selectedItem('currentPad');

				currentPad.set(Object.assign({}, currentPad.get(), { edits }));
			})
			.catch(errorHandler(tree));
	}
}

export function fetchPadsAuthorizedUsers(tree) {
	const currentPad = tree.get('currentPad');

	if (currentPad && currentPad.id && currentPad.permissions) {
		const ids = [];
		const userIds = currentPad.authorizedUsers && currentPad.authorizedUsers.map(user => user.id);

		currentPad.permissions.forEach(permission => {
			const userId = getUserIdFromRole(permission.role);

			userId && ids.push(userId);
		});

		if (!ids.length && !isEqual(currentPad.authorizedUsers, [])) {
			return tree.selectedItem('currentPad').set(Object.assign({}, currentPad, { authorizedUsers: [] }));
		} else if (userIds && intersection(userIds, ids).length >= ids.length) {
			return;
		}

		request('/users/', {
			data: { ids }
		})
		.then(response => {
			const currentPad = tree.selectedItem('currentPad');

			currentPad.set(Object.assign({}, currentPad.get(), {
				authorizedUsers: response.rows
			}));
		})
		.catch(errorHandler(tree));
	}
}