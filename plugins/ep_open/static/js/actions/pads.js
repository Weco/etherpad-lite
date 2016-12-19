import window from 'global';
import { uniqBy } from 'lodash';
import request from '../utils/request';
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

export function fetchPads(tree, query) {
	const data = {};

	if (query) {
		data.query = query;
	}

	return request(`/pads`, { data })
		.then(response => {
			tree.set('pads', response.rows);
			tree.set('padsTotal', parseInt(response.count));
		})
		.catch(errorHandler(tree));
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
			tree.set('pads', response.rows);
		})
		.catch(errorHandler(tree));
	}
}

export function setCurrentPad(tree, id = '') {
	tree.set('currentPadId', id);

	const currentPad = tree.get('currentPad');

	if (!currentPad.permissions) {
		request(`/pads/${id}`)
			.then(pad => setTimeout(() => tree.selectedItem('currentPad').set(pad)))
			.catch(errorHandler(tree));
	}
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
			tree.set('pads', tree.get('pads').map(pad => {
				return pad.id === updatedPad.id ? Object.assign({}, pad, updatedPad) : pad;
			}));
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

export function updatePermissions(tree, padId, permissions) {
	request(`/pads/${padId}/permissions`, {
		method: 'PUT',
		data: { permissions }
	})
	.then(permissions => {
		const pads = tree.get('pads');

		tree.set('pads', pads.map(pad => pad.id === padId ? Object.assign({}, pad, { permissions }) : pad));
	})
	.catch(errorHandler(tree));
}