var eejs = require('ep_etherpad-lite/node/eejs/');
var tags = ['padlink'];
var fs = require('fs');

/********************
* UI
*/
exports.eejsBlock_editbarMenuLeft = function(hook, args, cb) {
  args.content = args.content + eejs.require('ep_links/templates/editbarButtons.ejs');
  return cb();
}

exports.eejsBlock_dd_format = function(hook, args, cb) {
  args.content = args.content + eejs.require('ep_links/templates/fileMenu.ejs');
  return cb();
}

exports.eejsBlock_body = function(hook, args, cb) {
	args.content = args.content + eejs.require('ep_links/templates/modals.ejs');
	return cb();
}

exports.eejsBlock_scripts = function(hook, args, cb) {
	args.content = args.content + eejs.require('ep_links/templates/scripts.ejs');
	return cb();
}

exports.eejsBlock_styles = function(hook, args, cb) {
	args.content = args.content + eejs.require('ep_links/templates/styles.ejs');
	return cb();
}


/********************
* Editor
*/

// Allow <whatever> to be an attribute
exports.aceAttribClasses = function(hook, attr, cb) {
  for (var i in tags){
    var tag = tags[i];
    attr[tag] = 'tag:tag' + tag;
  };

  cb(attr);
}

/********************
* Export
*/
// Include CSS for HTML export
exports.stylesForExport = function(hook, padId, cb) {
  var cssPath = __dirname +'/static/css/iframe.css';

  fs.readFile(cssPath, function(err, data){
    cb(data);
  });
};

// Add the props to be supported in export
exports.exportHtmlAdditionalTags = function(hook, pad, cb) {
  cb(tags);
};


exports.asyncLineHTMLForExport = function(hook, context, cb) {
  cb(rewriteLine);
}

function rewriteLine(context) {
  var lineContent = context.lineContent;

  tags.forEach(function(tag){
    if (lineContent) {
      lineContent = lineContent.replaceAll('<' + tag, '<span');
      lineContent = lineContent.replaceAll('</' + tag, '</span');
    }
  });
  return lineContent;
}

String.prototype.replaceAll = function(str1, str2, ignore) {
  return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignore?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
}
