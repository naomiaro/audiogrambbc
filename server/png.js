'use strict';

var request = require('request'),
	path = require('path'),
    fs = require("fs");

function list(req, res) {
	var dir = path.join(__dirname, "../png");
	var items = [];
	fs.readdir(dir, function(err, files) {
		for (var i = 0; i < files.length; i++) {
			if (files[i].includes('.json')) {
                var metadata = require('../png/' + files[i]);
                var file = metadata.file.split('/');
                file = file[file.length - 1];
				items.push({
                    name: metadata.story,
                    user: metadata.email,
                    file
                });
			}
		}
		return res.json(items);
	});

// 	request(requestURL, function (error, response, body) {
// 		return res.json(response);
// 	});
}

// function media(req, res) {
// 	var requestURL = "http://zgbwclabsocto4.labs.jupiter.bbc.co.uk/vcs/media/" + req.params.id;
// 	var reply = request(requestURL);
// 	req.pipe(reply);
// 	reply.pipe(res);
// }

function media(req, res) {
    var file = req.params.file;
    var src = path.join(__dirname, "../png", file);
    if (fs.existsSync(src)) {
        res.sendFile(src);
    } else {
        res.status(404);
    }
}

module.exports = {
  list,
  media
};