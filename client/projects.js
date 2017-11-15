const dateFormat = require("dateformat");
const path = require("path");

const utils = require("./utils");
const media = require("./media");
const audio = require("./audio");
const video = require("./video");
const preview = require("./preview");
const minimap = require("./minimap");
const transcript = require("./transcript");
const themeHelper = require("./themeHelper");

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getVCSList() {
  jQuery.getJSON("/vcs/list", function(list) {
    list.forEach(function(item) {
      const el = `<tr><td><input type="radio" name="vcs-import" value="${item.id}"></td><td>${item.id}</td><td>${item.name}</td></tr>`;
      jQuery("#new-vcs table tbody").append(el);
    });
    jQuery("#new-vcs input[name=vcs-import]:first").attr("checked", true);
  });
}
jQuery(document).on("click", "#new-vcs tr", function(e) {
  jQuery(this)
    .find("input[name=vcs-import]")
    .prop("checked", true);
});

function newProject(e) {
  const type = e.target
    ? jQuery(e.target)
        .parents("[data-type]")
        .attr("data-type")
    : e;
  if (!type) return false;
  if (type == "upload") {
    jQuery("#input-audio").click();
  } else {
    jQuery("#new-" + type).modal("show");
  }
}

function getProjects() {
  console.log("Fetching projects...");
  // Load previously saved projects
  $.ajax({
    url: "/getProjects/",
    error: error,
    dataType: "json",
    success: function(projects) {
      jQuery("#landing .saved [data-id][data-id!='template']").remove();
      if (projects.length) jQuery("#landing .saved .empty").hide();
      // Loop through each project
      for (var i = projects.length - 1; i >= 0; i--) {
        // Add new project
        var el = jQuery("#landing .saved [data-id='template']").clone().appendTo("#landing .saved");
        if ( jQuery( "#landing .saved [data-audioId='" + projects[i].audioId + "']:first").length ) {
          // If audioId already exists, increment the version number
          var versions = +jQuery("#landing .saved [data-audioId='" +projects[i].audioId +"']:first .versions").text().split(" ")[0] + 1;
          jQuery("#landing .saved [data-audioId='" +projects[i].audioId +"']:first .versions").text(versions + " versions").removeClass("hidden");
          el.find(".versions").text();
          jQuery("#landing .saved [data-audioId='" +projects[i].audioId +"'] .fa-link").removeClass("hidden");
          el.find(".fa-link").removeClass("hidden");
          el.hide();
        }
        el.attr("data-id", projects[i].id);
        el.attr("data-audioId", projects[i].audioId);
        el.find(".name").text( projects[i].audioId.split("-").shift() + " / " + projects[i].id.split("-").shift() );
        var date = new Date(projects[i].date);
        el.find(".date").text(dateFormat(date, "dd mmm, HH:MM"));
        el.find(".duration").text(Math.round(projects[i].duration) + "s");
        el.find(".user").text(projects[i].user);
        el.find(".box-icon").css("background-image", "url(/video/" + projects[i].id + ".jpg)");
      }
    }
  });
}

function expandProjectVersions(e) {
  var audioId = jQuery(this)
    .parents("[data-audioId]")
    .attr("data-audioId");
  if (!audioId) return false;
  var count = jQuery("#landing .saved [data-audioId='" + audioId + "']").length,
    i = count;
  jQuery("#landing .saved [data-audioId='" + audioId + "']").each(function(
    index
  ) {
    jQuery(this)
      .find(".versions")
      .replaceWith(i + " of " + count);
    i--;
  });
  jQuery("#landing .saved [data-audioId='" + audioId + "']").show();
  jQuery(
    "#landing .saved [data-audioId='" + audioId + "'] .info-box-content"
  ).effect("highlight");
  stopIt(e);
}

function loadProject(e) {
  LOADING = true;
  function fetchProject(id, cb) {
    jQuery.getJSON("/getProject/" + id, function(data) {
      cb(data);
    });
  }
  var id = jQuery(this).attr("data-id");
  if (!id) return false;
  fetchProject(id, function(data) {
    console.log(data);
    var q = d3.queue(1);
    // Load media
    for (var type in data.media) {
      media.set(data.media);
      q.defer(
        media.loadFromURL,
        type,
        path.join("/media/", data.media[type].dest)
      );
    }
    // Load theme
    jQuery("#input-theme").val(data.theme.name);
    themeHelper.update(data.theme);
    // Load transcript
    q.defer(function(data, cb) {
      var script = JSON.parse(data.transcript);
      if (script) {
        transcript.load(script);
      } else {
        const blobs = media.blobs();
        transcript.generate(blobs.audio);
      }
      cb(null);
    }, data);
    // Load caption
    // Update trim, and finish load
    q.awaitAll(function(err) {
      minimap.updateTrim([data.start, data.end]);
      video.update(path.join("/video/", id + ".mp4"), preview.theme());
      LOADING = false;
      utils.navigate("view");
    });
  });
}

function init() {
  global.LOADING = false;
  getVCSList();
  getProjects();
  // Event listeners
  jQuery(document).on("click", "#landing .new > [data-type]", newProject);
  jQuery(document).on("click", "#landing .saved [data-id]", loadProject);
  jQuery(document).on(
    "click",
    "#landing .saved .versions",
    expandProjectVersions
  );
  jQuery(document).on("change", "#input-audio", function(){
    media.update();
    utils.navigate("new");
  });
}

module.exports = {
  getProjects,
  init
};
