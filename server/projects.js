var transports = require("../lib/transports"),
    fs = require("fs"),
    path = require("path"),
    request = require('request');

function adminMiddleware(req, res) {
  const adminGroup = "CN=BBC News Labs Team,OU=B,OU=Distribution Groups,OU=Users and Desktops,OU=London,OU=MTS,DC=national,DC=core,DC=bbc,DC=co,DC=uk";
  const email = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : "localhost@audiogram.newslabs.co";
  const url = `http://apis.labs.jupiter.bbc.co.uk/whois/${email}`;
  request(url, function (err, adRes, adBody) {
    const userData = JSON.parse(adBody);
    const isAdmin = userData.retval.groups ? userData.retval.groups.includes(adminGroup) : false;
    return projectList(req, res, isAdmin);
  });
}

function projectList(req, res, admin) {
  transports.getProjectList(function(err, projects) {
    if (err) return res.json({ err: err });
    var list = [],
      now = new Date().getTime();
    for (var i = 0; i < projects.length; i++) {
      const private = +projects[i].private;
      // Don't return private projects of other users
      if (!private || projects[i].user == email || admin) {
        var id = projects[i].id,
          audioId = projects[i].media.audio.id,
          title = projects[i].title,
          user = projects[i].user,
          date = +projects[i].created,
          duration = +projects[i].duration,
          orientation = projects[i].theme.orientation,
          mediaPath = path.join(__dirname, "../media/video", id + ".mp4"),
          finished = fs.existsSync(mediaPath);
        // Don't returned expired projects (>3 days)
        var diffDays = Math.round(
          Math.abs((now - date) / (24 * 60 * 60 * 1000))
        );
        if (diffDays < 5) {
          list.push({
            id,
            title,
            audioId,
            user,
            date,
            duration,
            private,
            orientation,
            finished
          });
        }
      }
    }
    return res.json(list);
  });
}

function getProject(req, res) {
  var project = { err: "No project found matching that ID." };
  transports.getProjectList(function(err, projects) {
    if (err) return res.json({ err: err });
    for (var i = 0; i < projects.length; i++) {
      if (projects[i].id == req.params.id) {
        project = projects[i];
        break;
      }
    }
    return res.json(project);
  });
}

function updateProject(req, res) {
    var user = req.header("BBC_IDOK") ? req.header("BBC_EMAIL") : "audiogram-dev@bbc.co.uk";
    const opts = req.query;
    const id = req.params.id;
    transports.updateProject(id, user, opts, function (err, project) {
        if (err) return res.json({ err });
        return res.json(project);
    });
}

module.exports = {
  getList: adminMiddleware,
  getProject,
  updateProject
};
