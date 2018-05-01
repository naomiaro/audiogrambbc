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
  // command.stderr.on('data', function (data) {
  //   var line = data.toString();
  //   console.log('FFMPEG :: ', line);
  // });
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
  var ident = { id, title, user };
  redisClient.rpush("audiogram:idents", JSON.stringify(ident), function (error, reply){
    if (error) return res.json({error});
    saveGif(dest, function(){
      return res.json(ident);
    });
  });
}

function list(req, res) {
  redisClient.lrange("audiogram:idents", 0, -1, function (error, idents){
    if (error) return res.json({ error });
    return res.json({idents});
  });
}

module.exports = {
  save,
  list
};