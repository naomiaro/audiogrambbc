global.d3 = require("d3");
global.jQuery  = require("jquery");
global.$ = jQuery;

const path = require("path");

const utils = require('./utils');
const transcript = require('./transcript');
const logger = require('./slack');
const preview = require('./preview');
const minimap = require('./minimap');
const video = require('./video');
const audio = require('./audio');
const media = require('./media');
const projects = require('./projects');
const ui = require('./ui');
const themeHelper = require('./themeHelper');
const ichef = require('./ichef');
const mediaSelector = require('./mediaSelector');
const submit = require('./submit');
const vcs = require('./vcs');
const webcap = require('./webcap');

require('./user');

d3.json("/settings/themes.json", function(err, themes){

  console.log('Parsing themes...');

  var errorMessage;

  // Themes are missing or invalid
  if (err || !d3.keys(themes).filter(function(d){ return d !== "default"; }).length) {
    if (err instanceof SyntaxError) {
      errorMessage = "Error in settings/themes.json:<br/><code>" + err.toString() + "</code>";
    } else if (err instanceof ProgressEvent) {
      errorMessage = "Error: no settings/themes.json.";
    } else if (err) {
      errorMessage = "Error: couldn't load settings/themes.json.";
    } else {
      errorMessage = "No themes found in settings/themes.json.";
    }
    d3.select("#loading-bars").remove();
    d3.select("#loading-message").html(errorMessage);
    if (err) {
      logger.error(errorMessage,err);
      throw err;
    }
    return;
  }

  for (var key in themes) {
    themes[key].name = key;
    var raw = JSON.stringify(themes[key]);
    if (key!="default") themes[key]["raw"] = JSON.parse(raw);
    themes[key] = jQuery.extend({}, themes.default, themes[key]);
  }

  var themesStr = JSON.stringify(themes);
  themeHelper.raw(JSON.parse(themesStr));

  preloadImages(themes);

});

// Once images are downloaded, set up listeners
function initialize(err, themesWithImages) {

  console.log("Initializing...");

  // Populate dropdown menu
  d3.select("#input-theme")
    .on("change", themeHelper.update)
    .selectAll("option")
    .data(themesWithImages)
    .enter()
    .append("option")
      .text(function(d){
        return d.name;
      });

  // Initialize components
  audio.init();
  ichef.init();
  mediaSelector.init();
  minimap.init();
  projects.init();
  submit.init();
  transcript.init();
  vcs.init();
  webcap.init();
  ui.init();

  // Get initial theme
  d3.select('#input-theme').each(themeHelper.update);

  // Select default theme
  jQuery(function() {
    jQuery("#input-theme option:first").after("<option disabled></option>");
    jQuery("#input-theme").val(jQuery("#input-theme option:eq(2)").val());
    var sel = jQuery("#input-theme").get(0);
    themeHelper.update(d3.select(sel.options[sel.selectedIndex]).datum());
  });

  jQuery(function() {
    utils.setClass("landing");
  });

}

function preloadImages(themes) {

  console.log('Loading images...');

  // preload images
  var themeQueue = d3.queue();
  d3.entries(themes).forEach(function(theme){
    if (!theme.value.name) {
      theme.value.name = theme.key;
    }
    if (theme.key !== "default") {
      themeQueue.defer(getImages, theme.value);
    }
  });
  themeQueue.awaitAll(initialize);

  function getImages(theme, cb) {

    if (!theme.backgroundImage && !theme.foregroundImage) {
      return cb(null, theme);
    }

    var imageQueue = d3.queue();

    // Load background images
    theme.backgroundImageFile = theme.backgroundImageFile || {};
    theme.backgroundImageInfo = theme.backgroundImageInfo || {};
    for(orientation in theme.backgroundImage){
      // Load each image
      imageQueue.defer(function(orientation, imgCb){
        theme.backgroundImageFile[orientation] = new Image();
        theme.backgroundImageFile[orientation].onload = function(){
          theme.backgroundImageInfo[orientation] = {type: "image", height: this.height, width: this.width};
          return imgCb(null);
        };
        theme.backgroundImageFile[orientation].onerror = function(e){
          console.warn(e);
          return imgCb(e);
        };
        theme.backgroundImageFile[orientation].src = "/settings/backgrounds/" + theme.backgroundImage[orientation];  //Q.  i thought there needs to be an explicit return statement.  or is this all side-effect making?
      }, orientation);
    }

    // Load foreground images
    theme.foregroundImageFile = theme.foregroundImageFile || {};
    for(orientation in theme.foregroundImage){
      // Load each image
      imageQueue.defer(function(orientation, imgCb){
        theme.foregroundImageFile[orientation] = new Image();
        theme.foregroundImageFile[orientation].onload = function(){
          return imgCb(null);
        };
        theme.foregroundImageFile[orientation].onerror = function(e){
          console.warn(e);
          return imgCb(e);
        };
        theme.foregroundImageFile[orientation].src = "/settings/backgrounds/" + theme.foregroundImage[orientation];  //Q.  i thought there needs to be an explicit return statement.  or is this all side-effect making?
      }, orientation);
    }

    // Update raw themes
    const raw = themeHelper.raw();
    raw[theme.name].backgroundImageFile = theme.backgroundImageFile;
    raw[theme.name].backgroundImageInfo = theme.backgroundImageInfo;
    raw[theme.name].foregroundImageFile = theme.foregroundImageFile;
    themeHelper.raw(raw);

    // Finished loading this theme
    imageQueue.await(function(err){
      return cb(err, theme);
    });

  }

}
