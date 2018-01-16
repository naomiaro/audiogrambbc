'use strict';

var request = require('request'),
    xmlParser = require('xml2json'),
    path = require('path'),
    fs = require("fs"),
    _ = require("lodash");

function list(req, res) {
    var dir = path.join(__dirname, "../vcs");
    var items = [];
    fs.readdir(dir, function (err, files) {
        for (var i = 0; i < files.length; i++) {
            if (files[i].includes('#') && files[i].split('.')[1] != 'xml') {
                var file = files[i],
                    split = files[i].split('#'),
                    id = split[0],
                    name = split[1].split('.')[0];
                var xmlPath = path.join(dir, `${id}#${name}.xml`);
                var xml = fs.readFileSync(path.join(xmlPath));
                var fileJson = xmlParser.toJson(xml);
                var metadata = JSON.parse(fileJson);
                var date = metadata.EXPORT.TAKE.GENERIC.GENE_ROW_MOD_TIME;
                var time = Date.parse(new Date(date));
                items.push({ id, name, file, time });
            }
        }
        items = _.sortBy(items,['time']).reverse();
        return res.json(items.slice(0, 10));
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

function search(req, res) {
    var requestURL = "http://vcsio.newslabs.co/vcs/search/" + req.params.id;
    request({ url: requestURL, proxy: '' }, function (error, response, body) {
        if (response.statusCode !== 200) {
            return res.json({error: body});
        }
        var results = JSON.parse(body);
        var items = [];
        results.forEach(result => {
            var title = result.vcsinfo.take.GENERIC.GENE_TITLE;
            var dir = result.dir.split('/');
            var store = dir[dir.length - 1];
            var meida = result.mediaurl;
            var id = result.file.split('#')[0];
            items.push({
                id,
                title,
                store,
                media
            });
        });
        return res.json(items);
    });
}

function media(req, res) {
    var file = req.params.file;
    var src = path.join(__dirname, "../vcs", file);
    if (fs.existsSync(src)) {
        res.sendFile(src);
    } else {
        res.status(404);
    }
}

module.exports = {
    list,
    media,
    search
};