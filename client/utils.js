function navigate(state, msg, log) {
    var classMap = {
      home: "landing",
      new: null,
      edit: null,
      generate: "loading",
      view: "rendered"
    };
    if (state == 'home') {
      var projectsInit = require("./projects").init;
      var deleteAllMedia = require("./media").deleteAll;
      var clearTranscriptTimeouts = require("./transcript").clear;
      var resetTheme = require('./themeHelper').reset;
      projectsInit();
      deleteAllMedia();
      clearTranscriptTimeouts();
      resetTheme();
      jQuery("#input-audio").val('');
    }
    if (state != 'view' && jQuery('body').is('.rendered')) {
      var exitVideo = require("./video").exit;
      exitVideo();
    }
    setBreadcrumb(state);
    var cl = classMap[state];
    jQuery('.modal').modal('hide');
    setClass(cl, msg, log);
    var audio = require('./audio');
    audio.pause();
    jQuery(".modal-backdrop").remove();
}

function offline(msg) {
    jQuery("#offline-message").text(msg || "Audiogram is currently offline.");
    jQuery('#offline').show();
    var exitVideo = require("./video").exit;
    var stopAudio = require("./audio").pause;
    exitVideo();
    stopAudio();
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

function setClass(cl, msg, log) {
  var error = cl=='error';
  cl = LOADING ? error ? 'landing' : 'loading' : cl;
  if (jQuery('.modal').hasClass('in') && msg) {
    alert(msg);
  } else {
    var bodyClass = cl || '';
    if (error) bodyClass += ' error';
    jQuery("body").attr("class", bodyClass || null);
    jQuery('#error, #success').text(msg || '');
  }
  if (cl=='landing') {
    var projects = require('./projects');
    projects.getProjects();
  }
  if (cl=='loading') {
    jQuery("#loading-message").text(msg || 'Loading...');
  }
  // Log warning
  if ((log || (log === undefined && cl == 'error')) && msg) {
    // Get stack trace
    console.warn(msg);
    console.trace();
    var err = new Error();
    console.log(err.stack);
    // Log
    var logger = require("./slack");
    logger.warn(msg, err, USER);
  }
  if (cl=='landing') {
    // console.log(LOADING);
    history.replaceState(null, null, "/");
  }
  jQuery('html,body').scrollTop(0);
}

function tooltips() {
  jQuery(".tooltip-info").tooltip({ animation: false, html: true });
}

function getURLParams(qs) {
    qs = qs || document.location.search;
    qs = qs.split('+').join(' ');
    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;
    while ((tokens = re.exec(qs))) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    return params;
}

function stopIt(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    if (e.stopPropagation) {
        e.stopPropagation();
    }
}

function pad(n, width, z) {
    z = z || '0';
    width = width || 2;
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function error(err) {
    setClass('error', 'Error...', false);
    if (typeof err === 'string') {
        var error = { message: err, stack: null };
    } else {
        var error = JSON.parse(err);
    }
    console.error(error.message);
    console.log(error.stack);
    // console.log("RLW  client error function: "  + msg.code + " / " + msg.name + " / " + msg.message);
    if (!error.message) {
        error.message = 'Unknown error';
    }
    var logger = require('./slack');
    logger.error(error.message, error, USER);
    d3.select('#loading-message').text('Loading...');
    setClass('error', error.message, false);
}


function setBreadcrumb(level) {
    jQuery('section.breadcrumbs > span').removeClass('active');
    jQuery('#breadcrumb_' + level).addClass('active').removeClass('hidden');
    jQuery('#breadcrumb_' + level).prevAll().removeClass('hidden');
    jQuery('#breadcrumb_' + level).nextAll().addClass('hidden');
    d3.select('#breadcrumb_new').classed('hidden', level != 'new');
}

function clickBreadcrumb(level) {
    level = this ? jQuery(this).attr('id').split('_').pop() : level;
    if (!level) return false;
    if (level == 'home') {
      if (jQuery('#submit').is(':visible')) {
        if (!confirm('Are you sure you want to abandon your current proejct?')) return;
      }
      navigate('home');
    } else if (level == 'edit') {
      navigate('edit');
    }
    setBreadcrumb(level);
}
jQuery(document).on('click', 'section.breadcrumbs > span', clickBreadcrumb);

function statusMessage(result) {
    var getBlobs = require("./media").blobs;
    var blobs = getBlobs();
  switch (result.status) {
    case "queued":
      return (
        "Waiting for other jobs to finish, #" +
        (result.position + 1) +
        " in queue"
      );
    case "audio-download":
      return "Downloading media for processing";
    case "trim":
      return "Trimming source media";
    case "video":
      return "Processing background video";
    case "probing":
      return "Probing media file";
    case "waveform":
      return "Analyzing waveform";
    case "renderer":
      return "Initializing renderer";
    case "frames":
      if (
        !result.framesComplete &&
        blobs.background &&
        blobs.background.type.startsWith("video")
      ) {
        return "Processing background video";
      }
      var msg = "Generating frames";
      if (result.numFrames) {
        var percentComplete = Math.round(100 * (result.framesComplete || 0) / result.numFrames);
        if (percentComplete > 0 && percentComplete < 100) {
          msg += ", " + percentComplete + "% complete";
        }
      }
      return msg;
    case "combine":
      var msg = "Compositing video layers";
      if (result.combineProgress && result.combineProgress > 0 && result.combineProgress < 1) {
        var perc = Math.round(+result.combineProgress * 100);
        msg += ', ' + perc + '% complete';
      }
      return msg;
    case "subtitles":
      return "Overlaying subtitles";
    case "ready":
      return "Cleaning up";
    default:
      return JSON.stringify(result);
  }
}

function stats(type, metric, value, sampleRate) {
  jQuery.post("/stats", { type, metric, value, sampleRate });
}

module.exports = {
    setClass,
    offline,
    getURLParams,
    stopIt,
    pad,
    error,
    setBreadcrumb,
    statusMessage,
    navigate,
    tooltips,
    stats,
    formatHMS
}
