'use strict';

function combineFrames(options, cb) {

  function run(args, callback) {
    var err;
    var progress = 0;
    var spawn = require("child_process").spawn;
    var command = spawn("ffmpeg", args, {shell: true});
    command.stderr.on('data', function(data) {
      var line = data.toString();
      if (line.startsWith('frame=')){
        var time = line.split('time=')[1].split(' ')[0];
        var secs = ffmpegSecs(time);
        progress = Math.round((secs / options.backgroundInfo.duration) * 100) / 100;
        options.progress(progress);
      } else {
        err = data;
      }
    });
    command.on('exit', function() {
      if (err.toString().startsWith('[aac')) err = null;
      if (err) err = (progress < 1) ? `ffmpeg error: [${progress}] ${err}` : null;
      return callback(err);
    });
  }
  
  if (options.method == 'overlay') {

    var path = options.framePath.split('/').slice(0, -1).join('/');
    var args = [
      '-loglevel', 'info',
      '-i', options.backgroundVideoPath,
      '-i', `${path}/${zeropad(1)}.png`
    ];
    // Add subtitle sources
      for (let i = 0; i < options.subtitles.length; i++) {
        args.push('-i');
        args.push(`${path}/${zeropad(i + 2)}.png`);
      }
    // Build Filter - Crop
      var filter = `[0]`;
      var targetSize = options.size;
      var srcSize = options.backgroundInfo;
      // Align crop
        var align = options.backgroundPosition.align;
        var x = '(in_w-out_w)/2';
        var y = '(in_h-out_h)/2';
        if (align.x == 'left') x = '0';
        if (align.x == 'right') x = '(in_w-out_w)';
        if (align.y == 'bottom') y = '(in_h-out_h)';
        if (align.y == 'top') y = '0';  
        var origin = `${x}:${y}`;    
      // Square
      if (targetSize.width == targetSize.height && srcSize.width !== srcSize.height) {
        var minEdge = (srcSize.height < srcSize.width) ? 'in_h' : 'in_w';
        filter = `[0]crop=${minEdge}:${minEdge}:${origin}[bg]; [bg]`;
      // Landscape
      } else if (targetSize.width > targetSize.height && srcSize.width <= srcSize.height) {
        filter = `[0]crop=in_w:(in_w)/(16/9):${origin}[bg]; [bg]`;
      // Portrait
      } else if (targetSize.width < targetSize.height && srcSize.width >= srcSize.height) {
        filter = `[0]crop=(in_h)/(16/9):in_h:${origin}[bg]; [bg]`;
      }
    // Build Filter - Scale
      filter += `scale=${options.size.width}:${options.size.height}[v0]; `;
    // Build Filter - Add consistent overlay
      filter += '[v0][1]overlay=0:0[v1]';
    // Build Filter - Subtitle overlay timings
      filter += (options.subtitles.length) ? '; ' : ' ';
      for (let i = 0; i < options.subtitles.length; i++) {
        var vIn = i + 1;
        var vOut = i + 2;
        var start = options.subtitles[i].start;
        var end = options.subtitles[i].end;
        filter += `[v${vIn}][${vOut}]overlay=0:0:enable='between(t,${start},${end})'[v${vOut}]`;
        filter += (i < options.subtitles.length - 1) ? '; ' : ' ';
      }
    // Add filters
      args.push('-filter_complex');
      args.push(`"${filter.trim()}"`);
      args.push('-map');
      args.push(`"[v${options.subtitles.length + 1}]"`);
      args.push('-map');
      args.push('0:a');
    // Preset
      args.push('-preset');
      args.push('veryfast');
    // Add output destination
      args.push(options.videoPath);

  } else {

    var args = [
      '-loglevel', 'info',
      '-r', options.framesPerSecond,
      '-i', options.framePath,
      '-i', options.audioPath,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-strict', 'experimental',
      '-shortest',
      '-pix_fmt', 'yuv420p', options.videoPath
    ];

  }

  run(args, function(err){cb(err)});

}

function ffmpegSecs(str) {
  var time = str.split(':');
  var sec = 0;
  var place = 0;
  for (var i = time.length - 1; i >= 0; i--) {
    sec += +time[i].replace(/[^\d.-]/g, '') * Math.pow(60, place);
    place++;
  }
  return sec;
}

function zeropad(str, len) {
  len = len || 6;
  str = str.toString();
  while (str.length < len) {
    str = "0" + str;
  }
  return str;
}

module.exports = combineFrames;