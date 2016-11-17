const fs = require('fs');
const path = require('path');
const npm = require("../src/node_modules/npm");
const co = require('../plugins/ep_open/node_modules/co');
const helpers = require('../plugins/ep_open/api/common/helpers');
const wrap = helpers.promiseWrapper;
const uploadImage = helpers.uploadImage;

co.wrap(function* () {
	yield wrap(npm, 'load');
	yield wrap(require('../src/node/db/DB'), 'init');

	require('../src/node/db/DB').db.db.settings = {cache: 0, writeInterval: 0, json: true};
	const PadManager = require('../src/node/db/PadManager');

	const { padIDs } = yield wrap(PadManager, 'listAllPads');

	for (let i = 0; i < padIDs.length; i++) {
		const pad = yield wrap(PadManager, 'getPad', [padIDs[i]]);
		const changes = [];

		for (let num in pad.pool.numToAttrib) {
			const attribute = pad.pool.numToAttrib[num];

			if (attribute[0] === 'img') {
				const source = attribute[1].replace(/<img(?:.*)src=(?:"?)([^"\s>]*)(?:"?)(?:.*)>/, '$1');

				if (/data\:([^;]*);base64,(.*)/.test(source)) {
					const imagePath = yield co.wrap(uploadImage)(source);
					const image = `<img src="${imagePath}">`;

					delete pad.pool.attribToNum[attribute.join(',')];
					pad.pool.attribToNum[`img,${image}`] = parseInt(num);
					pad.pool.numToAttrib[num] = ['img', image];

					changes.push(imagePath);
				}
			}
		}

		if (changes.length) {
			pad.saveToDatabase();
			console.log(pad.id, '\n', changes.join('\n'), '\n', pad.pool);
		}
	}

	return 'Done';
})()
.then(data => {
	data && console.info(data);
	process.exit(0);
})
.catch(error => {
	error && console.error(error);
	process.exit(1);
});