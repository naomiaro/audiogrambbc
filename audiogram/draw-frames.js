'use strict';

var fs = require("fs"),
    path = require("path"),
    Canvas = require("canvas"),
    subtitles = require("../renderer/subtitles.js"),
    queue = require("d3").queue;

function drawFrames(renderer, options, cb) {

  var frameQueue = queue(10),
      canvases = [],
      theme = renderer.theme();

  for (var i = 0; i < 10; i++) {
    canvases.push(new Canvas(options.width, options.height));
  }

  // if (theme.subtitles.enabled && options.subtitles) {
  //   frameQueue.defer(subtitles.format, {subtitles: options.subtitles, theme: theme, trim: {start: options.start, end: options.end}});
  // }

  if (options.method == 'overlay') {
    frameQueue.defer(drawFrame, 0, []);
    options.subtitles.forEach((subs, i) => {
      subs.start = 0;
      subs.end = options.end;
      frameQueue.defer(drawFrame, i+1, [subs]);
    });
  } else {
    for (var i = +options.frames.start; i < +options.frames.end; i++) {
      frameQueue.defer(drawFrame, i);
    }
  }

  frameQueue.awaitAll(cb);

  function loadVideoFrame(options, frameNumber, imgCb) {
      if (options.method !== 'overlay' && options.backgroundInfo.type.startsWith("video")) {
        // If we're using a background video, load the respective frame still as background iamge
        var bgFrame = (frameNumber + 1) % options.backgroundInfo.frames || options.backgroundInfo.frames;
        var bg = new Canvas.Image;
        bg.onload = function(){
          renderer.backgroundImage(bg);
          return imgCb(null);
        };
        bg.onerror = function(e){
          return imgCb(e);
        };
        var frameSrc = path.join(options.backgroundFrameDir, "/" + zeropad(bgFrame, 6) + ".png");
        var i = 1;
        function addSrc() {
          // Wait for frame to exist (async ffmpeg process for making frames sometimes takes too long)
          if (fs.existsSync(frameSrc)) {
            bg.src = frameSrc;
            return;
          } else if (i<60) {
            setTimeout(addSrc,2000);
          } else {
            return imgCb("Background video frame not loaded in time (" + frameSrc + ")");
          }
          i++;
        }
        addSrc();
      } else {
        return imgCb(null);
      }
  }

  function drawFrame(frameNumber, subs, frameCallback) {
    if (!frameCallback) {
      frameCallback = subs;
      subs = null;
    }

    var drawQueue = queue(1);
    var canvas = canvases.pop(),
        context = canvas.getContext("2d");

    drawQueue.defer(loadVideoFrame, options, frameNumber);
    drawQueue.await(function(err){
      if (err) return frameCallback(err);
      renderer.drawFrame(context, {
        method: options.method,
        caption: options.caption,
        subtitles: subs || options.subtitles,
        waveform: options.waveform ? options.waveform[frameNumber] : null,
        backgroundInfo: options.backgroundInfo,
        start: options.start,
        end: options.end,
        fps: options.fps,
        frame: frameNumber
      });

      const fileType = (options.method == 'overlay') ? 'png' : 'jpg';
      const destination = path.join(options.frameDir, zeropad(frameNumber + 1, 6) + `.${fileType}`);

      if (options.method == 'overlay') {
        canvas.toBuffer(function (err, buf) {
          if (err) {
            return cb(err);
          }
          fs.writeFile(destination, buf, function (writeErr) {
            if (writeErr) {
              return frameCallback(writeErr);
            }
            if (options.tick) {
              options.tick();
            }
            canvases.push(canvas);
            return frameCallback(null);
          });
        });
      } else {
        var out = fs.createWriteStream(destination);
        var stream = canvas.createJPEGStream({
          bufsize: 2048,
          quality: 80
        });
        stream.pipe(out);
        out.on('finish', function(){
          if (options.tick) {
            options.tick();
          }
          canvases.push(canvas);
          return frameCallback(null);
        });
      }

    });

  }

}

function zeropad(str, len) {

  str = str ? str.toString() : "0";

  while (str.length < len) {
    str = "0" + str;
  }

  return str;

}

module.exports = drawFrames;
