'use strict';

const _ = require('lodash');
const co = require('co');
const moment = require('moment');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const authorManager = require('ep_etherpad-lite/node/db/AuthorManager');
const updatePadClients = require('ep_etherpad-lite/node/handler/PadMessageHandler').updatePadClients;
const Changeset = require("ep_etherpad-lite/static/js/Changeset");
const AttributePool = require("ep_etherpad-lite/static/js/AttributePool");
const logger = require('ep_etherpad-lite/node_modules/log4js').getLogger('Pads API');
const helpers = require('../common/helpers');
const socketio = require('../common/socketio');
const access = require('../common/access');
const getAllowedOperations = access.getAllowedOperations;
const checkPermissions = access.checkPermissions;
const checkPermissionsMW = access.checkPermissionsMW;
const async = helpers.async;
const responseError = helpers.responseError;
const collectData = helpers.collectData;
const randomString = helpers.randomString;
const promiseWrapper = helpers.promiseWrapper;
const uploadImage = helpers.uploadImage;
const checkAuth = helpers.checkAuth;
const sequelize = require('../models/sequelize');
const User = require('../models/user');
const Pad = require('../models/pad');
const Permission = require('../models/permission');
const Edit = require('../models/edit');
const rootHierarchy = {
	object: {},
	store: {}
};

// Build root hierarchy on application launch
co.wrap(buildRootHierarchy)();

module.exports = api => {
	api.get('/pads', async(function*(request) {
		if (request.query.ids) {
			return yield Pad.scope('complete').findAll({
				where: {
					id: { $in: request.query.ids }
				}
			});
		} else {
			const page = (parseInt(request.query.page, 10) || 1) - 1;
			const perPage = parseInt(request.query.perPage, 10) || 50;
			const where = {};

			if (request.query.query) {
				where.title = { $iLike: `%${request.query.query}%` };
			}

			return yield Pad.findAndCountAll({
				limit: perPage,
				offset: page * perPage,
				where: where,
				order: [['created_at']]
			});
		}
	}));

	api.get('/pads/:id', async(function*(request, response) {
		let pad = yield Pad.scope('complete').findById(request.params.id);

		if (!pad) {
			if (request.params.id === 'root') {
				pad = yield Pad.scope('complete').create({
					id: 'root',
					type: 'root',
					title: 'Wikineering',
					permissions: [{
						role: 'user',
						operation: 'write'
					}]
				}, {
					include: [Permission]
				});
				co.wrap(buildRootHierarchy)();
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
		data.permissions = [{
			role: 'user',
			operation: 'write'
		}];

		yield promiseWrapper(padManager, 'getPad', [data.id]);
		const pad = yield Pad.scope('withPermissions').create(data, {
			include: [Permission]
		});

		return yield pad.reload({
			include: [{
				model: User,
				as: 'owner'
			}]
		});
	}));

	api.put('/pads/:id', checkPermissionsMW('write'), async(function*(request, response) {
		const pad = yield Pad.findById(request.params.id);
		const padTitle = pad.title;

		if (!pad) {
			return responseError(response, 'Pad is not found');
		}
		//
		// if (!request.token.user.isActionAllowed('EDIT_PADS', pad.owner.id)) {
		// 	return responseError(response, 'You do not have permission for this action');
		// }

		yield pad.update(collectData(request, { body: ['title', 'description'] }));

		if (pad.title !== padTitle && rootHierarchy.store[pad.id]) {
			updateRootHierarchy({
				id: pad.id,
				title: pad.title
			});
		}

		return pad;
	}));

	api.delete('/pads/:id', checkPermissionsMW('manage'), async(function*(request, response) {
		const pad = yield Pad.findById(request.params.id);

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

	api.get('/private_hierarchy', checkAuth, async(function*(request) {
		const userId = request.token.user && request.token.user.id;
		const queryResult = yield sequelize.query(`
			SELECT
				id
			FROM (
				SELECT
					pads.id as id,
					array_agg(permissions.role) as roles
				FROM pads
				LEFT OUTER JOIN permissions ON permissions.pad_id = pads.id
				WHERE
					pads.type = 'company'
					AND (
						pads.id IN (
							SELECT
								pad_id
							FROM
								permissions WHERE role='user/${userId}'
						)
						OR
						pads.owner_id = '${userId}'
					)
				GROUP BY pads.id
			) ss
			WHERE
				roles = '{NULL}'
				OR (
					'user' NOT IN(SELECT(UNNEST(roles)))
					AND
					'authorizedUser' NOT IN(SELECT(UNNEST(roles)))
				)
		`);
		const padIds = queryResult[0].map(pad => pad.id);
		const pads = [];

		for (var i = 0; i < padIds.length; i++) {
			pads.push(yield co.wrap(buildHierarchy)(padIds[i], {}))
		}

		return pads;
	}));

	api.post('/pads/images', async(function*(request) {
		request.checkBody('image', 'Image is required').notEmpty();
		request.checkErrors();

		const imagePath = yield uploadImage(request.body.image);

		return { imagePath };
	}));

	api.get('/pads/:id/operations', async(function*(request) {
		return yield getAllowedOperations(request.params.id, null, request.token);
	}));

	api.get('/pads/:id/permissions', async(function*(request) {
		return yield Permission.findAll({
			where: {
				padId: request.params.id
			}
		});
	}));

	api.post('/pads/:id/permissions', checkPermissionsMW('manage'), async(function*(request, response) {
		request.checkBody('permissions', 'Permission is required').notEmpty();
		request.checkErrors();

		const pad = yield Pad.findById(request.params.id);
		const permissions = request.body.permissions;
		const results = [];

		if (!pad) {
			return responseError(response, 'Pad is not found');
		}

		for (let i = 0; i < permissions.length; i++) {
			results.push(yield Permission.create(Object.assign({
				padId: pad.id,
				ownerId: request.token && request.token.user && request.token.user.id
			}, permissions[i])));
		}

		return results;
	}));

	api.put('/pads/:id/permissions', checkPermissionsMW('manage'), async(function*(request) {
		request.checkBody('permissions', 'Permission is required').exists();
		request.checkErrors();

		const userId = request.token && request.token.user && request.token.user.id;
		const { permissions } = request.body;
		const padId = request.params.id;
		const results = yield co.wrap(updatePadPermissions)(request.params.id, permissions, userId);

		// If it's private pad, update all its children with the same permissions
		if (_.isEmpty(_.intersection(permissions.map(permission => permission.role), ['user', 'authorizedUser']))) {
			const hierarchy = yield co.wrap(buildHierarchy)(padId, {});
			const children = [];
			const getAllChildren = function(node) {
				(node.children && node.children.active || []).forEach(node => {
					node.type === 'child' && children.push(node.id);
					node.children && getAllChildren(node);
				});
			};

			getAllChildren(hierarchy);

			for (var i = 0; i < children.length; i++) {
				yield co.wrap(updatePadPermissions)(children[i], permissions, userId);
			}
		}

		return results;
	}));

	function* updatePadPermissions(padId, permissions, ownerId) {
		const pad = yield Pad.scope('withPermissions').findById(padId);
		const results = [];

		if (!pad) {
			throw Error('Pad is not found');
		}

		for (let i = 0; i < permissions.length; i++) {
			results.push(yield Permission.create(Object.assign({
				padId: pad.id,
				ownerId
			}, permissions[i])));
		}

		// Destroy existed permissions
		if (pad.permissions.length) {
			yield Permission.destroy({
				where: {
					id: {
						$in: pad.permissions.map(permission => permission.id)
					}
				}
			});
		}

		return results;
	}

	api.get('/pads/:id/edits', async(function*(request) {
		const padId = request.params.id;
		const edits = yield Edit.findAll({
			where: {
				padId,
				status: request.query.state || 'pending'
			}
		});
		const extendedEdits = [];

		for (var i = 0; i < edits.length; i++) {
			extendedEdits.push(yield co.wrap(extendEdit)(edits[i]));
		}

		return extendedEdits;
	}));

	api.post('/pads/:id/edits', checkAuth, async(function*(request, response) {
		request.checkBody('changes', 'Changes is required').notEmpty();
		request.checkErrors();

		const pad = yield Pad.findById(request.params.id);

		if (!pad) {
			return responseError(response, 'Pad is not found');
		}

		const data = collectData(request, {
			owner: true,
			body: ['message', 'changes']
		}, {
			padId: request.params.id
		});
		const lastDayEdits = yield Edit.scope('').findAll({
			attributes: ['changes'],
			where: {
				createdAt: {
					'$gt': moment().subtract(1, 'days').format()
				},
				ownerId: data.ownerId
			}
		});
		const lastDayEditsNumber = lastDayEdits.reduce((sum, edit) => {
			const changeset = edit.changes && edit.changes.changeset;
			let number = 0;

			if (changeset) {
				const cs = Changeset.unpack(changeset);
				const iter = Changeset.opIterator(cs.ops);

				while(iter.hasNext()) {
					const op = iter.next();

					if (op.opcode === '+' || op.opcode === '-') {
						number += op.chars;
					}
				}
			}

			return sum + number;
		}, 0);

		// Limit daily edits to 20 suggested edits or 100,000 chars changes in total
		if (lastDayEdits.length >= 20 || lastDayEditsNumber >= 100000) {
			return responseError(response, 'You are reached daily limit of suggested edits, try to submit your edits later');
		}

		const edit = yield Edit.create(data);

		yield edit.reload({
			include: [{
				model: User,
				as: 'owner'
			}]
		});

		return yield co.wrap(extendEdit)(edit);
	}));

	api.put('/pads/:id/edits/:editId', checkAuth, async(function*(request, response) {
		const edit = yield Edit.findById(request.params.editId);

		if (!edit) {
			return responseError(response, 'Edit is not found');
		}

		const data = collectData(request, {
			owner: true,
			body: ['message', 'changes']
		});
		const canWrite = yield checkPermissions(request.params.id, 'write', null, request.token);
		const userId = request.token && request.token.user && request.token.user.id;

		if (userId !== edit.ownerId && !canWrite) {
			return responseError(response, 'You don\'t have permissions for this action', 401);
		}

		yield edit.update(data);

		return yield co.wrap(extendEdit)(edit);
	}));

	api.post('/pads/:id/edits/:editId/approve', checkPermissionsMW('write'), async(function*(request, response) {
		request.checkBody('changes', 'Approving changes is required').notEmpty();
		request.checkErrors();

		const edit = yield Edit.findById(request.params.editId);

		if (!edit) {
			return responseError(response, 'Edit is not found');
		}

		const changes = request.body.changes;
		const pad = yield promiseWrapper(padManager, 'getPad', [edit.padId]);
		const wireApool = (new AttributePool()).fromJsonable(changes.apool);
		let changeset = changes.changeset;

		try {
			// Verify that the changeset has valid syntax and is in canonical form
			Changeset.checkRep(changeset);

			// Verify that the attribute indexes used in the changeset are all
			// defined in the accompanying attribute pool.
			Changeset.eachAttribNumber(changeset, function(n) {
				if (!wireApool.getAttrib(n)) {
					throw new Error("Attribute pool is missing attribute " + n + " for changeset " + changeset);
				}
			});

			changeset = Changeset.moveOpsToNewPool(changeset, wireApool, pad.pool);

			const prevText = pad.text();

			if (Changeset.oldLen(changeset) != prevText.length) {
				throw new Error("Can't apply USER_CHANGES " + changeset + " with oldLen " + Changeset.oldLen(changeset) + " to document of length " + prevText.length)
			}

			pad.appendRevision(changeset, changes.author);
		} catch (e) {
			return responseError(response, 'Bad changeset: ' + e);
		}

		// Make sure the pad always ends with an empty line.
		if (pad.text().lastIndexOf('\n') != pad.text().length - 1) {
			pad.appendRevision(Changeset.makeSplice(pad.text(), pad.text().length - 1, 0, '\n'));
		}

		updatePadClients(pad);

		yield Permission.create({
			padId: edit.padId,
			role: `user/${edit.owner.id}`,
			operation: 'write'
		});

		return yield edit.update({
			status: 'approved'
		});
	}));

	api.post('/pads/:id/edits/:editId/reject', checkPermissionsMW('write'), async(function*(request, response) {
		const edit = yield Edit.findById(request.params.editId);

		if (!edit) {
			return responseError(response, 'Edit is not found');
		}

		return yield edit.update({
			status: 'rejected'
		});
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
};

/**
 * Extends suggesting edits data with additional information needed for merge with actual version of pad
 * @param {Object} editModel - Instance of Edit model
 * @return {Object} - Extended data object
 */
function* extendEdit(editModel) {
	const edit = editModel.toJSON();
	const pad = yield promiseWrapper(padManager, 'getPad', [edit.padId]);
	const baseRev = edit.changes.baseRev;
	const baseAtext = baseRev ? yield promiseWrapper(pad, 'getInternalRevisionAText', [baseRev]) : pad.atext.text;

	edit.baseText = baseAtext.text;
	edit.text = Changeset.applyToAText(edit.changes.changeset, baseAtext, pad.apool()).text;
	edit.author = yield promiseWrapper(authorManager, 'getAuthor', [edit.changes.author]);

	return edit;
};

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
	const inactiveLinks = [];

	_.uniqBy(links, 'value').forEach(link => (isExternalLink(link.value) ? externalLinks : internalLinks).push(link));

	Object.keys(pad.pool.attribToNum).forEach(attribute => {
		if (/^link,.+/.test(attribute)) {
			const linkId = attribute.replace(/^link,([^,]*)?(.*)/g, '$1');

			if (!isExternalLink(linkId) && _.findIndex(internalLinks, { value: linkId }) === -1 && _.findIndex(inactiveLinks, { value: linkId }) === -1) {
				inactiveLinks.push({
					value: linkId,
					title: linkId,
					isInactive: true
				});
			}
		}
	});

	return internalLinks.concat(externalLinks, inactiveLinks);
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

	const pad = yield Pad.findById(id);

	if (!pad) {
		return {};
	}

	const padData = yield promiseWrapper(padManager, 'getPad', [pad.id]);
	const result = {
		id: pad.id,
		title: pad.title,
		type: pad.type
	};
	let children = [];

	store[id] = Object.assign({}, result);

	if (depth === undefined || (typeof depth === 'number' && --depth >= 0)) {
		children = getPadLinks(padData);

		if (children.length) {
			result.children = {
				active: [],
				inactive: []
			};

			for (var i = 0; i < children.length; i++) {
				const linkValue = children[i].value;
				const isInactive = !!children[i].isInactive;
				let child;

				if (isExternalLink(linkValue)) {
					child = {
						id: linkValue,
						title: children[i].title,
						type: 'external'
					};
				} else {
					child = yield co.wrap(buildHierarchy)(linkValue, store, isInactive ? 0 : depth);
				}

				if (!_.isEmpty(child)) {
					result.children[isInactive ? 'inactive' : 'active'].push(child);
				}
			}
		}
	}

	rootHierarchy.store[pad.id] = { id, children };

	return result;
}

/**
 * Build and store root hierarchy
 */
function* buildRootHierarchy() {
	const rootPad = yield co.wrap(buildHierarchy)('root', {}, 1);

	logger.debug('ROOT HIERARCHY BUILD');

	if (!_.isEmpty(rootPad)) {
		const children = rootPad.children || {};

		rootPad.children = {
			active: [],
			inactive: []
		};

		if (children.active) {
			for (let i = 0; i < children.active.length; i++) {
				const child = children.active[i];

				if (child.type === 'company') {
					rootPad.children.active.push(yield co.wrap(buildHierarchy)(child.id, {}));
				}
			}
		}

		if (children.inactive) {
			rootPad.children.inactive = children.inactive.filter(child => child.type === 'company');
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

			if (node.children) {
				node.children.active && node.children.active.forEach(step);
				node.children.inactive && node.children.inactive.forEach(step);
			}
		}

		step(rootHierarchy.object);
		socketio.emit('rootPadsHierarchy', rootHierarchy.object);
	}
}