$(document).ready(function () {
	$('#pad_link_insert_btn').click(function() {
		var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;

		padeditbar.toggleDropDown('none');
		window.top.pm.send('toggleLinkModal');
	});

	window.top.pm.subscribe('newPadLink', function(data) {
		if (data.etherpadId === pad.getPadId()) {
			var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;

			padeditor.ace.callWithAce(function(ace) {
				rep = ace.ace_getRep();

				// If there is no selection, insert pad name
				if (rep.selEnd[1] - rep.selStart[1] === 0) {
					ace.ace_replaceRange(rep.selStart, rep.selEnd, data.title);
					ace.ace_performSelectionChange([rep.selStart[0], rep.selStart[1] - data.title.length], rep.selStart, false);
				}

				ace.ace_performDocumentApplyAttributesToRange(rep.selStart, rep.selEnd, [['padLink', data.id]]);
			}, 'padLink');
		}
	});
});