var path = require("path"),
    queue = require("d3").queue,
    mkdirp = require("mkdirp"),
    rimraf = require("rimraf"),
    stats = require('../lib/stats'),
    serverSettings = require("../lib/settings/"),
    transports = require("../lib/transports/"),
    logger = require("../lib/logger/"),
    Profiler = require("../lib/profiler.js"),
    probe = require("../lib/probe.js"),
    getWaveform = require("./waveform.js"),
    initializeCanvas = require("./initialize-canvas.js"),
    drawFrames = require("./draw-frames.js"),
    subtitles = require("../renderer/subtitles.js"),
    combineFrames = require("./combine-frames.js"),
    backgroundVideo = require("./background-video.js"),
    trimAudio = require("./trim.js"),
    spawn = require("child_process").spawn,
    os = require('os'),
    _ = require("underscore");

function Audiogram(id) {

  // Unique audiogram ID
  this.id = id;
  this.set("id",id);

  // File locations to use
  this.dir = path.join(serverSettings.workingDirectory, this.id);

  this.audioPath = path.join(this.dir, "audio");
  this.backgroundPath = path.join(this.dir, "background");
  this.backgroundFrameDir = path.join(this.dir, "backgroundFrames");
  this.videoPath = path.join(this.dir, "video.mp4");
  this.frameDir = path.join(this.dir, "frames");

  this.profiler = new Profiler();

  return this;

}

// Get the waveform data from the audio file, split into frames
Audiogram.prototype.getWaveform = function(cb) {

  var self = this;

  this.status("probing");

  probe(this.audioPath, function(err, data){

    if (err) {
      return cb(err);
    }

    if (self.settings.theme.maxDuration && self.settings.theme.maxDuration < data.duration) {
      return cb("Exceeds max duration of " + self.settings.theme.maxDuration + "s");
    }

    self.profiler.size(data.duration);
    self.set("numFrames", self.numFrames = Math.floor(data.duration * self.settings.theme.framesPerSecond) - 1);
    self.status("waveform");

    getWaveform(self.audioPath, {
      numFrames: self.numFrames,
      samplesPerFrame: self.settings.theme.samplesPerFrame,
      channels: data.channels
    }, function(waveformErr, waveform){

      return cb(waveformErr, self.waveform = waveform);

    });


  });

};

// Trim the audio by the start and end time specified
Audiogram.prototype.trimAudio = function(start, end, cb) {

  var self = this;

  this.status("trim");

  // FFmpeg needs an extension to sniff
  var trimmedPath = this.audioPath + "-trimmed.mp3";

  trimAudio({
    origin: this.audioPath,
    destination: trimmedPath,
    startTime: start,
    endTime: end
  }, function(err){
    if (err) {
      return cb(err);
    }

    self.audioPath = trimmedPath;

    return cb(null);
  });

};

// Process background video
Audiogram.prototype.backgroundVideo = function(cb) {

  var self = this;

  this.status("video");

  backgroundVideo.splitFrames({
    id: this.settings.media.background.id,
    origin: path.join(serverSettings.storagePath, this.settings.theme.customBackgroundPath),
    destination: this.backgroundFrameDir,
    duration: this.settings.duration
  }, function(err,fps){
    if (err) {
      return cb(err);
    }
    self.settings.backgroundInfo.frames = Math.ceil(fps * self.settings.backgroundInfo.duration);
    self.settings.theme.framesPerSecond = fps;
    return cb(null);
  });

};

// Initialize the canvas and draw all the frames
Audiogram.prototype.drawFrames = function(cb) {

  this.status("frames");

  var self = this,
      spawnQ = queue();

  var options = {
        width: self.settings.theme.width,
        height: self.settings.theme.height,
        numFrames: self.numFrames,
        frameDir: self.frameDir,
        backgroundFrameDir: self.backgroundFrameDir,
        caption: self.settings.caption,
        transcript: JSON.parse(self.settings.transcript),
        subtitles: JSON.parse(self.settings.subtitles),
        waveform: self.waveform,
        fps: self.settings.theme.framesPerSecond,
        start: self.settings.start,
        end: self.settings.end,
        backgroundInfo: self.settings.backgroundInfo
      };

  // Store job info
  transports.setField("jobInfo:" + this.id, "theme", JSON.stringify(this.settings.theme));
  transports.setField("jobInfo:" + this.id, "options", JSON.stringify(options));

  // Spawn multiple workers to multithread the frame rendering process
  var cores = os.cpus().length,
      framesPerCore = Math.ceil( (self.numFrames+1) / cores ),
      framesPerWorker = Math.max( framesPerCore, 100 ),
      start = -framesPerWorker,
      end = 0;
  while ( end < self.numFrames ) {
    start += framesPerWorker;
    end = Math.min(end + framesPerWorker, self.numFrames);
    spawnQ.defer(spawnChild, {start: start, end: end});
  }

  // Once all workers have exited
  spawnQ.await(function(err){
    cb(err);
  });

  function spawnChild(frames, spawnCb) {
    var child = spawn("bin/frameWorker", [self.id, frames.start, frames.end], {
                  cwd: path.join(__dirname, ".."),
                  env: _.extend({}, process.env, { SPAWNED: true }),
                  stdio: ['pipe', 'pipe', 'pipe', 'ipc']
                });
    child.on('exit', function (exitCode) {
        var err = exitCode==-1 ? "frameWorker error" : null;
        spawnCb(err);
    });
    child.stderr.on('data', function (data) {
      console.log("frameWorker >>> " + data);
      spawnCb('Error drawing frames: ' + data + ' - ' + data.toString());
    });
    child.stdout.on('data', function (data) {
      console.log('frameWorker >>> ' + data);
    });
    child.on('message', function (msg) {
      try {
        var err = JSON.stringify(msg);
      } catch(e) {
        var err = msg;
      }
      if (err.length && err.length > 10) spawnCb("Error drawing frames: " + err);
    });
  }

};

// Save subtitles
Audiogram.prototype.saveSubtitles = function(type,cb) {

  var self = this;
  if (self.settings.transcript) {
    subtitles.save(type, self.settings.subtitles, path.join(self.dir, "subtitles." + type), function(err){
      if (err) return cb(err);
      transports.uploadVideo(path.join(self.dir, "subtitles." + type), "video/" + self.id + "." + type, function(err){
        return cb(err);
      });
    });
  }

};

// Save thumbnail image
Audiogram.prototype.saveThumb = function(cb) {

  var self = this;
  
  transports.uploadVideo(path.join(self.frameDir, "000001.jpg"), "video/" + self.id + ".jpg", function(err){
    return cb(err);
  });

};

// Combine the frames and audio into the final video with FFmpeg
Audiogram.prototype.combineFrames = function(cb) {

  this.status("combine");

  combineFrames({
    framePath: path.join(this.frameDir, "%06d.jpg"),
    audioPath: this.audioPath,
    videoPath: this.videoPath,
    framesPerSecond: this.settings.theme.framesPerSecond
  }, cb);

};

// Master render function, queue up steps in order
Audiogram.prototype.render = function(cb) {

  var self = this,
      q = queue(1);

  this.status("audio-download");

  // Set up tmp directory
  q.defer(mkdirp, this.frameDir);

  // Download the stored audio file
  q.defer(transports.downloadAudio, this.settings.theme.audioPath, this.audioPath);

  // If the audio needs to be clipped, clip it first and update the path
  if (this.settings.start || this.settings.end) {
    q.defer(this.trimAudio.bind(this), this.settings.start || 0, this.settings.end || null);
  }

  // Process background video
  this.settings.backgroundInfo = JSON.parse(this.settings.backgroundInfo);
  if (this.settings.backgroundInfo.type.startsWith("video")) {
    if (this.settings.media.background.framesDir) {
      // video already processed
      this.backgroundFrameDir = this.settings.media.background.framesDir;
      var fps = 25;
      this.settings.backgroundInfo.frames = Math.ceil(fps * this.settings.backgroundInfo.duration);
      this.settings.theme.framesPerSecond = fps;
    } else {
      // re-process
      q.defer(mkdirp, this.backgroundFrameDir);
      q.defer(this.backgroundVideo.bind(this));
    }
  }

  // Get the audio waveform data
  q.defer(this.getWaveform.bind(this));

  // Draw all the frames
  q.defer(this.drawFrames.bind(this));

  // Save subtitle files
  q.defer(this.saveSubtitles.bind(this), "srt");
  q.defer(this.saveSubtitles.bind(this), "xml");

  // Save preview thumnail
  q.defer(this.saveThumb.bind(this));

  // Combine audio and frames together with ffmpeg
  q.defer(this.combineFrames.bind(this));

  // Upload video to S3 or move to local storage
  q.defer(transports.uploadVideo, this.videoPath, "video/" + this.id + ".mp4");

  // Delete working directory
  // q.defer(rimraf, this.dir);
  // TO DO: also need to remove bg directory

  // Final callback, results in a URL where the finished video is accessible
  q.await(function(err){

    if (!err) {
      self.set("url", transports.getURL(self.id));
    }

    logger.debug(self.profiler.print());

    if (self.dir) {
      rimraf(self.dir, function(rimrafErr) {
        if (rimrafErr) console.log(rimrafErr);
        return cb(err);
      });
    } else {
      return cb(err);      
    }

  });

  return this;

};

Audiogram.prototype.set = function(field, value) {
  logger.debug(field + "=" + value);
  transports.setField(this.id, field, value);
  return this;
};

// Convenience method for .set("status")
Audiogram.prototype.status = function(value) {
  this.profiler.start(value);
  return this.set("status", value);
};

module.exports = Audiogram;
