'use strict';

var request = require('request'),
    xmlParser = require('xml2json'),
	path = require('path'),
    fs = require("fs");

function list(req, res) {
	const dir = path.join(__dirname, "../vcs");
	let items = [];
	fs.readdir(dir, function(err, files) {
		for (var i = 0; i < files.length; i++) {
			if (files[i].split('.')[1] != 'xml') {
                var file = files[i],
                    split = files[i].split('#'),
					id = split[0],
					name = split[1].split('.')[0];
				items.push({id, name, file});
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
    const file = req.params.file;
    const src = path.join(__dirname, "../vcs", file);
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