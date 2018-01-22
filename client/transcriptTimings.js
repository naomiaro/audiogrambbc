var transcript = require("./transcript");
var audio = require('./audio');
var utils = require('./utils');

function reverseHMS(str) {
  var time = str.split(':');
  var sec = 0;
  var place = 0;
  for (let i = time.length - 1; i >= 0; i--) {
    sec += +time[i].replace(/[^\d.-]/g, '') * Math.pow(60, place);
    place++;
  }
  return sec;
}

function formatHMS(t, round) {
  t = Number(t);
  var h = Math.floor(t / 3600);
  var m = Math.floor((t % 3600) / 60);
  var s = ((t % 3600) % 60).toFixed(1);
  if (round) s = Math.round(s);
  var string = `00${m}`.slice(-2) + ":" + `00${s}`.slice(round ? -2 : -4);
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
  jQuery("#transcript-timings .block").remove();
  var subs = transcript.toSubs();
  var maxWidth = 0;
  subs.forEach(function(sub) {
    insertSubBlock();
    var text = "";
    sub.lines.forEach(function(line) {
      if (text.length) text += "<br/>";
      text += line;
    });
    var block = jQuery("#transcript-timings .block:last");
    block.find(".subtitles").html(text);
    block.attr("data-start", sub.start);
    block.attr('data-start-orig', sub.start);
    block.attr("data-end", sub.end);
    block.attr('data-end-orig', sub.end);
    block.find("input[name='start']").val(formatHMS(sub.start));
    block.find("input[name='end']").val(formatHMS(sub.end));
    var width = block.find(".subtitles").width() + 5;
    if (width > maxWidth) maxWidth = width;
  });
  jQuery("#transcript-timings .block .subtitles").width(maxWidth);
  var offset = jQuery('#transcript-timings').offset().left;
  var labelStartLeft = jQuery('#transcript-timings input[name=start]:first').offset().left - offset;
  var labelEndLeft = jQuery("#transcript-timings input[name=end]:first").offset().left - offset;
  jQuery("#transcript-timings .label .start").css("left", labelStartLeft);
  jQuery("#transcript-timings .label .end").css("left", labelEndLeft);
}

function setStartTime(time, e) {

  // End previous block
  var active = jQuery("#transcript-timings .block.active");
  if (active.length) {
    active.attr('data-end', time);
    active.find("input[name='end']").val(formatHMS(time, true));
    active.removeClass('active');
  }

  // Start this block
  var staged = jQuery("#transcript-timings .block.staged");
  staged.attr("data-start", time);
  staged.find("input[name='start']").val(formatHMS(time, true));
  staged.removeClass('staged').addClass('active');

  // Stage next block
  var next = staged.next();
  if (next.length && next.is('.block')) {
    next.addClass('staged');
  }
  
  // Hide previous and set tooltip
  jQuery('[data-toggle="tooltip"]').tooltip('hide');
  staged.prevAll('.block').slideUp(300, function(){
    var x = e ? e.pageX : jQuery('#transcript-timings-tooltip-show').css('left');
    tooltip(jQuery('#transcript-timings .block.staged .box'), x);
  });

}

function setEndTime(time, e) {

  // End previous block
  var active = jQuery("#transcript-timings .block.active");
  active.attr('data-end', time);
  active.find("input[name='end']").val(formatHMS(time, true));
  active.removeClass('active');

  jQuery('[data-toggle="tooltip"]').tooltip('hide');
  var staged = jQuery('#transcript-timings .block.staged .box');
  var x = staged.offset().left + (staged.width() / 2);
  tooltip(jQuery('#transcript-timings .block.staged .box'), x);

}

function start(visible) {
  jQuery("#transcript-timings .block input").removeClass('invalid');
  jQuery("#transcript-timings .block").removeClass("active staged unused");
  jQuery("#transcript-timings .block:first").addClass('staged');
  if (!jQuery("#transcript-timings").hasClass("recording")) {
    jQuery("#transcript-timings .block").each(function () {
      var block = jQuery(this);
      block.attr('data-start-wizard-orig', block.attr('data-start'));
      block.attr('data-end-wizard-orig', block.attr('data-end'));
    });
  }
  jQuery("#transcript-timings .block").attr('data-start', null).attr('data-end', null);
  jQuery("#transcript-timings .block").slideDown();
  jQuery('#transcript-timings-wizard-info .buttons-start').hide();
  jQuery('#transcript-timings-wizard-info .buttons-stop').show();
  if (visible) setStartTime(0);
  jQuery("#transcript-timings").addClass("recording");
  jQuery('[data-toggle="tooltip"]').tooltip('hide');
  jQuery('#transcript-timings-wizard-info .instructions').slideUp(300, function(){
    audio.restart();
    var staged = jQuery('#transcript-timings .block.staged .box');
    var x = staged.offset().left + (staged.width() / 2);
    tooltip(staged, x);
  });
}

function stop() {
  audio.pause();
  jQuery('[data-toggle="tooltip"]').tooltip('hide');
  // jQuery('#transcript-timings-wizard-info .instructions').show();
  jQuery("#transcript-timings .block").removeClass("active staged");
  jQuery("#transcript-timings").removeClass("recording");
  jQuery("#transcript-timings .block").slideDown();
  jQuery('#transcript-timings-wizard-info .buttons-start').show();
  jQuery('#transcript-timings-wizard-info .buttons-stop').hide();
  jQuery("#transcript-timings .block").each(function(){
    var block = jQuery(this);
    block.attr("data-start-wizard-orig", null);
    block.attr('data-end-wizard-orig', null);
    var start = block.attr('data-start');
    var end = block.attr('data-end');
    block.find("input[name='start']").val(start ? formatHMS(start) : '');
    block.find("input[name='end']").val(end ? formatHMS(end) : '');
    if (!start) block.addClass('unused');
  });
  validate();
}

function tooltip(el, x) {
  var type = el.parent().hasClass('active') ? 'hide' : 'show';
  var top = el.position().top + el.outerHeight() - 3;
  jQuery(`#transcript-timings-tooltip-${type}`).css({top});
  if (x) {
    var left = x - jQuery('#transcript').offset().left;
    jQuery(`#transcript-timings-tooltip-${type}`).css({ left });
  }
  jQuery(`#transcript-timings-tooltip-${type}`).tooltip('show');
}

function getTimeFromInput(el) {
  var type = el.is('[name=start') ? 'start' : 'end';
  return +el.parents('.block:first').attr(`data-${type}`);
}

function updateTime(el, time) {
  var type = el.is("[name=start") ? "start" : "end";
  el.parents(".block:first").attr(`data-${type}`, time);
  el.val(formatHMS(time));
}

function validate() {
  var inputs = jQuery('#transcript-timings .block input');
  var count = inputs.length;
  inputs.removeClass('invalid');
  inputs.each(function(i){
    var time = getTimeFromInput(jQuery(this));
    var prev = 0;
    for (let j = i-1; j >=0; j--) {
      var el = jQuery(`#transcript-timings .block input:eq(${j})`);
      if (el.length) {
        prev = getTimeFromInput(el);
        break;
      }
    }
    var next = Infinity;
    for (let j = i+1; j < count; j++) {
      var el = jQuery(`#transcript-timings .block input:eq(${j})`);
      if (el.length) {
        next = getTimeFromInput(el);
        break;
      }
    }
    var invalid = false;
    // If time is within thenth sec of boundary, move it
    if (time < prev) {
      if (Math.round(time * 10) / 10 < Math.round(prev * 10) / 10) {
        invalid = true;
      } else {
        updateTime(jQuery(this), prev);
      }
    }
    if (time > next) {
      if (Math.round(time * 10) / 10 > Math.round(next * 10) / 10) {
        invalid = true;
      } else {
        updateTime(jQuery(this), next);
      }
    }
    // Otherwise invalidate
    if (invalid) jQuery(this).addClass('invalid');
  })
}

function save() {
  stop();
  validate();
  var invalid = jQuery("#transcript-timings .block input.invalid").length;
  if (invalid) {
    return alert('Some of your timings are invalid. Fix these (shown in red) first.');
  } else {
    console.log('save');
    jQuery('#transcript-timings .block').each(function(i){
      var block = jQuery(this);
      var start = +block.attr("data-start");
      var end = +block.attr('data-end');
      var dur = end - start;
      var origStart = +block.attr("data-start-orig");
      var origEnd = +block.attr("data-end-orig");
      if (start != origStart || end != origEnd) {
        var words = jQuery(`.transcript-editor .transcript-segment:eq(${i}) .transcript-word`);
        var charCount = 0;
        words.each(function() {
          charCount += jQuery(this).text().length;
        });
        var secPerChar = dur / charCount;
        var time = start;

        words.each(function() {
          var word = jQuery(this);
          word.attr("data-start-org", word.attr("data-start"));
          word.attr("data-end-org", word.attr("data-end"));
          word.attr("data-start", time);
          var wordDur = secPerChar * word.text().length;
          word.attr("data-end", time + wordDur);
          word.removeClass('added');
          word.addClass("time-manual");
          time += wordDur;
        });
      }
    });
    transcript.format();
    jQuery("#transcript").removeClass("timings");
    jQuery("#minimap").removeClass("disabled");
  }
}

function init() {

  jQuery(document).on("click", "#transcript-btn-timings", function (e) {
    jQuery('#transcript-timings-wizard-info .instructions').show();
    jQuery("#transcript").addClass("timings");
    jQuery("#minimap").addClass("disabled");
    load();
    jQuery("#transcript-timings .block").show();
    utils.stopIt(e);
  });
  jQuery(document).on("click", "#transcript-btn-timings-save", function() {
    save();
  });
  jQuery(document).on("click", "#transcript-btn-timings-cancel", function() {
    stop();
    jQuery("#transcript").removeClass("timings");
    jQuery("#minimap").removeClass("disabled");
  });
  
  jQuery(document).on('click', '#transcript-btn-timings-mode-manual', function(){
    stop();
    jQuery('#transcript-timings').removeClass('manual wizard');
    jQuery('#transcript-timings').addClass('manual');
    jQuery('#transcript-timings .block:first input:first').select().focus();
  });
  jQuery(document).on('click', '#transcript-btn-timings-mode-wizard', function () {
    jQuery('#transcript-timings').removeClass('manual wizard');
    jQuery('#transcript-timings').addClass('wizard');
  });

  jQuery(document).on('click', '#transcript-btn-timings-wizard-start-on', function(){
    stop();
    start(true);
  });
  jQuery(document).on('click', '#transcript-btn-timings-wizard-start-off', function () {
    stop();
    start(false);
  });
  jQuery(document).on('click', '#transcript-btn-timings-wizard-restart', function () {
    audio.pause();
    var firstStart = +jQuery('#transcript-timings .block:eq(0)').attr('data-start');
    start(firstStart === 0);
  });

  jQuery(document).on('click', '#transcript-timings .block.staged .box', function(e){
    var time = audio.currentTime() - 0.2;
    setStartTime(time, e);
  });

  jQuery(document).on('click', '#transcript-timings .block.active .box', function (e) {
    var time = audio.currentTime() - 0.2;
    setEndTime(time, e);
  });

  jQuery(document).on('click', '#transcript-btn-timings-wizard-cancel', function () {
    jQuery("#transcript-timings .block").each(function () {
      var block = jQuery(this);
      block.attr('data-start', block.attr('data-start-wizard-orig'));
      block.attr('data-end', block.attr('data-end-wizard-orig'));
    });
    stop();
  });

  jQuery(document).on('click', '#transcript-btn-timings-wizard-finish', function () {
    var time = audio.duration();
    var lastBlock = jQuery("#transcript-timings .block.active");
    if (lastBlock.length) {
      lastBlock.find("input[name='end']").val(formatHMS(time));
      lastBlock.attr('data-end', time);
    }
    stop();
  });

  jQuery("audio").on("timeupdate", function () {
    jQuery('#transcript-timings').addClass('playing');
  });
  jQuery("audio").on("timeupdate", function() {
    if (!this.paused) {
      var time = audio.currentTime();
      if (jQuery('#transcript-timings').hasClass('recording')) {
        var disp = formatHMS(time, true);
        jQuery("#transcript-timings .block.active input[name='end']").val(disp);
        jQuery("#transcript-timings .block.staged input[name='start']").val(disp);
      } else if (jQuery('#transcript-timings').hasClass('playing')) {
        jQuery('#transcript-timings .block').removeClass('current');
        jQuery('#transcript-timings .block').each(function(){
          var start = jQuery(this).attr('data-start');
          var end = jQuery(this).attr('data-end');
          var fakeTime = time + 0.25; // compensate for lag
          if (start < fakeTime && end > fakeTime) {
            return jQuery(this).addClass('current');
          }
        });
      }
    }
  });
  jQuery("audio").on("pause", function () {
    jQuery('#transcript-timings').removeClass('playing');
    jQuery('#transcript-timings .block').removeClass('current');
  });
  jQuery("audio").on("ended", function () {
    jQuery('#transcript-timings').removeClass('playing');
    jQuery('#transcript-timings .block').removeClass('current');
    var time = audio.currentTime();
    jQuery("#transcript-timings .block.active").attr('data-stop', time);
    stop();
  });

  jQuery(document).on('mousemove', '#transcript-timings.recording .block.active .box, #transcript-timings .block.staged .box', function (e) {
    tooltip( jQuery(this), e.pageX );
  });
  jQuery(document).on('mouseleave', '#transcript-timings .block .box', function (e) {
    jQuery('#transcript-timings [data-toggle="tooltip"]').tooltip('hide');
  });

  var validateTimeout;
  jQuery(document).on('keyup', '#transcript-timings.manual input', function(){
    clearTimeout(validateTimeout);
    var sec = reverseHMS(jQuery(this).val());
    var type = jQuery(this).is('[name=start]') ? 'start' : 'end';
    jQuery(this).parents('.block:first').attr(`data-${type}`, sec);
    validateTimeout = setTimeout(function(){
      validate();
    }, 750);
  });
  jQuery(document).on('change', '#transcript-timings.manual input', function () {
    var type = jQuery(this).is('[name=start]') ? 'start' : 'end';
    var sec = jQuery(this).parents('.block:first').attr(`data-${type}`);
    var disp = formatHMS(sec);
    jQuery(this).val(disp);
  });

}

module.exports = {
  init
}