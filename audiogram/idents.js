'use strict';
var path = require("path");
var fs = require("fs");

function idents(options, cb) {

  console.log(options);

  function run(args, callback) {
    var err;
    var progress = 0;
    var spawn = require("child_process").spawn;
    var command = spawn("ffmpeg", args, {shell: true});
    command.stderr.on('data', function(data) {
      var line = data.toString();
      if (line.startsWith('frame=')){
        // var time = line.split('time=')[1].split(' ')[0];
        // var secs = ffmpegSecs(time);
        // progress = Math.round((secs / options.backgroundInfo.duration) * 100) / 100;
        // options.progress(progress);
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
  
  
  var args = ['-loglevel', 'info'];
  var count = 0;
  
  if (options.idents.pre) {
    var src = path.join(__dirname, "..", "settings", "backgrounds", options.idents.pre.id);
    args.push('-i', src);
    count++;
  }
  
  args.push('-i', options.videoPath);  
  
  if (options.idents.post) {
    var src = path.join(__dirname, "..", "settings", "backgrounds", options.idents.post.id);
    args.push('-i', src);
    count++;
  }
  
  // ffmpeg -i R4Today_landscape.mp4 -i ag.mp4 -filter_complex "[0:v] [0:a] [1:v] [1:a] concat=n=2:v=1:a=1 [v] [a]" -map "[v]" -map "[a]" testoutput.mp4
  // ' \ -map '[v]' -map '[a1]' -map '[a2]' output.mkv
  
  args.push('-filter_complex');

  if (options.idents.pre && options.idents.post) {
    args.push('"[0:v:0][0:a:0][1:v:0][1:a:0][2:v:0][2:a:0]concat=n=3:v=1:a=1[outv][outa]"');
    args.push('-map', '"[outv]"');
    args.push('-map', '"[outa]"');
  } else {
    args.push('"[0:v] [0:a] [1:v] [1:a] concat=n=2:v=1:a=1 [v] [a]"');
    args.push('-map', '"[v]"');
    args.push('-map', '"[a]"');
  }

  var destination = path.join(options.dest, 'withidents.mp4');
  args.push(destination);

  console.log('IDENTS FFMPEG ===', args.join(' '));

  run(args, function(err){
    if (err) return cb(err);
    fs.unlinkSync(options.videoPath);
    fs.renameSync(destination, options.videoPath);
    return cb(null);
  });

  
  

  // var args = [
  //   '-loglevel', 'info',
  //   '-r', options.framesPerSecond,
  //   '-i', options.framePath,
  //   '-i', options.audioPath,
  //   '-c:v', 'libx264',
  //   '-c:a', 'aac',
  //   '-strict', 'experimental',
  //   '-shortest',
  //   '-pix_fmt', 'yuv420p', options.videoPath
  // ];


  // run(args, function(err){cb(err)});

}


module.exports = idents;