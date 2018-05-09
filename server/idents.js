var serverSettings = require("../lib/settings/");
var fs = require('fs-extra');
var path = require("path");
var _ = require("lodash");
var uuidv4 = require('uuid/v4');
var transports = require("../lib/transports");

var stats = require("../lib/stats");
var redisHost = require("../settings/").redisHost;
var redis = require("redis");
var redisClient = redis.createClient({ host: redisHost });
var prefix = "audiogram:";

redisClient.on("error", function (err) {
  console.log("REDIS ERROR>> \n", err);
});

function getSize(path, cb) {
  var args = [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "csv=s=x:p=0",
    path
  ];
  var spawn = require("child_process").spawn;
  var command = spawn("ffprobe", args, { shell: true });
  command.stdout.on('data', function (data) {
    var size = data.toString().split('x');
    return cb(null, { width: +size[0], height: +size[1] });
  });
}

function getOrientation(size) {
  if (size.width == size.height) {
    return 'square';
  } else if (size.width > size.height) {
    return 'landscape';
  } else {
    return 'portrait';
  }
}

function resize(path, cb) {
  getSize(path, function(err, size){
    // ffmpeg -i input.avi -vf scale=320:240 output.avi
    if (!size || !size.height || !size.width) {
      return cb('Error resizing video');
    }
    if (size.width == size.height) {
      var width = 1080;
      var height = 1080;
    } else if (size.width > size.height) {
      var width = 1920;
      var height = 1080;
    } else {
      var width = 1080;
      var height = 1920;
    }
    var args = [
      "-i", path,
      "-vf", `scale=${width}:${height}`,
      `${path}-resized.mp4`
    ];
    var spawn = require("child_process").spawn;
    var command = spawn("ffmpeg", args, { shell: true });
    command.on('exit', function () {
      fs.unlinkSync(path);
      fs.renameSync(`${path}-resized.mp4`, path);
      return cb(null, size);
    });

  });
}

function saveGif(path, cb) {
  // ffmpeg -i 4a2b6f80-251d-11e8-ac72-27edede43ff0.mp4 -r 10 -ss 0 -t 10 -vf scale=-1:110 TEST.gif
  var args = [
    "-i", path,
    "-r", "10",
    "-ss", "0",
    "-t", "10",
    "-vf", "scale=-1:110",
    path + ".gif"
  ];
  var spawn = require("child_process").spawn;
  var command = spawn("ffmpeg", args, { shell: true });
  command.on('exit', function () {
    return cb(null);
  });
}

function save(req, res) {
  var id = req.body.id;
  var title = req.body.title;
  var tmp = req.body.path;
  var user = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : 'local';
  var dest = path.join(__dirname, "../settings/backgrounds/", id);
  fs.copySync(tmp, dest);
  saveGif(dest, function (error) {
    if (error) return res.json({ error });
    resize(dest, function (error, size) {
      if (error) return res.json({ error });
      var orientation = getOrientation(size);
      var ident = { id, title, orientation, user };
      redisClient.rpush("audiogram:idents", JSON.stringify(ident), function (error, reply) {
        if (error) return res.json({ error });
        return res.json(ident);
      });
    });
  });
}

function list(req, res) {
  redisClient.lrange("audiogram:idents", 0, -1, function (error, idents){
    if (error) return res.json({ error });
    idents = idents.map(function(ident){
      return JSON.parse(ident);
    });
    idents = _.orderBy(idents, [ident => ident.title.toLowerCase()]);
    return res.json({idents});
  });
}

module.exports = {
  save,
  list
};