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
      //don't try to mess with non-image files
      if (file.type.match('image.*')) {
        var reader = new FileReader();
        reader.onload = (function(theFile) {
          //get the data uri
          var dataURI = theFile.target.result;
          //make a new image element with the dataURI as the source
          var img = document.createElement("img");
          img.src = dataURI;
          // Now to insert the base64 encoded image into the pad
          context.ace.callWithAce(function(ace) {
            var rep = ace.ace_getRep();
            var size = Math.min(img.width, $inner.width());

            ace.ace_addImage(rep, img.src, size);
          }, 'img', true);

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
      var id = e.currentTarget.id;
      var imageContainer = $inner.find("#"+id);
      var imageLine = $inner.find("."+id).parents("div");
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
      var imageLine = $image.parents("div");;
      var lineNumber = imageLine.prevAll().length;
      var newSize = imageWidth;

      $inner
        .css('user-select', 'none')
        .attr('contentEditable', false)
        .off('.resizer');

      $inner.on('mousemove.resizer', function(event) {
        newSize = imageWidth + (isLeftSide ? -1 : 1) * (event.clientX - clientX);
        $image.width(newSize);
      });

      $inner.on('mouseup.resizer', function(event) {
        context.ace.callWithAce(function(ace) {
          ace.ace_setImageSize(newSize, lineNumber);
        }, 'img', true);

        $inner
          .css('user-select', 'inherit')
          .attr('contentEditable', 'inherit')
          .off('.resizer');
      });
    });

  }, 'image', true);
}


var image = {
  setImageSize: function(size, lineNumber) {
    var documentAttributeManager = this.documentAttributeManager;
    documentAttributeManager.setAttributeOnLine(lineNumber, 'imgSize', size); // make the line a task list
  },

  removeImage: function(lineNumber) {
    var documentAttributeManager = this.documentAttributeManager;

    // This errors for some reason..
    documentAttributeManager.removeAttributeOnLine(lineNumber, 'img'); // make the line a task list
    documentAttributeManager.removeAttributeOnLine(lineNumber, 'imgSize'); // make the line a task list
  },

  addImage: function(rep, src, size) {
    var documentAttributeManager = this.documentAttributeManager;
    var lineNumber = rep.selStart[0]; // Get the line number
    // This errors for some reason..
    src = "<img src="+src+">";
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
  var imgSize = expSize.exec(cls);

  if (!imgType) return [];

  var size = parseInt(imgSize && imgSize[1], 10) || 300;
  var width = 'width:' + size + 'px';
  var template = '<span class="image" style="' + width + '">';

  template += '<span class="resizer resizer--nw" unselectable="on" contentEditable=false></span>';
  template += '<span class="resizer resizer--ne" unselectable="on" contentEditable=false></span>';
  template += '<span class="resizer resizer--sw" unselectable="on" contentEditable=false></span>';
  template += '<span class="resizer resizer--se" unselectable="on" contentEditable=false></span>';

  if (imgType[1]) {
    return [{
      preHtml: template + imgType[1] + '>',
      postHtml: '</span>',
      processedMarker: true
    }];
  }

  return [];
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