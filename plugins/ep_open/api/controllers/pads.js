'use strict';

const _ = require('lodash');
const co = require('co');
const md5 = require('md5');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const Changeset = require("ep_etherpad-lite/static/js/Changeset");
const logger = require('ep_etherpad-lite/node_modules/log4js').getLogger('Pads API');
const helpers = require('../common/helpers');
const socketio = require('../common/socketio');
const async = helpers.async;
const responseError = helpers.responseError;
const collectData = helpers.collectData;
const randomString = helpers.randomString;
const promiseWrapper = helpers.promiseWrapper;
const User = require('../models/user');
const Pad = require('../models/pad');
const rootHierarchy = {
	object: {},
	store: {}
};

// Build root hierarchy on application launch
co.wrap(buildRootHierarchy)();

module.exports = api => {
	api.get('/pads', async(function*(request) {
		const page = (parseInt(request.query.page, 10) || 1) - 1;
		const perPage = parseInt(request.query.perPage, 10) || 50;
		const where = {};

		if (request.query.query) {
			where.title = { $iLike: `%${request.query.query}%` };
		} else if (request.query.ids) {
			where.id = { $in: request.query.ids.split(',') };
		}

		return yield Pad.findAndCountAll({
			limit: perPage,
			offset: page * perPage,
			where: where,
			order: [['created_at']]
		});
	}));

	api.get('/pads/:id', async(function*(request, response) {
		let pad = yield Pad.scope('full').findById(request.params.id);

		if (!pad) {
			if (request.params.id === 'root') {
				pad = yield Pad.scope('full').create({
					id: 'root',
					type: 'root',
					etherpadId: 'root',
					title: 'Open companies'
				});
			} else {
				return responseError(response, 'Pad is not found');
			}
		}

		const views = (pad.views || 0) + 1;

		pad.views = views;
		pad.update({ views });

		return pad;
	}));

	api.post('/pads', async(function*(request) {
		request.checkBody('title', 'Title is required').notEmpty();
		request.checkErrors();

		const id = randomString(10);
		const data = collectData(request, {
			owner: true,
			body: ['title', 'description', 'type']
		});

		if (data.type && !/^company|child$/.test(data.type)) {
			delete data.type;
		}

		data.id = id;
		data.etherpadId = md5(id);

		yield promiseWrapper(padManager, 'getPad', [data.etherpadId]);
		const pad = yield Pad.scope('full').create(data);

		return yield pad.reload({
			include: [{
				model: User,
				as: 'owner'
			}]
		});
	}));

	api.put('/pads/:id', async(function*(request, response) {
		const pad = yield Pad.scope('full').findById(request.params.id);
		const padTitle = pad.title;

		if (!pad) {
			return responseError(response, 'Pad is not found');
		}
		//
		// if (!request.token.user.isActionAllowed('EDIT_PADS', pad.owner.id)) {
		// 	return responseError(response, 'You do not have permission for this action');
		// }

		yield pad.update(collectData(request, { body: ['title', 'description'] }));

		if (pad.title !== padTitle && rootHierarchy.store[pad.etherpadId]) {
			updateRootHierarchy({
				id: pad.id,
				title: pad.title
			});
		}

		return pad;
	}));

	api.delete('/pads/:id', async(function*(request, response) {
		const pad = yield Pad.scope('full').findById(request.params.id);

		if (!pad) {
			return responseError(response, 'Pad is not found');
		}
		//
		// if (!request.token.user.isActionAllowed('DELETE_PADS', pad.owner.id)) {
		// 	return responseError(response, 'You do not have permission for this action');
		// }

		return yield pad.destroy();
	}));

	api.get('/pads/:id/hierarchy', async(function*(request) {
		const id = request.params.id;

		if (id === 'root') {
			return rootHierarchy.object;
		} else {
			return yield co.wrap(buildHierarchy)(id, {});
		}
	}));
};

module.exports.padUpdate = function(hookName, args) {
	const { pad } = args;
	const storedPad = rootHierarchy.store[pad.id];

	if (storedPad) {
		const children = getPadLinks(pad);

		if (!_.isEqual(storedPad.children, children)) {
			logger.debug('PAD LINKS CHANGE', storedPad.children, '=>', children);
			co.wrap(buildRootHierarchy)();
		}
	}
}

/**
 * Check whether passed value of link is external link
 * @param {String} linkValue - Value of link
 * @return {Boolean} - Boolean flag
 */
function isExternalLink(linkValue) {
	return /^(f|ht)tps?:\/\//i.test(linkValue);
}

/**
 * Return list of pad's children
 * @param {Object} pad - Etherpad's pad instance
 * @return {Array} - List of children ids
 */
function getPadLinks(pad) {
	const links = [];
	const textLines = pad.atext.text.slice(0, -1).split('\n');
	const attribLines = Changeset.splitAttributionLines(pad.atext.attribs, pad.atext.text);

	attribLines.forEach((attrs, index) => {
		const text = textLines[index];
		const apool = pad.apool();

		if (attrs) {
			const opIter = Changeset.opIterator(attrs);
			let length = 0;
			let currentLinkValue;

			while (opIter.hasNext()) {
				const op = opIter.next();
				const linkValue = Changeset.opAttributeValue(op, 'link', apool);

				if (linkValue) {
					var linkTitle = text.substr(length, op.chars);

					if (currentLinkValue === linkValue) {
						links[links.length - 1].title += linkTitle;
					} else {
						links.push({
							value: linkValue,
							title: linkTitle
						});
					}

					currentLinkValue = linkValue;
				}

				length += op.chars;
			}
		}
	});

	const internalLinks = [];
	const externalLinks = [];

	_.uniqBy(links, 'value').forEach(link => (isExternalLink(link.value) ? externalLinks : internalLinks).push(link));

	return internalLinks.concat(externalLinks);
}

/**
 * Build hierarchy for passed pad
 * @param {String} id - Pad id
 * @param {Object} store - Store object, needed to prevent pad repeats
 * @param {Number} [depth=Infinity] - Depth of hierarchy
 * @return {Object} - Pad hierarchy
 */
function* buildHierarchy(id, store, depth) {
	if (store[id]) {
		return store[id];
	}

	const pad = yield Pad.scope('full').findById(id);

	if (!pad) {
		return {};
	}

	const padData = yield promiseWrapper(padManager, 'getPad', [pad.etherpadId]);
	const result = {
		id: pad.id,
		title: pad.title,
		type: pad.type,
	};
	let children = [];

	store[id] = Object.assign({}, result);

	if (depth === undefined || (typeof depth === 'number' && --depth >= 0)) {
		children = getPadLinks(padData);

		if (children.length) {
			result.children = [];

			for (var i = 0; i < children.length; i++) {
				const linkValue = children[i].value;
				let child;

				if (isExternalLink(linkValue)) {
					child = {
						id: linkValue,
						title: children[i].title,
						type: 'external'
					};
				} else {
					child = yield co.wrap(buildHierarchy)(linkValue, store, depth);
				}

				if (!_.isEmpty(child)) {
					result.children.push(child);
				}
			}
		}
	}

	rootHierarchy.store[pad.etherpadId] = { id, children };

	return result;
}

/**
 * Build and store root hierarchy
 */
function* buildRootHierarchy() {
	const rootPad = yield co.wrap(buildHierarchy)('root', {}, 1);

	logger.debug('ROOT HIERARCHY BUILD');

	if (!_.isEmpty(rootPad)) {
		const children = rootPad.children;

		rootPad.children = [];

		if (children) {
			for (var i = 0; i < children.length; i++) {
				const child = children[i];

				if (child.type === 'company') {
					rootPad.children.push(yield co.wrap(buildHierarchy)(child.id, {}));
				}
			}
		}
	}

	rootHierarchy.object = rootPad;
	socketio.emit('rootPadsHierarchy', rootPad);
}

/**
 * Update node in root hierarchy
 * @param {Object} updatedNode - Object with updated node
 */
function updateRootHierarchy(updatedNode) {
	if (!_.isEmpty(rootHierarchy.object)) {
		const step = node => {
			if (node.id === updatedNode.id) {
				console.log('UPDATE_NODE', node, updatedNode);
				Object.assign(node, updatedNode);
			}

			node.children && node.children.forEach(step);
		}

		step(rootHierarchy.object);
		socketio.emit('rootPadsHierarchy', rootHierarchy.object);
	}
}