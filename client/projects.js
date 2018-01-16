var dateFormat = require("dateformat");
var path = require("path");

var utils = require("./utils");
var media = require("./media");
var audio = require("./audio");
var video = require("./video");
var vcs = require("./vcs");
var png = require("./png");
var preview = require("./preview");
var minimap = require("./minimap");
var transcript = require("./transcript");
var themeHelper = require("./themeHelper");

var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var orientation_map = {
    'landscape': 160,
    'square': 90,
    'portrait': 50
}

var title;
function _title(_) {
    return arguments.length ? (title = _) : title;
}

function formatDuration(time) {
    time = Math.round(time);
    var minutes = Math.floor(time / 60);
    var seconds = utils.pad(time - minutes * 60, 2);
    return `${minutes}′${seconds}″`;
}

function newProject(e) {
  var type = e.target
    ? jQuery(e.target)
        .parents("[data-type]")
        .attr("data-type")
    : e;
  if (!type) return false;
  if (type == "upload") {
    jQuery("#input-audio").click();
  } else {
    if (type == "vcs") {
        vcs.updateList();
    }
    if (type == "png") {
        png.updateList();
    }
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
        if (projects[i].private && projects[i].user!=USER.email) el.attr("data-admin", true);
        el.attr("data-id", projects[i].id);
        el.attr("data-audioId", projects[i].audioId);
        el.attr("data-finished", projects[i].finished);
        if (!projects[i].finished) el.addClass('hidden');
        el.find(".name").text( projects[i].title );
        var date = new Date(projects[i].date);
        el.find(".date").text(dateFormat(date, "dd mmm, HH:MM"));
        el.find(".duration").text(formatDuration(projects[i].duration));
        el.attr("data-user", projects[i].user);
        el.find(".user").text(projects[i].user.split('@').shift());
        el.find(".box-icon").css("background-image", "url(/video/" + projects[i].id + ".jpg)");
        var imageWidth = orientation_map[projects[i].orientation];
        el.find('.box-icon').css('width', imageWidth + "px");
        el.find('.info-box-content').css('width', "calc(100% - " + imageWidth + "px - 20px)");
      }
      if (jQuery("#landing .saved [data-id]:visible").length) {
          jQuery("#landing .saved .empty").hide();
      }
      if (jQuery("#landing .saved [data-id][data-admin]").length || jQuery("#landing .saved [data-id][data-finished='false']").length) {
        jQuery("#recent-filter option:last").after('<option value="admin">Admin View</option>');
      }
      utils.tooltips();
      updateFilter();
    }
  });
}

function updateFilter() {
  var filter = jQuery("#recent-filter").val();
  jQuery("#landing .saved [data-id]").addClass("hidden");
  jQuery("#landing .saved .empty").show();
  if (filter=="all") {
    jQuery("#landing .saved [data-id][data-admin!='true'][data-finished!='false']").removeClass("hidden");
  } else if (filter=='admin') {
    jQuery("#landing .saved [data-id]").removeClass("hidden");
  } else {
    jQuery("#landing .saved [data-user][data-user='" + USER.email + "'][data-finished!='false']").removeClass("hidden");
  }
  jQuery("#landing .saved [data-id='template']").addClass("hidden");
  if (jQuery("#landing .saved [data-id]:visible").length) {
    jQuery("#landing .saved .empty").hide();
  }
}

function selectProject() {
  var id = jQuery(this).attr("data-id");
  var audioId = jQuery(this).attr("data-audioId");
  var versions = +jQuery("#landing .saved [data-audioId='" + audioId + "']").length;
  if (versions > 1 && !jQuery('#version-history').is(':visible')) {
    loadHistory(audioId);
  } else {
    jQuery("#version-history").modal("hide");
    loadProject(id);
  }
}

function loadHistory(audioId) {
  jQuery("#version-history-body").html('');
  var projects = jQuery("#landing .saved").clone();
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
  utils.setClass('loading');
  function fetchProject(id, cb) {
    jQuery.getJSON("/getProject/" + id, function(data) {
      cb(data);
    });
  }
  fetchProject(id, function(data) {
    console.log(data);
    if (data.err) {
      utils.error(data.err);
      return;
    }
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
    jQuery('#input-subtitles')[0].checked = data.theme.subtitles.enabled;
    d3.select('#transcript-pane').classed('hidden', !data.theme.subtitles.enabled);
    jQuery("#input-theme").val(data.theme.name);
    themeHelper.update(data.theme);
    // Load transcript
    q.defer(function(data, cb) {
      var script = JSON.parse(data.transcript);
      if (script) {
        transcript.load(script);
      } else {
        var blobs = media.blobs();
        transcript.generate(blobs.audio);
      }
      cb(null);
    }, data);
    // Share settings
    jQuery("#input-private").val(data.private);
    // Update trim, and finish load
    q.awaitAll(function(err) {
      minimap.updateTrim([data.start, data.end]);
      transcript.format();
      video.update(path.join("/video/", id + ".mp4"), data);
      utils.navigate('edit');
      preview.redraw();
      LOADING = false;
      utils.navigate("view");
      history.replaceState(null, null, `/ag/${id}`);
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
    var name = jQuery('#input-audio')[0].files[0].name;
    _title(name);
    utils.navigate("new");
  });
  jQuery(document).on("change", "#recent-filter", updateFilter);
  jQuery(document).on("change", "#sharing-private", function(){
    var private = jQuery(this).val();
    var id = jQuery(this).attr('data-id');
    var url = `/updateProject/${id}?private=${private}`;
    jQuery('#sharing-spinner').show();
    jQuery.getJSON(url, function(data) {
        jQuery('#sharing-spinner').hide();
    });
  });
}

module.exports = {
  getProjects,
  load: loadProject,
  title: _title,
  init
};
