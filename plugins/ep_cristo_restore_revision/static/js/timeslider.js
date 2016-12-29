$(function() {
	var $btn = $('.js-repeat-revision');
	var padId = window.location.pathname.replace(/^\/p\/([^\/]*)(.*)$/, '$1');
	var pm = window.top.pm;

	$btn.hide();
	$btn.on('click', function(e) {
		var rev = BroadcastSlider.getSliderPosition();
		var padId = $(e.target).closest('a[data-pad]').data('pad');

		if (rev && padId) {
			window.location = '/restore/' + padId + '/' + rev;
		} else {
			console.error('Missing pad or revision');
		}
	});

	if (pm) {
		setTimeout(function() {
			pm.send('requestRestoreBtnState');
		});
		pm.subscribe('toggleRestoreBtnState', function(data) {
			if (padId === data.padId) {
				$btn[data.isActive ? 'show' : 'hide']();
				console.log($btn, data.isActive ? 'show' : 'hide');
			}
		});
	}
});