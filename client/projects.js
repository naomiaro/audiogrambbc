const dateFormat = require("dateformat");
const path = require("path");

const utils = require("./utils");
const media = require("./media");
const audio = require("./audio");
const video = require("./video");
const vcs = require("./vcs");
const preview = require("./preview");
const minimap = require("./minimap");
const transcript = require("./transcript");
const themeHelper = require("./themeHelper");

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const orientation_map = {
    'landscape': 160,
    'square': 90,
    'portrait': 50
}

let title;
function _title(_) {
    return arguments.length ? (title = _) : title;
}

function formatDuration(time) {
    time = Math.round(time);
    const minutes = Math.floor(time / 60);
    const seconds = utils.pad(time - minutes * 60, 2);
    return `${minutes}′${seconds}″`;
}

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
    vcs.updateList();
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
      console.log(projects);
      jQuery("#version-history-body").html("");
      jQuery("#landing .saved [data-id][data-id!='template']").remove();
      if (projects.length) jQuery("#landing .saved .empty").hide();
      // Loop through each project
      for (var i = projects.length - 1; i >= 0; i--) {
        // Add new project
        var el = jQuery("#landing .saved [data-id='template']").clone().appendTo("#landing .saved");
        if ( jQuery( "#landing .saved [data-audioId='" + projects[i].audioId + "']:first").length ) {
          // If audioId already exists, increment the version number
          var versions = +jQuery("#landing .saved [data-audioId='" +projects[i].audioId +"']").length + 1;
          jQuery("#landing .saved [data-audioId='" +projects[i].audioId +"']:first .version-count").removeClass('hidden').find("span").text(versions);
          // el.find(".versions").text();
          // jQuery("#landing .saved [data-audioId='" +projects[i].audioId +"'] .fa-link").removeClass("hidden");
          // el.find(".fa-link").removeClass("hidden");
          el.attr("data-hideVersion", true);
        }
        if (projects[i].private) el.find(".private").removeClass('hidden');
        el.attr("data-id", projects[i].id);
        el.attr("data-audioId", projects[i].audioId);
        el.find(".name").text( projects[i].title );
        var date = new Date(projects[i].date);
        el.find(".date").text(dateFormat(date, "dd mmm, HH:MM"));
        el.find(".duration").text(formatDuration(projects[i].duration));
        el.attr("data-user", projects[i].user);
        el.find(".user").text(projects[i].user.split('@').shift());
        el.find(".box-icon").css("background-image", "url(/video/" + projects[i].id + ".jpg)");
        const imageWidth = orientation_map[projects[i].orientation];
        el.find('.box-icon').css('width', imageWidth + "px");
        el.find('.info-box-content').css('width', "calc(100% - " + imageWidth + "px - 20px)");
    }
      utils.tooltips();
    }
  });
}

function updateFilter() {
  const filter = jQuery("#recent-filter").val();
  if (filter=="all") {
    jQuery("#landing .saved [data-user]").removeClass("hidden");
  } else {
    jQuery("#landing .saved [data-user][data-user!='" + USER.email + "']").addClass("hidden");
  }
}

function selectProject() {
  const id = jQuery(this).attr("data-id");
  const audioId = jQuery(this).attr("data-audioId");
  const versions = +jQuery("#landing .saved [data-audioId='" + audioId + "']").length;
  if (versions > 1 && !jQuery('#version-history').is(':visible')) {
    loadHistory(audioId);
  } else {
    jQuery("#version-history").modal("hide");
    loadProject(id);
  }
}

function loadHistory(audioId) {
  jQuery("#version-history-body").html('');
  const projects = jQuery("#landing .saved").clone();
  jQuery("#version-history-body").html(projects);
  jQuery("#version-history-body [data-audioId][data-audioId!='" + audioId + "']").remove();
  jQuery("#version-history-body [data-hideVersion]").attr("data-hideVersion", null);
  jQuery("#version-history-body .version-count").remove();
  jQuery("#version-history-body [data-audioId='" + audioId + "']").removeClass('col-md-6').addClass('col-md-12').show();
  jQuery("#version-history").modal("show");
  utils.tooltips();
}

function loadProject(id) {
  var id = id || jQuery(this).attr("data-id");
  if (!id) return false;
  LOADING = true;
  function fetchProject(id, cb) {
    jQuery.getJSON("/getProject/" + id, function(data) {
      cb(data);
    });
  }
  fetchProject(id, function(data) {
    console.log(data);
    var q = d3.queue(1);
    // Set title
    _title(data.title);
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
    // Share settings
    jQuery("#input-private").val(data.private);
    // Update trim, and finish load
    q.awaitAll(function(err) {
      minimap.updateTrim([data.start, data.end]);
      video.update(path.join("/video/", id + ".mp4"), preview.theme());
      utils.navigate('edit');
      preview.redraw();
      LOADING = false;
      utils.navigate("view");
    });
  });
}

function init() {
  global.LOADING = false;
  getProjects();
  // Event listeners
  jQuery(document).on("click", "#landing .new > [data-type]", newProject);
  jQuery(document).on("click", "#landing .saved [data-id]", selectProject);
  jQuery(document).on("change", "#input-audio", function(){
    media.update();
    const name = jQuery('#input-audio')[0].files[0].name;
    _title(name);
    utils.navigate("new");
  });
  jQuery(document).on("change", "#recent-filter", updateFilter);
}

module.exports = {
  getProjects,
  title: _title,
  init
};
