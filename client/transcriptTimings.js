function load() {
  var subs = toSubs();
  var maxWidth = 0;
  subs.forEach(function(sub) {
    var block = jQuery("#transcript-timings .block.template")
      .clone()
      .removeClass("template");
    var text = "";
    sub.lines.forEach(function(line) {
      if (text.length) text += "<br/>";
      text += line;
    });
    block.find(".subtitles").html(text);
    jQuery("#transcript-timings .block:last").after(block);
    var width =
      jQuery("#transcript-timings .block:last .subtitles").width() + 5;
    if (width > maxWidth) maxWidth = width;
  });
  jQuery("#transcript-timings .block .subtitles").width(maxWidth);
}

function init() {
  jQuery(document).on("click", "#transcript-btn-timings", function() {
    jQuery("#transcript").toggleClass("timings");
  });
}

module.exports = {
  init
}