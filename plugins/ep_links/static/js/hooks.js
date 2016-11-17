exports.aceEditorCSS = function(hookName, context, cb) {
	return cb(['ep_links/static/css/ace.css']);
};

exports.aceEditEvent = function(hookName, context) {
	if (context.callstack.type === 'handleClick') {
		window.top.pm.send('toggleLinkModal', false);
	}
};

exports.postAceInit = function(hookName, context) {
	context.ace.callWithAce(function(ace) {
		var $inner = $(ace.ace_getDocument()).find('#innerdocbody');

		$inner.on('click', '.link', function() {
			var linkValue = this.getAttribute('data-value');

			if (/^(f|ht)tps?:\/\//i.test(linkValue)) {
				window.open(linkValue, '_blank');
			} else {
				window.top.pm.send('openPad', linkValue);
			}
		});
	});
};

exports.aceAttribsToClasses = function(hookName, context, cb) {
	if (context.key == 'link' && context.value != '') {
		return cb(['link:' + context.value]);
	}
};

exports.aceCreateDomLine = function(hookName, context, cb) {
	var linkValue = getLinkValue(context);

	if (linkValue) {
		return cb([{
			cls: context.cls,
			extraOpenTags: '<span class="link" data-value="' + linkValue + '">',
			extraCloseTags: '</span>'
		}]);
	} else {
		return cb();
	}
};

exports.collectContentPre = function(hook, context) {
	var linkValue = getLinkValue(context);

	if (linkValue) {
		context.cc.doAttrib(context.state, 'link::' + linkValue);
	}
};

function getLinkValue(context) {
	if (context.cls && context.cls.indexOf('link:') >= 0) {
		var argClss = context.cls.split(' ');
		var value;

		for (var i = 0; i < argClss.length; i++) {
			var cls = argClss[i];

			if (cls.indexOf('link:') !== -1) {
				value = cls.substr(cls.indexOf(':') + 1);
				break;
			}
		}

		return value;
	}

	return false;
}