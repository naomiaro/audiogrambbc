var d3 = require("d3");
var utils = require('./utils');

var video = document.querySelector("video");

function kill() {
  jQuery("#mediaPlayer").html("");
}

function exit() {
  jQuery(document).trigger('exit-video');
}

function update(url, data) {
  
  var timestamp = d3.timeFormat("%Y-%m-%d-%-I:%M%p")(new Date).toLowerCase(),
  filename = "Audiogram" + timestamp + ".mp4",
  ratio = data.theme.height/data.theme.width;
  
  ratio = (ratio>1) ? 1 : ratio;
  
  d3.selectAll("#download-btns .download-video")
  .attr("download", filename)
  .attr("href", url);
  
  d3.select("#download-btns .download-srt")
  .attr("download", filename.replace(".mp4",".srt"))
  .attr("href", url.replace(".mp4",".srt"));
  
  d3.select("#download-btns .download-ebu")
  .attr("download", filename.replace(".mp4",".xml"))
  .attr("href", url.replace(".mp4",".xml"));
  
  d3.select("#video-link")
  .attr("href", url);
  
  d3.select(video).select("source")
  .attr("src", url);

  jQuery('#sharing-link').attr('href', window.location.origin + url);
  jQuery('#sharing-link-text').val(window.location.origin + url);
  
  const id = data.id || url.split('/')[2].split('.')[0];
  const private = data.private != undefined ? data.private : jQuery('#input-private').val();
  const user = data.user ? data.user : USER.email;

  jQuery("#sharing-private").val(private);
  jQuery("#sharing-private").attr('data-id', id);

  if (user == USER.email) {
    jQuery("#sharing-private").attr("disabled", false);
    jQuery("#sharing-private").parent().attr("title", null);
    jQuery("#sharing-private").parent().addClass("tooltip-info");
  } else {
    jQuery("#sharing-private").attr("disabled", true);
    jQuery("#sharing-private").parent().attr("title", 'Only the owner can change these settings');
    jQuery("#sharing-private").parent().addClass('tooltip-info');
  }
  
  // d3.select('#return').on('click', function() {
  //     d3.event.preventDefault();
  //     kill();
  //     utils.setClass(null);
  // });
  
  // SMP
  smpRequireMap = {
    'jquery-1.9'  : 'https://static.bbci.co.uk/frameworks/jquery/0.3.0/sharedmodules/jquery-1.9.1',
    'swfobject-2' : 'https://static.bbci.co.uk/frameworks/swfobject/0.1.10/sharedmodules/swfobject-2',
    'bump-3'      : 'https://emp.bbci.co.uk/emp/bump-3/bump-3'
  };
  window.require({
    paths: smpRequireMap,
    waitSeconds: 30
  });
  
  window.require(['bump-3'],function ($) {
    var settings = {
      product: "news",
      autoplay: true,
      playlistObject: {
        holdingImageURL: window.location.protocol + "//" + window.location.host + url.replace(".mp4",".jpg"),
        items: [{
          href: [
            {
              url: window.location.protocol + "//" + window.location.host + url,
              format: "plain"
            }
          ]
        }]
      }
    }
    var mediaPlayer = $('#mediaPlayer').player(settings);
    mediaPlayer.load();
    mediaPlayer.bind('playing', function(e) {
      var width = jQuery('#mediaPlayer').width();
      jQuery('#mediaPlayer').height(width * Math.min(ratio,1));
      mediaPlayer.setData({name: "SMP.subtitlesHref", data:{ url : window.location.protocol + "//" + window.location.host + url.replace(".mp4",".xml") }});
    });
    jQuery(document).on('exit-video', function(e){
      mediaPlayer.pause();
      jQuery("#submit").addClass("hidden");
      jQuery("#view").removeClass("hidden");
    })
    jQuery(document).on('click', ".rendered #return", function(e){
      utils.navigate('edit');
    });
    jQuery(document).on("click", "#view", function(e) {
      utils.navigate('view');
      mediaPlayer.currentTime(0);
      mediaPlayer.play();
    });
  });
  
}

module.exports = {
  kill: kill,
  exit,
  update: update
}
