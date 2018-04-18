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

redisClient.on("error", function(err) {
  console.log("REDIS ERROR>> \n", err);
});
    
function save(req, res) {
  var newTheme = JSON.parse(req.body.theme);
  delete newTheme.audioPath;
  delete newTheme.customBackgroundPath;
  delete newTheme.customForegroundPath;

  if (req.body.background) {
    var backgroundPath = req.body.background;
    if (backgroundPath.includes("/")) {
      var src = req.body.background;
      var filename = uuidv4();
      var dest = path.join(__dirname, "../settings/backgrounds/", filename);
      fs.copySync(backgroundPath, dest);
      newTheme.backgroundImage = filename;
    }
  } else if (newTheme.backgroundImage && newTheme.backgroundImage.landscape) {
    newTheme.backgroundImage = newTheme.backgroundImage.landscape;
  } else {
    delete newTheme.backgroundImage;
  }
  if (req.body.foreground) {
    var foregroundPath = req.body.foreground;
    if (foregroundPath.includes("/")) {
      var src = req.body.foreground;
      var filename = uuidv4();
      var dest = path.join(__dirname, "../settings/backgrounds/", filename);
      fs.copySync(foregroundPath, dest);
      newTheme.foregroundImage = filename;
    }
  } else if (newTheme.foregroundImage && newTheme.foregroundImage.landscape) {
    newTheme.foregroundImage = newTheme.foregroundImage.landscape;
  } else {
    delete newTheme.foregroundImage;
  }

  newTheme.id = uuidv4();
  var email = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : null;

  redisClient.hset(`audiogram:theme:${newTheme.id}`, "id", newTheme.id);
  redisClient.hset(`audiogram:theme:${newTheme.id}`, "name", newTheme.name);
  redisClient.hset(`audiogram:theme:${newTheme.id}`, "config", JSON.stringify(newTheme));
  if (email) redisClient.hset(`audiogram:theme:${newTheme.id}`, "user", email);
  redisClient.hset(`audiogram:theme:${newTheme.id}`, "created", new Date(Date.now()));

  var preview = req.body.preview.replace(/^data:image\/png;base64,/, "");
  var previewDest = path.join(__dirname, "../settings/themes/", newTheme.id);
  fs.writeFile(previewDest, preview, 'base64', function(err){
    if (err) return res.json({ error: err });
    return res.json({ id: newTheme.id });
  });

}

function list(req, res) {

  function scan(cursor, themes, cb) {
    redisClient.scan(cursor, "MATCH", "audiogram:theme:*", function(err, reply) {
      if (err || !reply) return cb(err || "No themes found");
      cursor = reply[0];
      var keys = reply[1];
      var multi = redisClient.multi();
      keys.forEach(function(key, i) {
        multi.hmget(key, ['id', 'name', 'user', 'created']);
      });
      multi.exec(function(err, multiReply){
        if (err || !multiReply) return cb(err || "No themes found");
        for (let i = 0; i < multiReply.length; i++) {
          var id = multiReply[i][0];
          var name = multiReply[i][1];
          var user = multiReply[i][2];
          var created = multiReply[i][3];
          if (id) themes.push({id, name, user, created});
        }
        if (cursor === "0") {
          return cb(null, themes);
        } else {
          scan(cursor, themes, cb);
        }
      });
    });
  }

  scan("0", [], function(err, list) {
    if (err) return res.json({ error: err });
    sorted = _.sortBy(list, [item => item.name.toLowerCase()]);
    return res.json({ themes: sorted });
  });

}

function get(req, res) {
  redisClient.hget(`audiogram:theme:${req.params.id}`, "config", function(err, reply) {
    if (err || !reply) return res.json({ error: err || "Config not found" });
    var config = JSON.parse(reply);
    return res.json({ config });
  });
}

function add(req, res) {

  delete require.cache[require.resolve('../settings/themes.json')];
  var themes = require('../settings/themes.json'),
    themFile = path.join(__dirname, "../settings/themes.json");

  // Make a backup first
  fs.writeFile(themFile + ".bk" + (+ new Date()), JSON.stringify(themes,null,'\t'), function(err){
    if(err) console.log("Error making theme.json backup: " + err);
  });

  // Get new theme
  var newTheme = JSON.parse(req.body.theme);
  delete newTheme.audioPath;
  delete newTheme.customBackgroundPath;
  delete newTheme.customForegroundPath;

  if (req.body.background) {
    var backgroundPath = req.body.background;
    if (backgroundPath.includes('/')) {
      var src = req.body.background;
      var filename = uuidv4();
      var dest = path.join(__dirname, '../settings/backgrounds/', filename);
      fs.copySync(backgroundPath, dest);
      newTheme.backgroundImage = Array.isArray(newTheme.backgroundImage) ? filename : { landscape: filename, portrait: filename, square: filename }; 					
    }
  } else if (newTheme.backgroundImage) {
    newTheme.backgroundImage = Array.isArray(newTheme.backgroundImage) ? newTheme.backgroundImage : { landscape: newTheme.backgroundImage, portrait: newTheme.backgroundImage, square: newTheme.backgroundImage };
  } else {
    delete newTheme.backgroundImage;
  }
  if (req.body.foreground) {
    var foregroundPath = req.body.foreground;
    if (foregroundPath.includes("/")) {
      var src = req.body.foreground;
      var filename = uuidv4();
      var dest = path.join(__dirname, "../settings/backgrounds/", filename);
      fs.copySync(foregroundPath, dest);
      newTheme.foregroundImage = Array.isArray(newTheme.backgroundImage) ? filename : { landscape: filename, portrait: filename, square: filename };
    }
  } else if (newTheme.foregroundImage) {
    newTheme.foregroundImage = Array.isArray(newTheme.foregroundImage) ? newTheme.foregroundImage : { landscape: newTheme.foregroundImage, portrait: newTheme.foregroundImage, square: newTheme.foregroundImage };
  } else {
    delete newTheme.foregroundImage;
  }

  // Add theme
  themes[newTheme.name] = newTheme;

  // Sort alphabetically
  var keys = Object.keys(themes),
    i, len = keys.length,
    newThemes = {};
  keys.sort(function (a, b) {
      return a.toLowerCase().localeCompare(b.toLowerCase());
  });
  newThemes["default"] = themes["default"];
  newThemes["Custom"] = themes["Custom"];
  for (i = 0; i < len; i++) {
    k = keys[i];
    if (k!="default" && k!="Custom") {
      newThemes[k] = themes[k];
    }
  }

  // Save themes
  var newJSON = JSON.stringify(newThemes,null,'\t');
  fs.writeFile(themFile, newJSON, function(err){
    delete require.cache[require.resolve('../settings/themes.json')];
    if (err) {
      return res.json({error: err});
    } else {
      return res.json({error: null});
    }
  });

}

module.exports = {
  add: add,
  save,
  get,
  list
};