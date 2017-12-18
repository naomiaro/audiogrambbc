var queue = require("d3").queue;

const PROCESSES = {};
function getPid(id) {
  return PROCESSES[id];
}

function splitFrames(options, pidCb, cb) {
  cb = cb || pidCb;
  var q = queue(1);

  function run(args, callback) {
    var stderr = "";
    var spawn = require("child_process").spawn;
    var command = spawn("ffmpeg", args);
    PROCESSES[options.id] = command.pid;
    command.stderr.on("data", function(data) {
      var buff = new Buffer(data);
      stderr += buff.toString("utf8");
    });
    command.on("exit", function() {
      command.kill();
      delete PROCESSES[options.id];
      if (callback) return callback(stderr);
    });
    return command.pid;
  }

  function getFps(callback) {
    callback(null, 25);
    // Get framerate of video
    // run(['-i', options.origin], function(stderr){
    //   var fps = parseFloat((stderr+'').split('fps').shift().split(',').pop());
    //   callback(null,fps);
    // });
  }

  function makeFrames(callback) {
    // Trim and split into frames
    var arguments = ["-loglevel", "fatal", "-i", options.origin, "-r", 25];
    if (options.duration) {
      arguments.push("-vf", "select='gt(t,0)*lt(t," + options.duration + ")'");
    }
    arguments.push(options.destination + "/%06d.png");
    run(arguments, callback(null));
  }

  q
    .defer(getFps)
    .defer(makeFrames)
    .await(function(err, fps) {
      if (cb) return cb(err, fps);
    });
}

module.exports = {
  splitFrames,
  getPid
};
