exports.collectContentPre = function(hook, context) {
  var tname = context.tname;
  var state = context.state;
  var lineAttributes = state.lineAttributes
  var tagIndex = tname;
  var tags = ['padlink'];

  if (tags.indexOf(tname) !== -1) {
    context.cc.doAttrib(state, tname);
  }
};

// never seems to be run
exports.collectContentPost = function(hook, context) {
  var tname = context.tname;
  var state = context.state;
  var lineAttributes = state.lineAttributes
  var tagIndex = tname;

  if (tagIndex >= 0){
    delete lineAttributes['sub'];
  }
};
