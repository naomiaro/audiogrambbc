var transcript = require("./transcript");
var audio = require('./audio');

function formatHMS(t) {
  t = Number(t);
  var h = Math.floor(t / 3600);
  var m = Math.floor((t % 3600) / 60);
  var s = ((t % 3600) % 60).toFixed(2);
  s = Math.round(s);
  var string = `00${m}`.slice(-2) + ":" + `00${s}`.slice(-2);
  return string;
}

function insertSubBlock() {
    var blockDiv = document.createElement("div");
    blockDiv.setAttribute("class", "block");
    var boxDiv = document.createElement("div");
    boxDiv.setAttribute("class", "box");
    blockDiv.append(boxDiv);
    var timesDiv = document.createElement("div");
    timesDiv.setAttribute("class", "times");
    boxDiv.append(timesDiv);
    var startEl = document.createElement("input");
    startEl.setAttribute("name", "start");
    startEl.setAttribute("type", "text");
    timesDiv.append(startEl);
    var endEl = document.createElement("input");
    endEl.setAttribute("name", "end");
    endEl.setAttribute("type", "text");
    timesDiv.append(endEl);
    var subDiv = document.createElement("div");
    subDiv.setAttribute("class", "subtitles");
    boxDiv.append(subDiv);
    jQuery("#transcript-timings").append(blockDiv);
}

function load() {
  var subs = transcript.toSubs();
  var maxWidth = 0;
  subs.forEach(function(sub) {
    insertSubBlock();
    var text = "";
    sub.lines.forEach(function(line) {
      if (text.length) text += "<br/>";
      text += line;
    });
    jQuery("#transcript-timings .block:last .subtitles").html(text);
    jQuery("#transcript-timings .block:last input[name='start']").val(formatHMS(sub.start));
    jQuery("#transcript-timings .block:last input[name='end']").val(formatHMS(sub.end));
    var width = jQuery("#transcript-timings .block:last .subtitles").width() + 5;
    if (width > maxWidth) maxWidth = width;
  });
  jQuery("#transcript-timings .block .subtitles").width(maxWidth);
}

function setStartTime(time) {

  // End previous block
  var active = jQuery("#transcript-timings .block.active");
  if (active.length) {
    active.attr('data-end', time);
    active.find("input[name='end']").val(formatHMS(time));
    active.removeClass('active');
  }

  // Start this block
  var staged = jQuery("#transcript-timings .block.staged");
  staged.attr("data-start", time);
  staged.find("input[name='start']").val(formatHMS(time));
  staged.removeClass('staged').addClass('active');

  // Stage next block
  var next = staged.next();
  if (next.length && next.is('.block')) {
    next.addClass('staged');
  }

}

function init() {

  jQuery(document).on("click", "#transcript-btn-timings", function() {
    jQuery("#transcript").addClass("timings");
    load();
  });
  jQuery(document).on("click", "#transcript-btn-timings-cancel", function() {
    jQuery("#transcript").removeClass("timings");
  });

  jQuery(document).on('click', '#transcript-btn-timings-wizard-start-on', function(){
    jQuery("#transcript-timings").addClass("playing");
    jQuery("#transcript-timings .block").removeClass("active staged");
    jQuery("#transcript-timings .block:first").addClass('staged');
    setStartTime(0);
    audio.play();
  });

  jQuery(document).on('click', '#transcript-timings .block.staged', function(){
    var time = audio.currentTime();
    setStartTime(time);
  });

  jQuery(document).on('click', '#transcript-timings .block.active', function(){
    // set end time
  });

  jQuery("audio").on("timeupdate", function() {
    if (!this.paused) {
      var time = audio.currentTime();
      var disp = formatHMS(time);
      jQuery("#transcript-timings .block.active input[name='end']").val(disp);
      jQuery("#transcript-timings .block.staged input[name='start']").val(disp);
    }
  });
  jQuery("audio").on("ended", function() {
    console.log('ENDED');
    jQuery("#transcript-timings .block").removeClass("active staged");
    jQuery("#transcript-timings").removeClass("playing");
  });

}

module.exports = {
  init
}