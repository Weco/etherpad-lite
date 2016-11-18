var underscore = require('ep_etherpad-lite/static/js/underscore');
var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;

exports.aceAttribsToClasses = function(name, context) {
  if (context.key == 'img') {
    return ['img:' + context.value];
  }

  if (context.key == 'imgSize') {
    return ['imgSize:' + context.value];
  }
};

exports.aceInitialized = function(hook, context) {
  var editorInfo = context.editorInfo;

  editorInfo.ace_addImage = underscore(image.addImage).bind(context);
  editorInfo.ace_setImageSize = underscore(image.setImageSize).bind(context);
  editorInfo.ace_removeImage = underscore(image.removeImage).bind(context);
};

// Handle click events
exports.postAceInit = function(hook,context) {
  context.ace.callWithAce(function(ace) {
    var doc = ace.ace_getDocument();

    var $inner = $(doc).find('#innerdocbody');
    var lineHasContent = false;

    $inner.on("drop", function(e) {
      e = e.originalEvent;
      var file = e.dataTransfer.files[0];

      if(!file) return;

      if (file.type.match('image.*')) {
        var reader = new FileReader();
        var domLine = $(e.target);
        var lineNumber;

        if (e.target.tagName.toLowerCase() !== 'div') {
          domLine = domLine.parents('div');
        }

        lineNumber = domLine.prevAll().length;

        // If it's the last line of editor, insert one more line. Otherwise user will not be able insert new line
        // after image
        if (!domLine.next().length) {
          domLine.after('<div />');
        }

        reader.onload = (function(theFile) {
          padeditbar.toggleDropDown('image_uploading_modal');
          $.ajax({
            type: 'post',
            url: '/api/pads/images',
            data: {
              image: theFile.target.result
            },
            success: function(data) {
              var img = document.createElement('img');

              img.src = data.imagePath;
              context.ace.callWithAce(function(ace) {
                var size = Math.min(img.width, $inner.width());

                ace.ace_addImage(lineNumber, img.src, size);
              }, 'img', true);

              padeditbar.toggleDropDown('image_uploading_modal');
            }, error: function(error) {
              console.error('Uploading error', error);
              padeditbar.toggleDropDown('image_uploading_modal');
            }
          });
        });
        reader.readAsDataURL(file);
      }
    });

    // Don't allow resize handles to be shown
    doc.execCommand("enableObjectResizing", false, false);

    // On drag end remove the attribute on the line
    // Note we check the line number has actually changed, if not a drag start/end
    // to the same location would cause the image to be deleted!
    $inner.on("dragend", ".image", function(e) {
      var imageContainer = $(e.currentTarget);
      var imageLine = imageContainer.parents("div");
      var oldLineNumber = imageLine.prevAll().length;
      context.ace.callWithAce(function(ace){
        var rep = ace.ace_getRep();
        var newLineNumber = rep.selStart[0];

        if (oldLineNumber !== newLineNumber) {
          // We just nuke the HTML, potentially dangerous but seems to work
          $(imageContainer).remove();
          // We also remove teh attribute hoping we get the number right..
          ace.ace_removeImage(oldLineNumber);
        }
      }, 'img', true);

      // TODO, if the image is moved only one line up it will create a duplicate
      // IF the line is already populated, nothing much I can do about that for now
    });

    $inner.on('mousedown', '.resizer', function(event) {
      var $resizer = $(this);
      var $image = $resizer.parent();
      var isLeftSide = $resizer.hasClass('resizer--nw') || $resizer.hasClass('resizer--sw');
      var clientX = event.clientX;
      var imageWidth = $image.width();
      var imageLine = $image.parents('div');
      var lineNumber = imageLine.prevAll().length;
      var newSize = imageWidth;

      $inner
        .css('user-select', 'none')
        .attr('contentEditable', false)
        .off('.resizer');

      $inner.on('mousemove.resizer', function(event) {
        newSize = imageWidth + (isLeftSide ? -1 : 1) * (event.clientX - clientX);
        var imageLine = $inner.children().eq(lineNumber);
        var assoc = imageLine[0]['_magicdom_dirtiness'];

        imageLine.find('.image').width(newSize);

        // Ace does checks for dirtinnes in the code, and then clean all dirty dom elements, once we update image size
        // during resizing directly, dom changes will be treated as dirty and became the reasom of wierd behaivior.
        // To prevent that do manual update of cached assoc object.
        if (assoc && assoc.knownHTML) {
          assoc.knownHTML = imageLine.html();
        }
      });

      $inner.on('mouseup.resizer', function(event) {
        $inner
          .css('user-select', 'inherit')
          .attr('contentEditable', 'inherit')
          .off('.resizer');

          context.ace.callWithAce(function(ace) {
            ace.ace_setImageSize(newSize, lineNumber);
          }, 'img', true);
      });
    });

  }, 'image', true);
}


var image = {
  setImageSize: function(size, lineNumber) {
    this.documentAttributeManager.setAttributeOnLine(lineNumber, 'imgSize', size); // make the line a task list
  },

  removeImage: function(lineNumber) {
    var documentAttributeManager = this.documentAttributeManager;

    // This errors for some reason..
    documentAttributeManager.removeAttributeOnLine(lineNumber, 'img'); // make the line a task list
    documentAttributeManager.removeAttributeOnLine(lineNumber, 'imgSize'); // make the line a task list
  },

  addImage: function(lineNumber, src, size) {
    var documentAttributeManager = this.documentAttributeManager;

    // This errors for some reason..
    src = '<img src=' + src + '>';
    documentAttributeManager.setAttributeOnLine(lineNumber, 'img', src); // make the line a task list
    documentAttributeManager.setAttributeOnLine(lineNumber, 'imgSize', size); // make the line a task list
  }
};

exports.aceEditorCSS = function(name, cb) {
  return ["/ep_copy_paste_images/static/css/ace.css"]; // inner pad CSS
};

// Rewrite the DOM contents when an IMG attribute is discovered
exports.aceDomLineProcessLineAttributes = function(name, context) {
  var cls = context.cls;
  var exp = /(?:^| )img:([^>]*)/;
  var expSize = /(?:^| )imgSize:((\S+))/;
  var imgType = exp.exec(cls);
  var image = imgType && imgType[1] ? (imgType[1] + '>') : null;

  if (!image) return [];

  var imgSize = expSize.exec(cls);
  var size = parseInt(imgSize && imgSize[1], 10) || 300;

  var template = '<span class="image" style="width:' + size + 'px">';

  template += '<span class="resizer resizer--nw" unselectable="on" contentEditable=false></span>';
  template += '<span class="resizer resizer--ne" unselectable="on" contentEditable=false></span>';
  template += '<span class="resizer resizer--sw" unselectable="on" contentEditable=false></span>';
  template += '<span class="resizer resizer--se" unselectable="on" contentEditable=false></span>';

  return [{
    preHtml: template + image,
    postHtml: '</span>',
    processedMarker: true
  }];
};

// When an image is detected give it a lineAttribute
// of Image with the URL to the image
// Images dragged / dropped from the Desktop will be Base64 encoded
exports.collectContentImage = function(name, context) {
  var tname = context.tname;
  var state = context.state;
  var cc = context.cc;
  var lineAttributes = state.lineAttributes;

  if (tname === 'div' || tname === 'p') {
    delete lineAttributes['img'];
    delete lineAttributes['imgSize'];
  }

  if (tname == 'img') {
    lineAttributes['img'] = context.node.outerHTML;
  }
}

exports.collectContentPost = function(name, context) {
  var tname = context.tname;
  var state = context.state;
  var lineAttributes = state.lineAttributes;

  if (tname == "img") {
    delete lineAttributes['img'];
  }

  if (tname == "imgSize") {
    delete lineAttributes['imgSize'];
  }
}

exports.ccRegisterBlockElements = function (name, context) {
  return ['img'];
}

exports.postToolbarInit = function(hookName, context, cb) {
	context.toolbar.registerDropdownCommand('imageUploadingModal:open', 'image_uploading_modal');
	return cb();
};