var read = require('fs-readdir-recursive')
var fs = require('fs');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var deleteEmptyDirectories = require("delete-empty");
var path = require('path');
var queue = require('d3').queue;
var stats = require('./stats');

var tmpDir = path.join(__dirname, "../tmp");
var maxAge = 3600000; // Delete files older than 1 hour
var cleanTimeout = 600000; // Run scan every 10 min
var filesCleaned;

function cleanFile(file, cb) {
  var filePath = path.join(tmpDir, file);
  fs.stat(filePath, function(err, stat) {
    if (err) return cb(err);
    var now = new Date().getTime();
    var endTime = new Date(stat.ctime).getTime() + maxAge;
    if (now > endTime) {
      rimraf(filePath, function(err) {
        if (err) return cb(err);
        filesCleaned++;
        return cb(null);
      });
    } else {
      return cb(null);
    }
  });
}

function cleanTmpDir() {
  filesCleaned = 0;
  var q = queue();
  var files = read(tmpDir);
  files.forEach(file => {
    q.defer(cleanFile, file);
  });
  q.await(function(err){
    if (err) console.log("Error cleaning tmp directory: ", err);
    deleteEmptyDirectories(tmpDir, function(err){
      mkdirp(tmpDir);
      if (err && err.path != tmpDir) console.log("Error cleaning tmp directory: ", err);
      if (filesCleaned) {
        stats.increment('filescleaned', filesCleaned);
        console.log(`Cleaned ${filesCleaned}/${files.length} files`);
      }
      setTimeout(() => {
        cleanTmpDir();
      }, cleanTimeout);
    });
  });
}

cleanTmpDir();