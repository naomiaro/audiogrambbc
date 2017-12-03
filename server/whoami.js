const redisHost = require("../settings/").redisHost;
const redis = require("redis");
const redisClient = redis.createClient({ host: redisHost });
const prefix = "audiogram:";

redisClient.on("error", function(err) {
	console.log('REDIS ERROR>> ', err);
});
	
module.exports = function(req, res) {

	if (req.header('host').startsWith('localhost')) {
		var name = "Dev User";
		var email = "audiogram-dev@bbc.co.uk";
	} else {
		var name = req.header('BBC_IDOK') ? req.header('BBC_FULLNAME') : null;
		var email = req.header('BBC_IDOK') ? req.header('BBC_EMAIL') : null;
	}

	redisClient.smembers(`user:${email}`, (err, loginDates) => {
		const lastLogin = loginDates.sort()[loginDates.length - 1];
		redisClient.sadd(`users`, email);
		redisClient.sadd(`user:${email}`, Date.now());
		return res.json({ name, email, lastLogin: Date(lastLogin) });
	});

};
