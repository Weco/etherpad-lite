window.$(document).ready(function () {
	var pm = window.top.pm;

	if (pm) {
		var $privacySettingsBtn = window.$('#pad_privacy_settings');
		var urlRegExp = /^\/pads\/([^\/]*)(.*)$/;
		var pathname = window.top.location.pathname;
		var padId = window.location.pathname.replace(/^\/p\/([^\/]*)(.*)$/, '$1');

		$privacySettingsBtn.click(function() {
			window.padeditbar.toggleDropDown('none');
			pm.send('togglePrivacyModal');
		});

		$privacySettingsBtn = $privacySettingsBtn.add($privacySettingsBtn.next());

		pm.subscribe('togglePrivacyBtnState', function(data) {
			if (data.padId === padId) {
				$privacySettingsBtn[data.isActive ? 'show' : 'hide']()
			}
		});

		if (urlRegExp.test(pathname) && pathname.replace(urlRegExp, '$1') === padId) {
			pm.send('requestPrivacyBtnState');
		}
	}
});
