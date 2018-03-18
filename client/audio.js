var minimap = require('./minimap.js'),
    utils = require('./utils'),
    minimap = require('./minimap'),
    d3 = require('d3');

var audio = document.querySelector("audio"),
    extent = [0, 1],
    stopAt = null;

// timeupdate is too low-res
d3.timer(update);

d3.select(audio).on("play", toggled)
  .on("pause", function(){ toggled(true); });

minimap.onBrushEnd(_extent);

function pause(time) {

  if (arguments.length) {
    audio.currentTime = time;
  }

  if (isPlaying()) {
    audio.pause();
  }

  toggled(true);
  stopAt = null;

}

function play(time,end) {

  if (arguments.length) {
    audio.currentTime = time;
    stopAt = end || null;
  } else {
    stopAt = null;
  }

  audio.play();

  toggled();

}

function restart() {
  play(extent[0] * audio.duration);
}

function update() {

  if (audio.duration) {

    var pos = audio.currentTime / audio.duration;
    var trim = [
      extent[0] * audio.duration,
      extent[1] * audio.duration
    ]

    if (stopAt && pos >= stopAt/audio.duration) {
      pause();
      if (pos >= extent[1]) {
        audio.currentTime = trim[1];
      } else {
        audio.currentTime = trim[0];
      }
    } else if (audio.ended || pos >= extent[1] || audio.duration * extent[0] - audio.currentTime > 0.2) {
      // Need some allowance at the beginning because of frame imprecision (esp. FF)
      if (isPlaying()) {
        play(trim[0]);
      }
      // pause(extent[0] * audio.duration);
    }

    minimap.time(pos);
    if (isPlaying()) {
      var currentTimeStr = utils.formatHMS(audio.currentTime - trim[0]).slice(1);
      jQuery('#duration .current').text(currentTimeStr);
      var preview = require("./preview");
      preview.redraw();
    }

  }

}

function toggled(paused) {
  d3.select("#pause").classed("hidden", paused);
  d3.select("#play").classed("hidden", !paused);
}

function toggle() {
  if (isPlaying()) {
    pause();
  } else {
    play();
  }
}

function _extent(_) {

  if (arguments.length) {

    extent = _;

    var pos = audio.currentTime / audio.duration;

    if (pos > extent[1] || audio.duration * extent[0] - audio.currentTime > 0.2 || !isPlaying()) {
      pause(extent[0] * audio.duration);
    }

    minimap.time(pos);

  } else {
    return extent;
  }
}

function src(file, cb) {

  d3.select("audio")
    .on("canplaythrough", cb)
    .on("error", function(){
      cb(d3.event.target.error);
    })
    .select("source")
      .attr("type", file.type)
      .attr("src", URL.createObjectURL(file));

  audio.load();

}

function isPlaying() {
  return audio.duration && !audio.paused && !audio.ended && 0 < audio.currentTime;
}

function _duration() {
  return audio.duration;
}

function _currentTime(_) {
  return arguments.length ? audio.currentTime = _ : audio.currentTime;
}

function init() {
    d3.select(document).on('keydown', function() {
        if (!d3.select('body').classed('rendered') && !d3.matcher("input, textarea, button, select, [contenteditable='true']").call(d3.event.target)) {
            var start = extent[0] * audio.duration,
                end = extent[1] * audio.duration,
                duration = audio.duration;
            current = audio.currentTime;
            switch (d3.event.key) {
                case ' ':
                    toggle();
                    utils.stopIt(d3.event);
                    break;
                case 'ArrowLeft':
                    if (d3.event.shiftKey) {
                        _currentTime(current - 10);
                    } else if (d3.event.ctrlKey || d3.event.metaKey) {
                        _currentTime(current - 1);
                    } else {
                        _currentTime(current - 0.1);
                    }
                    utils.stopIt(d3.event);
                    break;
                case 'ArrowRight':
                    if (d3.event.shiftKey) {
                        _currentTime(current + 10);
                    } else if (d3.event.ctrlKey || d3.event.metaKey) {
                        _currentTime(current + 1);
                    } else {
                        _currentTime(current + 0.1);
                    }
                    utils.stopIt(d3.event);
                    break;
                case 'q':
                    _currentTime(start);
                    utils.stopIt(d3.event);
                    break;
                case 'w':
                    pause();
                    _currentTime(end);
                    utils.stopIt(d3.event);
                    break;
                case 'i':
                    minimap.updateTrim([current, null]);
                    utils.stopIt(d3.event);
                    break;
                case 'o':
                    minimap.updateTrim([null, current]);
                    utils.stopIt(d3.event);
                    break;
                case '5':
                    play(start, start + 1, start);
                    utils.stopIt(d3.event);
                    break;
                case '6':
                    play(end - 1, end);
                    utils.stopIt(d3.event);
                    break;
            }
        }
    });
    
    d3.selectAll("#play").on("click", function() {
      d3.event.preventDefault();
      toggle();
      utils.stats("increment", "user_activity.playback.play");
    });
    d3.selectAll("#pause").on("click", function() {
      d3.event.preventDefault();
      toggle();
      utils.stats("increment", "user_activity.playback.pause");
    });

    d3.select('#restart').on('click', function() {
      d3.event.preventDefault();
      restart();
      utils.stats("increment", "user_activity.playback.restart");
    });
    
    d3.select('#minimap .controls .tip a').on('click', function() {
      jQuery('#shortcuts').toggleClass('hidden');
      utils.stopIt(d3.event);
    });

    jQuery(document).on('change', '#playbackRate select', function(e){
      var rate = jQuery(this).val();
      audio.playbackRate = rate;
      jQuery('#playbackRate').attr('data-rate', rate);
      jQuery('#playbackRate').tooltip('destroy');
      utils.stats("increment", "user_activity.playback.rate");
    });

}

module.exports = {
  play: play,
  pause: pause,
  toggle: toggle,
  src: src,
  restart: restart,
  isPlaying: isPlaying,
  extent: _extent,
  currentTime: _currentTime,
  duration: _duration,
  init
};
