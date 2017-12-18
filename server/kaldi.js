
var request = require('request'),
    queue = require("d3").queue,
    fs = require("fs"),
    rimraf = require("rimraf"),
	kaldiBaseURL = "http://zgbwcsttapi04.labs.jupiter.bbc.co.uk/api/v0.2/stt",
	kaldiPoll;

function fetchTranscript(job, cb) {
	var requestURL = kaldiBaseURL + '/transcript/' + job;
	request({url: requestURL, proxy: null}, function (error, response, body) {
		cb(error,body);
	});
}
function fetchSegments(job, cb) {
	var requestURL = kaldiBaseURL + '/segments/' + job;
	request({url: requestURL, proxy: null}, function (error, response, body) {
		cb(error,body);
	});
}

function fetch(job, cb) {
	if (!kaldiPoll.error && kaldiPoll.status=="SUCCESS") {
		var q = queue(2);
		q.defer(fetchTranscript,job)
		 .defer(fetchSegments,job)
		 .await(function(error,transcript,segments){
		 	cb(error,{transcript: transcript, segments: segments});
	 	});
	} else {
		cb(null,null);
	}
}

function poll(job, cb) {
	var requestURL = kaldiBaseURL + '/status/' + job;
	request({url: requestURL, proxy: null}, function (error, response, body) {
		var bodyJson = JSON.parse(body);
		kaldiPoll = {status: bodyJson.status, error: (error || bodyJson.error)}
		cb(error);
	});
}

function get(req, res) {
	var q = queue(1),
		job = req.params.job,
		transcript = null;
	q.defer(poll,job)
	 .defer(fetch,job)
	 .await(function(error,_,result){
		return 	res.json({
					job: job,
					status: kaldiPoll.status,
					error: error || kaldiPoll.error,
					transcript: result ? result.transcript : null,
					segments: result ? result.segments : null
				});
	 });
}

function post(req, res) {
	var formData = {
		file: fs.createReadStream(req.files['audio'][0].path)
	};
	request.post({url: kaldiBaseURL, proxy: null, formData: formData}, function (error, response, body) {
		rimraf(req.files['audio'][0].destination, function(err){
			if (err) console.log("Error deleting tmp dir: " + err);
		})
		console.log(body);
		try {
			var bodyJson = JSON.parse(body);
		} catch(e) {
			return res.status(500).send("Error parsing Kaldi response.");
		}
		return res.json({job: bodyJson.jobid, error: error});
	});
}


module.exports = {
  get: get,
  post: post
};