exports.aceEditEvent = function(hookName, context) {
	if (context.callstack.type === 'handleClick' && window.top.pm) {
		window.top.pm.send('togglePrivacyModal', false);
	}
};