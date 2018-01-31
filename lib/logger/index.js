var winston = require("winston");
var morgan = require("morgan");
var path = require("path");
var dateFormat = require("dateformat");

var logFile = path.join(__dirname, "../../console.log");
var opts = {
  filename: logFile,
  json: false,
  timestamp: function() {
    var now = Date.now();
    return dateFormat(now, "ddd dd mmm HH:MM:ss");
  }
}
winston.add(winston.transports.File, opts);

winston.setLevels({ error: 0, info: 1, debug: 2, web: 3 });
winston.level = process.env.DEBUG ? "debug" : "info";

function log(msg, level) {

  if (!level) {
    level = "info";
  }

  msg.split('\n').forEach(line => {
    winston.log(level, line);
  });

}

function debug(msg) {

  log(msg, "debug");

}

var stream = {
  write: function(msg) {
    log(msg, "web");
  }
};

module.exports = {
  log: log,
  debug: debug,
  morgan: function() {
    return morgan("combined", { "stream": stream });
  }
};
