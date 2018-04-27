var serverSettings = require("../lib/settings/"),
stats = require('../lib/stats'),
spawn = require("child_process").spawn,
path = require("path"),
_ = require("underscore"),
fs = require("fs"),
logger = require("../lib/logger"),
transports = require("../lib/transports"),
uuidv4 = require('uuid/v4');

var redisHost = require("../settings/").redisHost;
var redis = require("redis");
var redisClient = redis.createClient({ host: redisHost });
var prefix = "audiogram:";
var user = null;

redisClient.on("error", function (err) {
  console.log('REDIS ERROR>> \n', err);
});

function validate(req, res, next) {
  
  console.log("RLW validating");

  if (req.header("host").startsWith("localhost")) {
    user = "localhost@audiogram.newslabs.co";
  } else {
    user = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : null;
  }
  
  try {
    
    req.body.theme = JSON.parse(req.body.theme);
    req.body.media = JSON.parse(req.body.media);
    
  } catch(e) {
    
    return res.status(500).send("Unknown settings error.");
    
  }
  
  if (!req.body.media.audio || !req.body.media.audio.path) {
    return res.status(500).send("No valid audio received.");
  }
  
  var needToReupload = false;
  var audioMissing = req.body.media.audio && !fs.existsSync(req.body.media.audio.path);
  var backgroundMissing = req.body.media.background && !fs.existsSync(req.body.media.background.path);
  var foregroundMissing = req.body.media.foreground && !fs.existsSync(req.body.media.foreground.path);
  if (audioMissing && !req.body.media.audio.dest) needToReupload = true;
  if (backgroundMissing && !req.body.media.background.dest) needToReupload = true;
  if (foregroundMissing && !req.body.media.foreground.dest) needToReupload = true;

  if (needToReupload) {
    console.log("needToReupload");
    return res.json({error: "reupload"});
  }
  
  // Start at the beginning, or specified time
  if (req.body.start) {
    req.body.start = +req.body.start;
  }
  
  if (req.body.end) {
    req.body.end = +req.body.end;
  }
  
  next();
  
}

function route(req, res) {
    
  console.log("RLW routing");
  var jobId = uuidv4();
  
  if (req.body.media.background) {
    var backgroundExists = req.body.media.background.dest && fs.existsSync(path.join(__dirname, "../media", req.body.media.background.dest));
    if (!backgroundExists) {
      var backgroundSrc = req.body.media.background.path;
      if (!fs.existsSync(backgroundSrc)) {
        console.log("reuploading background");
        return res.json({ error: "reupload" });
      }
      var backgroundId = req.body.media.background.id;
      var backgroundExt = req.body.media.background.mimetype.split("/").pop();
      var backgroundImagePath = "background/" + backgroundId + "." + backgroundExt;
      req.body.media.background.dest = backgroundImagePath;
      if (req.body.media.background.path == req.body.media.audio.path) req.body.media.audio.dest = backgroundImagePath;
      transports.uploadBackground(backgroundSrc, backgroundImagePath, function(err) {
        if (err) {
          return res.status(500).send(err);
        }
        if (fs.existsSync(backgroundSrc)) fs.unlinkSync(backgroundSrc);
      });
    }
  }
  
  if (req.body.media.foreground) {
    var foregroundExists = req.body.media.foreground.dest && fs.existsSync(path.join(__dirname, "../media", req.body.media.foreground.dest));
    if (!foregroundExists) {
      var foregroundSrc = req.body.media.foreground.path;
      if (!fs.existsSync(foregroundSrc)) {
        console.log("reuploading foreground");
        return res.json({ error: "reupload" });
      }
      var foregroundId = req.body.media.foreground.id;
      var foregroundExt = req.body.media.foreground.mimetype.split("/").pop();
      var foregroundImagePath = "foreground/" + foregroundId + "." + foregroundExt;
      req.body.media.foreground.dest = foregroundImagePath;
      transports.uploadBackground(foregroundSrc, foregroundImagePath, function(err) {
        if (err) {
          return res.status(500).send(err);
        }
        fs.unlinkSync(foregroundSrc);
      });
    }
  }
  
  var audioExists = req.body.media.audio.dest && fs.existsSync(path.join(__dirname, "../media", req.body.media.audio.dest));  
  if (!audioExists) {
    var audioSrc = req.body.media.audio.path;
    if (!fs.existsSync(audioSrc)) {
      console.log("reuploading audio");
      return res.json({ error: "reupload" });
    }
    var audioId = req.body.media.audio.id;
    var audioType = req.body.media.audio.mimetype;
    var audioExt = audioType.split("/").pop();
    audioExt = audioExt == "mpeg" ? "mp3" : audioExt;
    audioExt = audioExt.includes("wav") ? "wav" : audioExt;
    if (audioExt !== "mp3" && audioExt !== "wav" && audioExt !== "mp4" && audioExt !== "mov") {
      return res.json({ error: `Audio file type ${audioExt} invalid` });
    }
    var audioPath = "audio/" + jobId + "." + audioExt;
    req.body.media.audio.dest = audioPath;
    transports.uploadAudio(audioSrc, audioPath, function(err) {
      if (err) {
        console.log("RLW routing err", err);
        return res.status(500).send(err);
      }
      if (fs.existsSync(audioSrc)) fs.unlinkSync(audioSrc);
      runJob();
    });
  } else {
    runJob();
  }
    
  function runJob() {
    // Queue up the job with a timestamp
    var themeWithBackgroundImage =  _.extend(req.body.theme, 
      { 
        audioPath: req.body.media.audio.dest,
        customBackgroundPath: req.body.media.background ? req.body.media.background.dest : null,
        customForegroundPath: req.body.media.foreground ? req.body.media.foreground.dest: null
      }
    );
    var job = _.extend({ id: jobId, created: (new Date()).getTime(), media: req.body.media, theme: themeWithBackgroundImage }, req.body);
    transports.addJob(job);
    sendStats(job);
    updateUserInfo(job);
    
    res.json({ id: jobId, media: req.body.media });
    
    // If there's no separate worker, spawn one right away
    if (!serverSettings.worker) {
      
      logger.debug("Spawning worker");
      
      // Empty args to avoid child_process Linux error
      spawn("bin/worker", [], {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
        env: _.extend({}, process.env, { SPAWNED: true })
      });
      
    }
  }

  function updateUserInfo(job) {
    var themeId = job.theme.id;
    console.log(`audiogram:user:config:${user}`);
    redisClient.hget(`audiogram:user:config:${user}`, "themes_recent", function(err, themes){
      console.log('THEMES...', user, themes);
      if (!err && themes) {
        var themes = JSON.parse(themes);
        console.log(themes);
      }
    });
    
  }

  function sendStats(job) {

    // Render
    var renderType = +job.reversion ? 'reversion' : 'new';
    stats.increment(`render.${renderType}`);

    // Method
    var method = job.media.background && job.media.background.mimetype.startsWith("video") && job.theme.pattern == 'none' ? 'overlay' : 'frames';
    stats.increment(`render.method.${method}`); 

    // Theme
    var themeName = job.theme.name.replace(/ /g, '_');
    stats.increment(`render.theme.${themeName}`);    

    // Waveform
    stats.increment(`render.waveform.${job.theme.pattern}`);        

    // Subtitles
    var transcript = JSON.parse(job.transcript);
    var subsEnabled = transcript && + job.theme.subtitles.enabled ? "on" : "off";
    stats.increment(`render.subtitles.${subsEnabled}`);

    // Transcript
    if (transcript && +job.theme.subtitles.enabled) {
      var origWords = 0;
      var editedWords = 0;
      var addedWords = 0;
      transcript.segments.forEach(segment => {
          segment.words.forEach(word => {
            if (!word.orig) {
              addedWords++;
            } else if (word.text.toLowerCase() === word.orig.toLowerCase()) {
              origWords++;
            } else {
              editedWords++;
            }
          });
        });
      var transcriptType = (origWords == 0 && editedWords == 0) ? 'manual' : 'kaldi';
      if (renderType==='new') {
        stats.increment(`transcript.${transcriptType}`);
      }
      if (transcriptType==='kaldi') {
        stats.increment('transcript.kaldi.words.original', origWords);
        stats.increment('transcript.kaldi.words.edited', editedWords);
        stats.increment('transcript.kaldi.words.added', addedWords);
      }
    }

  }
  
};

module.exports = {
  validate: validate,
  route: route
};
