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

function save(req, res) {
  console.log(req.body);
  var id = req.body.id;
  var title = req.body.title;
  var tmp = req.body.path;
  var user = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : 'local';

  // Move file
  var dest = path.join(__dirname, "../settings/backgrounds/", id);
  fs.copySync(tmp, dest);

  var ident = { id, title, user };
  redisClient.sadd("audiogram:idents", JSON.stringify(ident), function (error, reply){
    if (error) return res.json({error});
    return res.json(ident);
  });

}

function list(req, res) {

  redisClient.lrange("audiogram:idents", 0, -1, function(err, reply){
    console.log(reply);
    return res.json({reply});
  });

}

module.exports = {
  save,
  list
};