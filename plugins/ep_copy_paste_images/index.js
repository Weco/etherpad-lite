var eejs = require("ep_etherpad-lite/node/eejs");

exports.eejsBlock_styles = function (hookName, args, cb) {
  args.content = args.content + "<link href='../static/plugins/ep_copy_paste_images/static/css/ace.css' rel='stylesheet'>";
  return cb();
}

exports.eejsBlock_timesliderStyles = function(hookName, args, cb){
  args.content = args.content + "<link href='../../static/plugins/ep_copy_paste_images/static/css/ace.css' rel='stylesheet'>";
  return cb();
}


exports.eejsBlock_body = function (hookName, args, cb) {
	args.content = args.content + eejs.require("ep_copy_paste_images/static/templates/modals.ejs", {}, module);

	return cb();
}