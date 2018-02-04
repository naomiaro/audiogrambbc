var read = require('fs-readdir-recursive')
var fs = require('fs');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var deleteEmptyDirectories = require("delete-empty");
var path = require('path');
var queue = require('d3').queue;
var stats = require('./stats');


function cleanFile(filePath, maxAge, cb) {
  fs.stat(filePath, function(err, stat) {
    if (err) return cb(err);
    var now = new Date().getTime();
    var endTime = new Date(stat.ctime).getTime() + maxAge;
    if (now > endTime) {
      rimraf(filePath, function(err) {
        if (err) return cb(err, 0);
        return cb(null, 1);
      });
    } else {
      return cb(null, 0);
    }
  });
}

function clean(path, maxAge, frequency) {
  var q = queue();
  var files = read(path);
  files.forEach(file => {
    var filePath = path.join(path, file);
    q.defer(cleanFile, filePath, maxAge);
  });
  q.awaitAll(function(err, count){
    var filesCleaned = count.reduce((a, b) => a + b, 0);
    if (err) console.log(`Error cleaning ${path}: `, err);
    deleteEmptyDirectories(path, function(err){
      mkdirp(path);
      if (err && err.path != path) console.log(`Error cleaning ${path} directory: `, err);
      if (filesCleaned) {
        stats.increment('filescleaned', filesCleaned);
        console.log(`Cleaned ${filesCleaned}/${files.length} files`);
      }
      setTimeout(() => {
        clean(path, maxAge, frequency);
      }, frequency);
    });
  });
}

// TMP FILES
var tmpDir = path.join(__dirname, "../tmp");
var tmpMaxAge = 60 * 60 * 1000;     // Delete tmp files older than 1 hour
var tmpFrequency = 10 * 60 * 1000;  // Run scan every 10 min
clean(tmpDir, tmpMaxAge, tmpFrequency); 

// MEDIA FILES
var mediaDir = path.join(__dirname, "../media");
var mediaMaxAge = 10 * 24 * 60 * 60 * 1000;   // Delete media files older than 10 days
var mediaFrequency = 30 * 60 * 1000;          // Run scan every 30 min
clean(mediaDir, mediaMaxAge, mediaFrequency); 