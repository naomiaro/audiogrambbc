module.exports = function(req, res) {

	console.log(req.files);

	var destination = req.files['file'][0].destination,
		path = req.files['file'][0].path,
		size = req.files['file'][0].size,
		mimetype = req.files['file'][0].mimetype,
		name = req.files['file'][0].originalname;

	var response = {type: req.body.type, name: name, path: path, size: size, mimetype: mimetype};

	// Process video file
	if (req.body.type=="background" && mimetype.startsWith("video")) {

	    var queue = require("d3").queue,
		    q = queue(1),
		    mkdirp = require("mkdirp"),
		    backgroundVideo = require("../audiogram/background-video.js"),
		    framesDir = destination + "/frames";

	    q.defer(mkdirp, framesDir);
	    q.defer(backgroundVideo, {origin: path, destination: framesDir});

	    response.framesDir = framesDir;

	}

	res.json(response);

};
