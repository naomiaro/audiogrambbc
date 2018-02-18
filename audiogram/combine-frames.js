function combineFrames(options, cb) {

  function run(args, callback) {
    var err;
    var spawn = require("child_process").spawn;
    var command = spawn("ffmpeg", args, {shell: true});
    command.stderr.on('data', function(data) {
      err = "combineFrames - ffmpeg error: " + data;
    });
    command.on('exit', function() {
      return callback(err);
    });
  }
  
  if (options.method == 'overlay') {

    var path = options.framePath.split('/').slice(0, -1).join('/');
    var args = [
      '-loglevel', 'fatal',
      '-i', options.backgroundVideoPath,
      '-i', `${path}/${zeropad(1)}.jpg`
    ];
    for (let i = 0; i < options.subtitles.length; i++) {
      args.push('-i');
      args.push(`${path}/${zeropad(i + 2)}.jpg`);
    }
    var filter = `[0]scale=${options.size.width}:${options.size.height}[bg]; [bg][1]overlay=0:0[v1]; `;
    for (let i = 0; i < options.subtitles.length; i++) {
      var vIn = i + 1;
      var vOut = i + 2;
      var start = options.subtitles[i].start;
      var end = options.subtitles[i].end;
      filter += `[v${vIn}][${vOut}]overlay=0:0:enable='between(t,${start},${end})'[v${vOut}]`;
      filter += (i < options.subtitles.length - 1) ? '; ' : ' ';
    }
    args.push('-filter_complex');
    args.push(`"${filter.trim()}"`);
    args.push('-map');
    args.push(`"[v${options.subtitles.length + 1}]"`);
    args.push('-map');
    args.push('0:a');
    args.push(options.videoPath);

  } else {

    var args = [
      '-loglevel', 'fatal',
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

function zeropad(str, len) {
  len = len || 6;
  str = str.toString();
  while (str.length < len) {
    str = "0" + str;
  }
  return str;
}

module.exports = combineFrames;