var $ = require('ep_etherpad-lite/static/js/rjquery').$;
var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
var tags = ['padlink'];

exports.postToolbarInit = function(hook, context, cb) {
	context.toolbar.registerDropdownCommand('linksModal:open', 'links_modal');
	return cb();
};

// To do show what font family is active on current selection
exports.aceEditEvent = function(hook, call, cb) {
  var cs = call.callstack;

  if (!(cs.type == 'handleClick') && !(cs.type == 'handleKeyEvent') && !(cs.docTextChanged)){
    return false;
  }

  if (cs.type == 'setBaseText' || cs.type == 'setup') {
    return false;
  }

  setTimeout(function() {
    $.each(tags, function(key, value) {
      if (call.editorInfo.ace_getAttributeOnSelection(value)) {
        call.editorInfo.ace_setAttributeOnSelection(value, true);
      }
    });
  }, 250);
}

exports.aceAttribsToClasses = function(hook, context) {
  if (tags.indexOf(context.key) !== -1) {
    return [context.key];
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
