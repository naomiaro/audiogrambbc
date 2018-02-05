var serverSettings = require("../lib/settings/"),
		fs = require('fs-extra'),
		path = require("path"),
		uuidv4 = require('uuid/v4'),
    transports = require("../lib/transports");

function add(req, res) {

	delete require.cache[require.resolve('../settings/themes.json')];
	var themes = require('../settings/themes.json'),
		themFile = path.join(__dirname, "../settings/themes.json");

	// Make a backup first
	fs.writeFile(themFile + ".bk" + (+ new Date()), JSON.stringify(themes,null,'\t'), function(err){
		if(err) console.log("Error making theme.json backup: " + err);
	});

	// Get new theme
	var newTheme = JSON.parse(req.body.theme);
	delete newTheme.audioPath;
	delete newTheme.customBackgroundPath;
	delete newTheme.customForegroundPath;

	if (req.body.background) {
		var backgroundPath = req.body.background;
		if (backgroundPath.includes('/')) {
			var src = req.body.background;
			var filename = uuidv4();
			var dest = path.join(__dirname, '../settings/backgrounds/', filename);
			fs.copySync(backgroundPath, dest);
			newTheme.backgroundImage = { landscape: filename, portrait: filename, square: filename }; 					
		}
	} else if (newTheme.backgroundImage) {
		newTheme.backgroundImage = Array.isArray(newTheme.backgroundImage) ? newTheme.backgroundImage : { landscape: newTheme.backgroundImage, portrait: newTheme.backgroundImage, square: newTheme.backgroundImage };
	} else {
		delete newTheme.backgroundImage;
	}
	if (req.body.foreground) {
		var foregroundPath = req.body.foreground;
    if (foregroundPath.includes("/")) {
      var src = req.body.foreground;
      var filename = uuidv4();
      var dest = path.join(__dirname, "../settings/backgrounds/", filename);
      fs.copySync(foregroundPath, dest);
      newTheme.foregroundImage = { landscape: filename, portrait: filename, square: filename };
    }
  } else if (newTheme.foregroundImage) {
		newTheme.foregroundImage = Array.isArray(newTheme.foregroundImage) ? newTheme.foregroundImage : { landscape: newTheme.foregroundImage, portrait: newTheme.foregroundImage, square: newTheme.foregroundImage };
  } else {
    delete newTheme.foregroundImage;
  }

	// Add theme
	themes[newTheme.name] = newTheme;

	// Sort alphabetically
	var keys = Object.keys(themes),
		i, len = keys.length,
		newThemes = {};
	keys.sort(function (a, b) {
	    return a.toLowerCase().localeCompare(b.toLowerCase());
	});
	newThemes["default"] = themes["default"];
	newThemes["Custom"] = themes["Custom"];
	for (i = 0; i < len; i++) {
		k = keys[i];
		if (k!="default" && k!="Custom") {
			newThemes[k] = themes[k];
		}
	}

	// Save themes
	var newJSON = JSON.stringify(newThemes,null,'\t');
	fs.writeFile(themFile, newJSON, function(err){
		delete require.cache[require.resolve('../settings/themes.json')];
		if (err) {
			return res.json({error: err});
		} else {
			return res.json({error: null});
		}
	});

}

module.exports = {
  add: add
};