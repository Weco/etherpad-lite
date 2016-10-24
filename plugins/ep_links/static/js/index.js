var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var _ = require('ep_etherpad-lite/static/js/underscore');
var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
var tags = ['padlink'];

exports.postToolbarInit = function(hook, context, cb) {
	context.toolbar.registerDropdownCommand('linksModal:open', 'links_modal');
	return cb();
};

exports.aceAttribsToClasses = function(hook, context) {
  if (context.key == 'padlink') {
    return ['padlink:' + context.value];
  }
}

exports.aceRegisterBlockElements = function() {
  return tags;
}

exports.aceAttribClasses = function(hook, attr) {
  $.each(tags, function(key, value) {
    attr[value] = 'tag:' + value;
  });

  return attr;
}

exports.aceEditorCSS = function(hook, cb) {
  return ['/ep_links/static/css/iframe.css'];
}

function doInsertPadlink(padName) {
  var rep = this.rep;
  var documentAttributeManager = this.documentAttributeManager;

	if (!(rep.selStart && rep.selEnd)) {
		return;
	}

	documentAttributeManager.setAttributesOnRange(rep.selStart, rep.selEnd, [['padlink', padName]]);
}

// Once ace is initialized, we set ace_doInsertHeading and bind it to the context
exports.aceInitialized = function(hook, context) {
  var editorInfo = context.editorInfo;
  editorInfo.ace_doInsertPadlink = _(doInsertPadlink).bind(context);
}
