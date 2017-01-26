window.$(document).ready(function () {
	var pm = window.top.pm;
	var btns = [{
		id: 'pad_privacy_settings',
		toggleMessageName: 'togglePrivacyModal',
		stateMessageName: 'togglePrivacyBtnState',
		requestStateMessageName: 'requestPrivacyBtnState'
	}, {
		id: 'suggested_edits',
		toggleMessageName: 'toggleEditsModal',
		stateMessageName: 'toggleEditsBtnState',
		requestStateMessageName: 'requestEditsBtnState'
	}];

	if (pm) {
		var urlRegExp = /^\/pads\/([^\/]*)(.*)$/;
		var pathname = window.top.location.pathname;
		var activePadId = urlRegExp.test(pathname) ? pathname.replace(urlRegExp, '$1') : 'root';
		var padId = window.location.pathname.replace(/^\/p\/([^\/]*)(.*)$/, '$1');

		btns.forEach(function(btn) {
			var $btn = window.$('#' + btn.id);

			$btn.click(function() {
				window.padeditbar.toggleDropDown('none');
				pm.send(btn.toggleMessageName);
			});

			$btn = $btn.add($btn.next());

			pm.subscribe(btn.stateMessageName + '.etherpad', function(data) {
				if (data.padId === padId) {
					$btn[data.isActive ? 'show' : 'hide']()
				}
			});

			if (padId === activePadId) {
				pm.send(btn.requestStateMessageName);
			}
		});

		var editorFontSize = 0;

		window.$('.font-size').on('click', function() {
			var size = Math.max(10, editorFontSize + (window.$(this).hasClass('font-size--plus') ? 1 : -1) * 2);

			window.localStorage.setItem('editorFontSize', size);
			pm.send('updateFontSize', size);
		});

		pm.subscribe('updateFontSize.etherpad', function(size) {
			if (window) {
				var $innerBody = window.$('[name=ace_outer]').contents().find('[name=ace_inner]').contents().find('body');

				editorFontSize = size;
				$innerBody && $innerBody.css('fontSize', editorFontSize + 'px');
			}
		});
	}
});
