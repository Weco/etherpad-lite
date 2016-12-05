var $sidedivinner;
var init;
var firstLineInitCount = 0;
var updateNextLineTimeoout;

exports.postAceInit = function(hook_name, arg$) {
	var ace = arg$.ace;

	$sidedivinner = $('iframe[name="ace_outer"]').contents().find('#sidedivinner').addClass('authorColors');

	return ace.callWithAce(function(ace) {
		var $doc = $(ace.ace_getDocument());
		var $body = $doc.find('body');
		var x$ = $body.get(0).ownerDocument;

		x$.addEventListener('focus', function() {
			$sidedivinner.addClass('authorColors');
			return $body.addClass('focus');
		}, true);
		x$.addEventListener('blur', function() {
			$sidedivinner.removeClass('authorColors');
			return $body.removeClass('focus');
		}, true);

		return x$;
	});
};

exports.aceSetAuthorStyle = function(name, context) {
	var dynamicCSS = context.dynamicCSS;
	var outerDynamicCSS = context.outerDynamicCSS;
	var parentDynamicCSS = context.parentDynamicCSS;
	var info = context.info;
	var author = context.author;

	if (!init) {
		outerInit(outerDynamicCSS);
	}

	var authorClass = getAuthorClassName(author);
	var authorSelector = ".authorColors span." + authorClass;

	if (info) {
		var color = info.bgcolor;
		var authorName = authorNameAndColorFromAuthorId(author).name;
		var x$, y$, z$, z1$, z2$;

		if (!color) {
			return 1;
		}

		x$ = dynamicCSS.selectorStyle(".authorColors.focus span." + authorClass);
		x$.borderBottom = "2px solid " + color;
		y$ = parentDynamicCSS.selectorStyle(authorSelector);
		y$.borderBottom = "2px solid " + color;
		z$ = dynamicCSS.selectorStyle(".authorColors.focus .primary-" + authorClass + " ." + authorClass);
		z$.borderBottom = '0px';
		z1$ = outerDynamicCSS.selectorStyle("#sidedivinner.authorColors > div.primary-" + authorClass);
		z1$.borderRight = "solid 5px " + color;
		z1$.paddingRight = '5px';

		z2$ = outerDynamicCSS.selectorStyle("#sidedivinner > div.primary-" + authorClass + ":before");
		z2$.content = "'" + authorName + "'";
	} else {
		dynamicCSS.removeSelectorStyle(".authorColors.focus span." + authorClass);
		parentDynamicCSS.removeSelectorStyle(authorSelector);
	}

	return 1;
};

exports.acePostWriteDomLineHTML = function(hook_name, args, cb) {
	return setTimeout(function() {
		var $node = $(args.node);
		var nodeIndex = $node.index() + 1;

		// `acePostWriteDomLineHTML` hook will be called 2 times during pad initialization, ignore first call for
		// performance purpose
		if (nodeIndex === 1 && firstLineInitCount < 2) {
			firstLineInitCount++;
		}

		if (nodeIndex && firstLineInitCount > 1) {
			// Start updateDomline with isInit flag on the second call
			if (firstLineInitCount === 2) {
				// Divide all lines into groups for 200 lines, and handle this groups with increasing timeout to not
				// block interface.
				setTimeout(function() {
					updateDomline($node, nodeIndex, true);
				}, Math.floor(nodeIndex/200) * 1000);

				setTimeout(function() {
					firstLineInitCount = 3;
				});
			} else {
				// Handle all the further line changes without timeout
				updateDomline($node, nodeIndex);
			}
		}
	}, 200);
};

exports.aceEditEvent = function(hook_name, context, cb) {
	var callstack = context.callstack;
	var x$ = $('iframe[name="ace_outer"]').contents();

	if (callstack.type !== 'setWraps') {
		return;
	}

	x$.find('#sidediv').css({
		'padding-right': '0px'
	});
	x$.find('#sidedivinner').css({
		'max-width': '180px',
		overflow: 'hidden'
	});

	return x$;
};

function allClasses($node) {
	var ref = $node.attr('class');

	return (ref != null ? ref : '').split(' ');
}

function derivePrimaryAuthor($node) {
	var byAuthor = {};
	var mPA = 0;
	var authorClass = null;

	$node.find('span').each(function() {
		var $this = $(this);
		var classes = allClasses($this);

		for (var i = 0; i < classes.length; i++) {
			var spanclass = classes[i];

			if (/^author/.exec(spanclass)) {
				if (!byAuthor[spanclass]) {
					byAuthor[spanclass] = 0
				}

				byAuthor[spanclass] += $this.text().length;
				break;
			}
		}
	});

	for (var author in byAuthor) {
		var value = byAuthor[author];

		if (value > mPA) {
			mPA = value;
			authorClass = author;
		}
	}

	return authorClass;
}

function toggleAuthor($node, prefix, authorClass) {
	var hasClass, myClass, i$, ref$, len$, c;
	hasClass = false;
	myClass = prefix + "-" + authorClass;
	for (i$ = 0, len$ = (ref$ = allClasses($node)).length; i$ < len$; ++i$) {
		c = ref$[i$];
		if (c.indexOf(prefix) === 0) {
			if (c === myClass) {
				hasClass = true;
			} else {
				$node.removeClass(c);
			}
		}
	}
	if (hasClass) {
		return false;
	}
	$node.addClass(myClass);
	return true;
}

function extractAuthor($node) {
	var ref$, a, ref1$;
	return (ref$ = (function() {
		var i$, ref$, len$, results$ = [];
		for (i$ = 0, len$ = (ref$ = allClasses($node)).length; i$ < len$; ++i$) {
			a = ref$[i$];
			if (/^primary-/.exec(a)) {
				results$.push(a);
			}
		}
		return results$;
	}())) != null ? (ref1$ = ref$[0]) != null ? ref1$.replace(/^primary-/, '') : void 8 : void 8;
}

function updateDomline($node, lineNumber, isInit) {
	var authorClass = $node.text().length > 0 ? derivePrimaryAuthor($node) : "none";

	toggleAuthor($node, "primary", authorClass);

	return authorViewUpdate($node, lineNumber, null, authorClass, isInit);
}

function authorViewUpdate($node, lineNumber, prevAuthor, authorClass, isInit, nextCount) {
	var $authorContainer = $sidedivinner.find("div:nth-child(" + lineNumber + ")");
	var nodeId = $authorContainer.attr('id');
	var refId = nodeId && nodeId.replace(/^ref-/, '');

	if (!authorClass) {
		authorClass = extractAuthor($node)
	}

	if (!prevAuthor) {
		var prev = $authorContainer;
		while ((prev = prev.prev()) && prev.length) {
			prevAuthor = extractAuthor(prev);
			if (prevAuthor !== 'none') {
				break;
			}
		}
	}
	if (prevAuthor === authorClass) {
		$authorContainer.addClass('concise');
	} else {
		$authorContainer.removeClass('concise');
	}

	if (refId === $node.attr('id')) {
		if (!toggleAuthor($authorContainer, "primary", authorClass)) {
			return;
		}
	} else {
		$authorContainer.attr('id', 'ref-' + $node.attr('id'));
		toggleAuthor($authorContainer, "primary", authorClass);
	}

	if (typeof isInit !== 'boolean' || !isInit) {
		var next = $node.next();

		if (next.length) {
			var logicalPrevAuthor = authorClass === 'none' ? prevAuthor : authorClass;
			var nextLineNumber = lineNumber + 1;
			var updateNextLine = function() {
				authorViewUpdate(next, nextLineNumber, logicalPrevAuthor, false, false, nextCount)
			};

			if (typeof nextCount === 'number') {
				nextCount++;
			} else {
				nextCount = 1;
				if (updateNextLineTimeoout) {
					clearTimeout(updateNextLineTimeoout);
					updateNextLineTimeoout = null;
				}
			}

			// Do a timeout each 100 lines to not block interface in big pads
			if (nextCount % 100 === 0) {
				updateNextLineTimeoout = setTimeout(updateNextLine, 1000);
			} else {
				updateNextLine();
			}
		}
	}
}

function fadeColor(colorCSS, fadeFrac) {
	var color = colorutils.css2triple(colorCSS);

	return colorutils.triple2css(colorutils.blend(color, [1, 1, 1], fadeFrac));
}

function getAuthorClassName(author) {
	return 'author-' + author.replace(/[^a-y0-9]/g, function(c) {
		if (c === '.') {
			return '-';
		} else {
			return 'z' + c.charCodeAt(0) + 'z';
		}
	});
}

function outerInit(outerDynamicCSS) {
	var x$, y$, z$, z1$;
	x$ = outerDynamicCSS.selectorStyle('#sidedivinner > div.primary-author-none');
	x$.borderRight = 'solid 0px ';
	x$.paddingRight = '5px';
	y$ = outerDynamicCSS.selectorStyle('#sidedivinner > div.concise::before');
	y$.content = "' '";
	z$ = outerDynamicCSS.selectorStyle('#sidedivinner > div');
	z$.fontSize = '0px';
	z$.paddingRight = '10px';
	z1$ = outerDynamicCSS.selectorStyle('#sidedivinner > div::before');
	z1$.fontSize = 'initial';
	z1$.textOverflow = 'ellipsis';
	z1$.overflow = 'hidden';

	return init = true;
}

function authorNameAndColorFromAuthorId(authorId) {
	var myAuthorId = pad.myUserInfo.userId;
	var authorObj = {};

	if (myAuthorId === authorId) {
		return {
			name: 'Me',
			color: pad.myUserInfo.colorId
		};
	}

	$('#otheruserstable > tbody > tr').each(function() {
		if (authorId === $(this).data('authorid')) {
			var x$ = $(this);

			x$.find('.usertdname').each(function() {
				return authorObj.name = $(this).text() || 'Anon';
			});
			x$.find('.usertdswatch > div').each(function() {
				return authorObj.color = $(this).css('background-color');
			});

			return authorObj;
		}
	});

	if (!authorObj || !authorObj.name) {
		authorObj = clientVars.collab_client_vars.historicalAuthorData[authorId];
	}

	return authorObj || {
		name: 'Anon',
		color: '#fff'
	};
}