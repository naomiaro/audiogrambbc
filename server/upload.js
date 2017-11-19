const fs = require("fs");
const rimraf = require("rimraf");
const path = require("path");
const backgroundVideo = require("../audiogram/background-video");

module.exports.delete = function(req, res) {
  const type = req.params.type;
	const id = req.params.id;
  console.log('DELETE', type, id);

	const filePath = path.join(__dirname, "../tmp", type, id);
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}

	const framesPath = path.join(__dirname, "../tmp/frames", id);
  if (fs.existsSync(framesPath)) {
    const pid = backgroundVideo.getPid(id);
    if (pid) {
      process.kill(pid);
    }
    rimraf.sync(framesPath);
  }

	res.json({deleted: id});
};

module.exports.post = function(req, res) {

  var uploadDest = req.files["file"][0].destination,
    id = uploadDest.split("/").pop(),
    tmp = req.files["file"][0].path,
    size = req.files["file"][0].size,
    mimetype = req.files["file"][0].mimetype,
    name = req.files["file"][0].originalname,
    type = req.body.type;

	const destDir = path.join(__dirname, "../tmp/", type);
	const dest = path.join(destDir, id);
	if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir);
  }
	fs.renameSync(tmp, dest);
	fs.rmdirSync(uploadDest);

  var response = {
    type,
    name,
		id,
		path: dest,
    size,
    mimetype
  };

  // Process video file
  if (req.body.type == "background" && mimetype.startsWith("video")) {

		const framesPath = path.join(__dirname, "../tmp/frames/");
    if (!fs.existsSync(framesPath)) {
      fs.mkdirSync(framesPath);
		}
		
		const framesDir = path.join(framesPath, id);
		if (!fs.existsSync(framesDir)) {
			fs.mkdirSync(framesDir);
		}

		backgroundVideo.splitFrames({ id ,origin: dest, destination: framesDir });

    response.frames = id;
  }

  res.json(response);
};
