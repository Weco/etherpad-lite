var etherpad = {};

exports.aceEditEvent = function(hookName, context) {
	if (context.callstack.type === 'handleClick' && window.top.pm) {
		window.top.pm.send('togglePrivacyModal', false);
		window.top.pm.send('toggleEditsModal', false);
	}
};

exports.postAceInit = function(hookName, context) {
	updateEtherpadData({
		editor: context.ace,
		pad: context.pad
	});
};

exports.postToolbarInit = function(hookName, context) {
	updateEtherpadData({
		toolbar: context.toolbar
	});
};

function updateEtherpadData(data) {
	Object.assign(etherpad, data);

	if (etherpad.pad && etherpad.editor && etherpad.toolbar) {
		window.top.pm.send('editorInit', etherpad);
	}
}