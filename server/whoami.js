module.exports = function(req, res) {

	if (req.header('host').startsWith('localhost')) {
		return res.json({ name: 'Tracey Pritchard', email: 'tracey.pritchard@bbc.co.uk' });
	} 

	var email = req.header('BBC_IDOK') ? req.header('BBC_EMAIL') : null,
		name = req.header('BBC_IDOK') ? req.header('BBC_FULLNAME') : null;

	return res.json({name: name, email: email});

};
