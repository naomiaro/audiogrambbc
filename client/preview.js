var d3 = require("d3"),
    utils = require("./utils.js"),
    audio = require("./audio.js"),
    video = require("./video.js"),
    minimap = require("./minimap.js"),
    sampleWave = require("./sample-wave.js"),
    logger = require("../lib/logger/"),
    getRenderer = require("../renderer/"),
    getWaveform = require("./waveform.js"),
    transcript = require("./transcript.js");

var context = d3.select("canvas").node().getContext("2d");

var theme,
    caption,
    file,
    img = {},
    imgInfo = {},
    selection;

function _file(_) {
    return arguments.length ? (file = _) : file;
}

function _img(type, _) {
    if (arguments.length > 1) {
        img[type] = _;
        if (img[type] == null) redraw();
    }
    return img[type];
}

function _imgInfo(type, _) {
    if (arguments.length > 0) {
        var res = (_!==undefined) ? (imgInfo[type] = _, redraw()) : imgInfo[type];
    } else {
        var res = imgInfo = {};
    }
    return res;
}

function _theme(_) {
    return arguments.length ? (theme = _, redraw()) : theme;
}

function _themeConfig(prop, val) {
    if (arguments.length > 1) {
        if (prop == "size") {
            var size = val.split("x");
            theme.width = +size[0];
            theme.height = +size[1];
        } else {
            // XXX hack to set subproperties (eg: theme.prop.subprob) without the use of `eval`. Need a nicer wary of doing it.
            prop = prop.split(".");
            if (prop.length == 1) {
                theme[prop[0]] = val;
            } else if (prop.length == 2) {
                theme[prop[0]][prop[1]] = val;
            } else if (prop.length == 3) {
                theme[prop[0]][prop[1]][prop[2]] = val;
            } else {
                return false;
            }
        }
        redraw();
    }
    return theme[prop];
}

function _caption(_) {
    return arguments.length ? (theme.caption.text = _, redraw()) : theme.caption.text;
}

function _selection(_) {
    return arguments.length ? (selection = _) : selection;
}

bbcDog = new Image();
bbcDog.src = "/images/bbc.png";

minimap.onBrush(function (extent) {

    var duration = audio.duration();
    // var minimapWidth = d3.select("#minimap svg").node().getBoundingClientRect().width;
    var minimapWidth = jQuery("#minimap svg").width();

    selection = {
        duration: duration * (extent[1] - extent[0]),
        start: extent[0] ? extent[0] * duration : null,
        end: extent[1] <= 1 ? extent[1] * duration : null
    };

    var x1 = Math.min(Math.max(extent[0] * minimapWidth - 38, 0), minimapWidth - 150),
        x2 = Math.min(Math.max(extent[1] * minimapWidth - 38, 75), minimapWidth - 75),
        diff = x2 - x1 - 75;

    if (diff < 0) {
        x1 += diff / 2;
        x2 -= diff / 2;
    }

    transcript.format();
    transcript.highlight((selection.start || 0), (selection.end || selection.duration));

    var startDisp = utils.formatHMS(selection.start);
    if (startDisp.startsWith('00:')) startDisp = startDisp.slice(3);
    var endDisp = utils.formatHMS(selection.end);
    if (endDisp.startsWith('00:')) endDisp = endDisp.slice(3);

    d3.select("#start")
        .property("value", startDisp)
        .style("left", x1 + "px");
    d3.select("#end")
        .property("value", endDisp)
        .style("left", x2 + "px");

    var durationStr = utils.formatHMS(selection.duration);
    d3.select("#duration strong").text(durationStr.slice(1))
        .classed("red", theme && theme.maxDuration && theme.maxDuration < selection.duration);

    jQuery("#duration .current").text("0:00.0");

    if (extent[0] == 0 && extent[1] == 1) {
        jQuery('#minimap').removeClass('trimmed');
        setTimeout(() => {
            transcript.format();
        }, 500); 
    } else {
        jQuery("#minimap").addClass("trimmed");        
    }

    redraw();

});

// Resize video and preview canvas to maintain aspect ratio
function resize(width, height) {

    width = width || theme.width;
    height = height || theme.height;
    var landscape = width > height;

    var bodyClass = jQuery("body").attr("class");
    jQuery("body").attr("class", null);
    var wrapperWidth = d3.select("#canvas").node().getBoundingClientRect().width;
    var wrapperHeight = wrapperWidth * (9/16);
    jQuery("body").attr("class", bodyClass);
    if (!wrapperWidth) return;

    // var widthFactor = wrapperWidth / width;
    // var heightFactor = (wrapperWidth * 9 / 16) / height;

    var canvasHeight = wrapperHeight;
    var canvasWidth = wrapperHeight / (height / width);

    var heightFactor = canvasHeight / height;
    var widthFactor = canvasWidth / width;

    jQuery("canvas")
        .attr("width", canvasWidth)
        .attr("height", canvasHeight);
    
    jQuery("#canvas").height(canvasHeight);

    // jQuery("video").attr("height", canvasHeight);

    // jQuery("#video").height(canvasHeight);

    context.setTransform(widthFactor, 0, 0, heightFactor, 0, 0);

}

function redraw(overrideSubs) {

    if (!jQuery("canvas").is(":visible") || document.readyState != 'complete' || !theme) return;

    jQuery("#submit").removeClass("hidden");
    jQuery("#view").addClass("hidden");

    resize(theme.width, theme.height);
    theme.orientation = (theme.width == theme.height) ? "square" : (theme.width > theme.height) ? "landscape" : "portrait";
    theme.subtitles.enabled = +jQuery('#input-subtitles:checked').length;
    var renderer = getRenderer(theme);
    
    // BBC watermark
    renderer.bbcDog(bbcDog || null);
    
    // Render images
    var foreground = img.foreground ? img.foreground : theme.foregroundImageFile ? theme.foregroundImageFile : null;
    if (jQuery('#input-overlay-type').val() == 'none') foreground = null;
    var background = img.background ? img.background : theme.backgroundImageFile ? theme.backgroundImageFile : null;
    if (jQuery("#input-background-type").val() == 'color') background = null;
    renderer.foregroundImage(jQuery.isEmptyObject(foreground) ? null : foreground);
    renderer.backgroundImage(jQuery.isEmptyObject(background) ? null : background);
        
    var start = selection ? selection.start : 0;
    var end = selection ? selection.end : Infinity;
    var subtitles = overrideSubs || transcript.toSubs();
    if (audio.isPlaying()) {
        var time = audio.currentTime();
        time -= start;
    } else if (subtitles[0]) {
        var time = subtitles[0].start;
    }

    renderer.drawFrame(context, {
        caption: theme.caption.text,
        subtitles,
        waveform: sampleWave,
        backgroundInfo: (img.background && imgInfo.background ? imgInfo.background : theme.backgroundImageInfo ? theme.backgroundImageInfo : null),
        preview: true,
        start,
        end,
        frame: 0,
        time: time || 0
    });

    if (!audio.isPlaying()) {
        var themeHelper = require('./themeHelper');
        themeHelper.updateDesignSummaries();
    };

}

function loadAudio(audioFile, cb) {
    d3.queue()
        .defer(getWaveform, audioFile)
        .defer(audio.src, audioFile)
        .await(function (err, data) {
            if (err) {
                return cb ? cb(err) : err;
            }

            utils.setClass(null);
            file = audioFile;
            minimap.redraw(data.peaks);

            if (cb) cb(err);
            return;

        });

}

module.exports = {
    caption: _caption,
    theme: _theme,
    themeConfig: _themeConfig,
    file: _file,
    img: _img,
    imgInfo: _imgInfo,
    loadAudio: loadAudio,
    redraw: redraw,
    resize,
    selection: _selection
};
