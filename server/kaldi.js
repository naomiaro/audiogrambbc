
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

function format(kaldiResponse) {
	var transcript = JSON.parse(kaldiResponse.transcript);
	var segments = JSON.parse(kaldiResponse.segments);
	var speakers = [];
	var script = segments.segments.map(function(segment) {
		var start = segment.start;
		var end = segment.start + segment.duration;
		var words = transcript.words.filter(function(word) {
									return (word.start >= start && word.end <= end);
								}).map(function(word) {
									return {start: word.start, end: word.end, text: word.punct};
                                });
        if (words.length) {
            var speakerId = segment.speaker['@id'];
            var speaker = speakers.indexOf(speakerId);
            if (speaker === -1) {
                speakers.push(speakerId);
                speaker = speakers.length - 1;
            }
        } else {
            speaker = 0;
        }
		return {
			start,
			end,
			speaker,
			words
		}
	});
	return script;
}

function get(req, res) {
	// var tmp = JSON.parse('{"transcript":{"metadata":{"version":"0.0.8"},"text":"and meeting with the prime minister and tomorrow is you know great britain some with the tomorrow i don\'t have my camera secretary they wanna talk trade so letters renew their relationship that can lead to the world so that we may not be counted with the cold and timid souls you and donald will fill the room of the well on trying were left with the ordinary working at the street made then i went with wishful thinking on but i don\'t think he has any idea how much of an earthquake trumpet about","punct":"And meeting with the Prime Minister and tomorrow is. You know. Great Britain. Some with the tomorrow. I don\'t have my camera secretary. They wanna talk trade. So, letters, renew their relationship that can lead to the world, so that we may not be counted with the cold and timid souls. You and Donald will fill the room of the well on trying were left with the ordinary working at the street made. Then I went with wishful thinking on, but I don\'t think he has any idea how much of an earthquake trumpet about.","words":[{"start":0.06,"confidence":0.45,"end":0.16,"word":"and","punct":"And"},{"start":0.19,"confidence":1,"end":0.59,"word":"meeting","punct":"meeting"},{"start":0.59,"confidence":1,"end":0.75,"word":"with","punct":"with"},{"start":0.75,"confidence":1,"end":0.85,"word":"the","punct":"the"},{"start":0.85,"confidence":1,"end":1.19,"word":"prime","punct":"Prime"},{"start":1.19,"confidence":1,"end":1.91,"word":"minister","punct":"Minister"},{"start":2.29,"confidence":0.55,"end":2.4,"word":"and","punct":"and"},{"start":2.68,"confidence":0.91,"end":3.16,"word":"tomorrow","punct":"tomorrow"},{"start":3.16,"confidence":0.48,"end":3.34,"word":"is","punct":"is."},{"start":3.34,"confidence":0.96,"end":3.45,"word":"you","punct":"You"},{"start":3.45,"confidence":0.94,"end":3.85,"word":"know","punct":"know."},{"start":4.31,"confidence":1,"end":4.62,"word":"great","punct":"Great"},{"start":4.62,"confidence":0.99,"end":5.16,"word":"britain","punct":"Britain."},{"start":5.69,"confidence":0.46,"end":6.09,"word":"some","punct":"Some"},{"start":6.17,"confidence":0.94,"end":6.32,"word":"with","punct":"with"},{"start":6.32,"confidence":0.31,"end":6.4,"word":"the","punct":"the"},{"start":6.43,"confidence":0.41,"end":6.88,"word":"tomorrow","punct":"tomorrow."},{"start":7.65,"confidence":1,"end":7.8,"word":"i","punct":"I"},{"start":7.8,"confidence":1,"end":8.04,"word":"don\'t","punct":"don\'t"},{"start":8.04,"confidence":1,"end":8.37,"word":"have","punct":"have"},{"start":8.37,"confidence":1,"end":8.5,"word":"my","punct":"my"},{"start":8.5,"confidence":0.97,"end":8.87,"word":"camera","punct":"camera"},{"start":8.87,"confidence":0.91,"end":9.36,"word":"secretary","punct":"secretary."},{"start":9.36,"confidence":0.63,"end":9.47,"word":"they","punct":"They"},{"start":9.47,"confidence":0.53,"end":9.63,"word":"wanna","punct":"wanna"},{"start":9.65,"confidence":0.99,"end":9.88,"word":"talk","punct":"talk"},{"start":9.88,"confidence":0.76,"end":10.27,"word":"trade","punct":"trade."},{"start":10.86,"confidence":0.99,"end":11.15,"word":"so","punct":"So,"},{"start":11.15,"confidence":0.55,"end":11.56,"word":"letters","punct":"letters,"},{"start":11.61,"confidence":1,"end":12.38,"word":"renew","punct":"renew"},{"start":12.41,"confidence":0.84,"end":12.54,"word":"their","punct":"their"},{"start":12.54,"confidence":1,"end":13.43,"word":"relationship","punct":"relationship"},{"start":13.43,"confidence":1,"end":13.57,"word":"that","punct":"that"},{"start":13.57,"confidence":1,"end":13.78,"word":"can","punct":"can"},{"start":13.78,"confidence":0.99,"end":14.18,"word":"lead","punct":"lead"},{"start":14.18,"confidence":0.68,"end":14.24,"word":"to","punct":"to"},{"start":14.25,"confidence":1,"end":14.36,"word":"the","punct":"the"},{"start":14.36,"confidence":1,"end":14.97,"word":"world","punct":"world,"},{"start":15.3,"confidence":1,"end":15.53,"word":"so","punct":"so"},{"start":15.53,"confidence":1,"end":15.67,"word":"that","punct":"that"},{"start":15.67,"confidence":1,"end":15.82,"word":"we","punct":"we"},{"start":15.82,"confidence":1,"end":15.97,"word":"may","punct":"may"},{"start":15.97,"confidence":1,"end":16.22,"word":"not","punct":"not"},{"start":16.25,"confidence":1,"end":16.37,"word":"be","punct":"be"},{"start":16.37,"confidence":1,"end":17.05,"word":"counted","punct":"counted"},{"start":17.28,"confidence":1,"end":17.44,"word":"with","punct":"with"},{"start":17.44,"confidence":0.94,"end":17.54,"word":"the","punct":"the"},{"start":17.54,"confidence":1,"end":18.09,"word":"cold","punct":"cold"},{"start":18.09,"confidence":1,"end":18.29,"word":"and","punct":"and"},{"start":18.32,"confidence":1,"end":18.75,"word":"timid","punct":"timid"},{"start":18.75,"confidence":1,"end":19.51,"word":"souls","punct":"souls."},{"start":19.86,"confidence":0.5,"end":19.96,"word":"you","punct":"You"},{"start":20.02,"confidence":0.65,"end":20.29,"word":"and","punct":"and"},{"start":20.29,"confidence":0.79,"end":20.59,"word":"donald","punct":"Donald"},{"start":20.59,"confidence":0.91,"end":20.73,"word":"will","punct":"will"},{"start":20.73,"confidence":0.9,"end":21.07,"word":"fill","punct":"fill"},{"start":21.07,"confidence":0.65,"end":21.19,"word":"the","punct":"the"},{"start":21.19,"confidence":0.97,"end":21.5,"word":"room","punct":"room"},{"start":21.53,"confidence":0.87,"end":21.71,"word":"of","punct":"of"},{"start":21.72,"confidence":0.94,"end":21.87,"word":"the","punct":"the"},{"start":21.87,"confidence":0.95,"end":22.24,"word":"well","punct":"well"},{"start":22.23,"confidence":0.72,"end":22.44,"word":"on","punct":"on"},{"start":23,"confidence":0.34,"end":23.36,"word":"trying","punct":"trying"},{"start":23.49,"confidence":0.71,"end":23.7,"word":"were","punct":"were"},{"start":24.55,"confidence":0.4,"end":24.75,"word":"left","punct":"left"},{"start":25.19,"confidence":0.43,"end":25.43,"word":"with","punct":"with"},{"start":25.46,"confidence":0.69,"end":25.63,"word":"the","punct":"the"},{"start":25.74,"confidence":1,"end":26.08,"word":"ordinary","punct":"ordinary"},{"start":26.08,"confidence":0.98,"end":26.47,"word":"working","punct":"working"},{"start":26.47,"confidence":0.69,"end":26.66,"word":"at","punct":"at"},{"start":26.69,"confidence":0.85,"end":26.96,"word":"the","punct":"the"},{"start":27.08,"confidence":0.33,"end":27.42,"word":"street","punct":"street"},{"start":27.43,"confidence":0.88,"end":27.82,"word":"made","punct":"made."},{"start":27.88,"confidence":0.65,"end":28.41,"word":"then","punct":"Then"},{"start":28.41,"confidence":0.74,"end":28.52,"word":"i","punct":"I"},{"start":28.55,"confidence":0.71,"end":29,"word":"went","punct":"went"},{"start":29.05,"confidence":0.71,"end":29.25,"word":"with","punct":"with"},{"start":29.48,"confidence":0.99,"end":29.98,"word":"wishful","punct":"wishful"},{"start":30.01,"confidence":0.99,"end":30.4,"word":"thinking","punct":"thinking"},{"start":30.42,"confidence":0.84,"end":30.7,"word":"on","punct":"on,"},{"start":30.9,"confidence":0.47,"end":31.23,"word":"but","punct":"but"},{"start":31.44,"confidence":1,"end":31.59,"word":"i","punct":"I"},{"start":31.72,"confidence":0.99,"end":31.96,"word":"don\'t","punct":"don\'t"},{"start":31.96,"confidence":1,"end":32.23,"word":"think","punct":"think"},{"start":32.23,"confidence":0.92,"end":32.3,"word":"he","punct":"he"},{"start":32.3,"confidence":0.82,"end":32.49,"word":"has","punct":"has"},{"start":32.49,"confidence":1,"end":32.66,"word":"any","punct":"any"},{"start":32.66,"confidence":1,"end":33.4,"word":"idea","punct":"idea"},{"start":33.69,"confidence":1,"end":34.01,"word":"how","punct":"how"},{"start":34.01,"confidence":1,"end":34.33,"word":"much","punct":"much"},{"start":34.33,"confidence":1,"end":34.41,"word":"of","punct":"of"},{"start":34.41,"confidence":1,"end":34.53,"word":"an","punct":"an"},{"start":34.53,"confidence":1,"end":35.35,"word":"earthquake","punct":"earthquake"},{"start":35.8,"confidence":0.64,"end":36.24,"word":"trumpet","punct":"trumpet"},{"start":36.26,"confidence":1,"end":36.62,"word":"about","punct":"about."}]},"segments":{"metadata":{"version":"0.0.8"},"@type":"AudioFile","speakers":[{"@id":"S0","gender":"M"},{"@id":"S2","gender":"F"},{"@id":"S4","gender":"M"}],"segments":[{"@type":"Segment","start":0,"duration":10.76,"bandwidth":"S","speaker":{"@id":"S0","gender":"M"}},{"@type":"Segment","start":10.76,"duration":9.03,"bandwidth":"S","speaker":{"@id":"S2","gender":"F"}},{"@type":"Segment","start":19.79,"duration":17.74,"bandwidth":"S","speaker":{"@id":"S4","gender":"M"}}]},"kaldi":"0.0.8"}');
	// var result = {
	// 	transcript: JSON.stringify(tmp.transcript),
	// 	segments: JSON.stringify(tmp.segments)
	// }
	// var script = format(result);
	// return res.json({
	// 	job: job,
	// 	status: 'SUCCESS',
	// 	error: null,
	// 	script
	// });

	var q = queue(1),
		job = req.params.job,
		transcript = null;
	q.defer(poll,job)
	 .defer(fetch,job)
	 .await(function(error,_,result){
		var script = result ? format(result) : null;
		return 	res.json({
					job: job,
					status: kaldiPoll.status,
					error: error || kaldiPoll.error,
					script
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