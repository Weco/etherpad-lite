var eejs = require('ep_etherpad-lite/node/eejs');
var _ = require('ep_etherpad-lite/static/js/underscore');

exports.eejsBlock_timesliderEditbarRight = function (hook_name, args, cb) {
	args.content += eejs.require('ep_cristo_restore_revision/templates/editbarButtons.ejs', {pad: args.renderContext.req.params.pad}, module);
	return cb();
};
exports.eejsBlock_timesliderScripts = function (hook_name, args, cb) {
	args.content += eejs.require('ep_cristo_restore_revision/templates/scripts.ejs', {}, module);
	return cb();
};

exports.expressCreateServer = function (hook_name, args, cb) {
	var securityManager = require('ep_etherpad-lite/node/db/SecurityManager');
	var api = require('ep_etherpad-lite/node/db/API');

	args.app.get('/restore/:padId/:rev', function (req, res) {
		var padID = req.params.padId;

		req.params.pad = padID;

		if (padID.indexOf('r.') === 0) {
			return res.send('Permission denied!');
		}

		securityManager.checkPermissions(padID, 'write', req.cookies.token, function(error, isAllowed) {
			if (isAllowed) {
				api.restoreRevision(padID, req.params.rev, function(err, data) {
					if (err) {
						return res.send(err.message);
					}

					res.redirect(307, '/p/'+req.params.padId);
				});
			} else {
				return res.send('Permission denied!');
			}
		});
	});
};

