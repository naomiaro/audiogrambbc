// Dependencies
var express = require("express"),
    compression = require("compression"),
    path = require("path"),
    multer = require("multer"),
    uuid = require("node-uuid"),
    mkdirp = require("mkdirp"),
    bodyParser = require("body-parser"),
    auth = require('./auth.js'),
    stats = require('../lib/stats');

// Routes and middleware
var whitelist = require("./whitelist.js"),
  themes = require("./themes.js"),
  idents = require("./idents.js"),
  logger = require("../lib/logger/"),
  render = require("./render.js"),
  status = require("./status.js"),
  projects = require("./projects.js"),
  fonts = require("./fonts.js"),
  user = require("./user.js"),
  messages = require("./messages.js"),
  upload = require("./upload.js"),
  kaldi = require("./kaldi.js"),
  vcs = require("./vcs.js"),
  png = require("./png.js"),
  ichef = require("./ichef.js"),
  webcap = require("./webcap.js"),
  simulcast = require("./simulcast.js"),
  errorHandlers = require("./error.js");

// Settings
var serverSettings = require("../lib/settings/");

var app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// whitelist
var NODE_ENV = process.env.NODE_ENV ? process.env.NODE_ENV : "development" ;
var WHITELIST = require('../whitelist.json');
// NODE_ENV === 'production' && app.use(auth(WHITELIST));
// NODE_ENV === app.use(auth(WHITELIST));

// use middlewares
app.use(compression());
app.use(logger.morgan());
app.use(bodyParser.urlencoded({ extended: false, limit: "10mb", parameterLimit: 50000 }));
app.use(bodyParser.json({ limit: "10mb" }));

// Edit whitelist
app.get("/whitelist/get/", whitelist.get);
app.get("/whitelist/", whitelist.editor);
app.post("/whitelist/", whitelist.set);


// Options for where to store uploaded audio and max size
var fileOptions = {
  storage: multer.diskStorage({
    destination: function(req, file, cb) {

      var dir = path.join(serverSettings.workingDirectory, uuid.v1());

      mkdirp(dir, function(err) {
        return cb(err, dir);
      });
    },
    filename: function(req, file, cb) {
      cb(null, file.fieldname);
    }
  })
};

if (serverSettings.maxUploadSize) {
  fileOptions.limits = {
    fileSize: +serverSettings.maxUploadSize
  };
}

// Upload/delete media
app.post("/upload/", [multer(fileOptions).fields([{ name: 'file', maxCount: 1 }]), upload.post]);
app.get("/delete/:type/:id", upload.delete);

// On submission, check upload, validate input, and start generating a video
// app.post("/submit/", render.validate);
var filesToUpload = [{ name: 'audio', maxCount: 1 }, { name: 'background', maxCount: 1 }, { name: 'foreground', maxCount: 1 }];
app.post("/submit/", [multer(fileOptions).fields(filesToUpload), render.validate, render.route]);

// Edit themes
// var filesToUpload = [{ name: 'background', maxCount: 1 },{ name: 'foreground', maxCount: 1 }];
// app.post("/themes/add", [multer({ dest: "./settings/backgrounds" }).fields(filesToUpload), themes.add]);
app.post("/themes/add", themes.add);
app.post("/themes/save", themes.save);
app.get('/themes/list', themes.list);
app.get("/themes/config/:id", themes.get);
// Edit themes
// app.post("/themes/add/", themes.add);

app.post("/idents/save", idents.save);
app.get('/idents/list', idents.list);

// If not using S3, serve videos locally
if (!serverSettings.s3Bucket) {
  app.use("/video/", express.static(path.join(serverSettings.storagePath, "video")));
  app.use('/media', express.static(serverSettings.storagePath));
}

// Serve custom fonts
app.get("/fonts/fonts.css", fonts.css);
app.get("/fonts/fonts.js", fonts.js);

if (serverSettings.fonts) {
  app.get("/fonts/:font", fonts.font);
}

// Get projects
app.get("/getProjects/", projects.getList);
app.get("/getProject/:id", projects.getProject);
app.get("/updateProject/:id", projects.updateProject);

// User info
app.get("/whoami/", user.whoami);
app.get("/heartbeat/", user.heartbeat);
app.get("/logout/", user.logout);

// User messages
app.get("/messages/edit", messages.editor);
app.get("/messages/:since?", messages.getMessages);
app.post("/messages/new", messages.add);
app.get("/messages/expire/:id", messages.expire);

// Check the status of a current video
app.get("/status/:id/", status);

// Handle kaldi transcripts
app.post("/kaldi/", [multer(fileOptions).fields([{ name: 'audio', maxCount: 1 }]), kaldi.post]);
app.get("/kaldi/stats/", kaldi.stats);
app.get("/kaldi/:job/", kaldi.get);

// ichef
app.get("/ichef/:pid/", ichef.pipe);

// webcap
app.get("/webcap/:file?", webcap);

// VCS
app.get("/vcs/api/:term/", vcs.api);
app.get("/vcs/api/media/:term/", vcs.pipe);
// app.get("/vcs/search/:id/", vcs.search);
// app.get("/vcs/list", vcs.list);
// app.get("/vcs/media/:file/", vcs.media);

// PNG
app.get("/png/list", png.list);
app.get("/png/media/:file/", png.media);

// Get simulcast media
app.post("/simulcast/", simulcast.post);
app.get("/simulcast/status/:id/", simulcast.poll);
app.get("/simulcast/media/:id/", simulcast.pipe);
app.get("/simulcast", simulcast.readme);
app.get("/simulcast/delete/:id/", simulcast.delete);

// Base64
app.get("/transcript", function(req, res){
    var buffer = Buffer.from(req.query.txt, "base64");
    var text = buffer.toString();
    res.set('content-type', 'text/plain');
    return res.send(text);
});

// Redis Info
app.get("/redis", function(req, res){
  var transports = require("../lib/transports");
  transports.status(function(err, info) {
    res.json({ err, info });
  });
});

// Stats
app.post("/stats", function(req, res){
  var type = req.body.type;
  var metric = req.body.metric;
  var value = req.body.value;
  var sampleRate = req.body.sampleRate;
  try {
    stats[type](metric, value, sampleRate);
  } catch (e) {
    console.log(e.toString());
    return res.json({error: e.toString()});
  }
  return res.json(req.body);
});

// Serve background images and themes JSON statically
app.use("/settings/", function(req, res, next) {

  // Limit to themes.json and bg/themes images
  if (req.url.match(/^\/?themes.json$/i) || req.url.match(/^\/?backgrounds\/[^/]+$/i) || req.url.match(/^\/?themes\/[^/]+$/i)) {
    return next();
  }

  return res.status(404).send("Cannot GET " + path.join("/settings", req.url));

}, express.static(path.join(__dirname, "..", "settings")));

// Load projects
app.use("/ag/:id", express.static(path.join(__dirname, "..", "editor")));

// Serve editor files statically
app.use(express.static(path.join(__dirname, "..", "editor")));

app.use(errorHandlers);

module.exports = app;
