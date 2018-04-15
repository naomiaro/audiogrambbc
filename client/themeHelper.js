var preview = require('./preview');
var media = require('./media');
var utils = require('./utils');
var ui = require('./ui');
var transcript = require("./transcript");
var logger = require("./slack");

var themesRaw;
function _raw(_) {
    return arguments.length ? (themesRaw = _) : themesRaw;
}

function themeReset() {
    var themes = themesRaw,
        theme = preview.theme(),
        name = jQuery('#input-theme').val();
    var sel = jQuery('#input-theme').get(0);
    d3.select(sel.options[sel.selectedIndex]).datum(themes[theme.name]);
    preview.imgInfo(null);
    update(themes[name]);
}

function themeSave() {
    var theme = preview.theme();
    // Prompt for theme name
    var newName = prompt('Save theme with these settings.\nNOTE: The theme will be public to all users.\n\nEnter a theme name.\nUsing an existing theme name will overwrite that theme.', theme.name);
    if (newName != null) {
        // Get theme config
        var body = {},
            themes = themesRaw,
            themeJSON = JSON.stringify(theme),
            newTheme = JSON.parse(themeJSON),
            newThemeFullJSON = JSON.stringify(newTheme);
        if (themes[newName] && USER.email !== themes[newName].author) {
            utils.setClass('error', "You can't overwrite the existing '" + newName + "' theme because you weren't the one to orignally create it. Chosse anothe name.");
        } else {
            // Clear useless bits
            delete newTheme.raw;
            delete newTheme.backgroundImageFile;
            delete newTheme.backgroundImageInfo;
            delete newTheme.foregroundImageFile;
            if (!jQuery('#input-caption').val().length) {
                delete newTheme.caption;
            }
            // Upload image files
            var files = media.get();
            if (files.background && !files.background.mimetype.startsWith('video')) {
                body.background = files.background.path;
            } else if (files.background) {
                if (!confirm("You can't save themes with background videos. The theme will be saved, but with no placeholder background.")) return;
            }
            if (files.foreground) {
                body.foreground = files.foreground.path;
            }
            // Add name/author
            newTheme.name = newName;
            newTheme.author = USER.email;
            // Post
            body.theme = JSON.stringify(newTheme);
            $.ajax({
              url: "/themes/add/",
              type: "POST",
              data: JSON.stringify(body),
              contentType: "application/json; charset=utf-8",
              dataType: "json",
              cache: false,
              success: function(data) {
                utils.stats("increment", "user_activity.theme.save");
                utils.setClass("success", "The theme '" + newName + "' has been saved, and will be available next time you use Audiogram." );
                var msg = themes[newName] ? USER.name + " updated the theme '" + newName + "'" : USER.name + " added a new theme: '" + newName + "'";
                logger.info(msg);
              },
              error: error
            });
        }
    }
}

function backgroundType() {
    jQuery("#input-background-type-detail").children().hide();
    var type = jQuery("#input-background-type").val();
    if (type == "source") {
        useVideoAsBackground();
    } else if (type == "file") {
        jQuery("#input-background").show().click();
    } else if (type == "pid") {
        jQuery("#input-image-pid").show().click();
    } else if (type == "history") {
        var url = jQuery("#input-background-type option[value='" + type + "']").attr('data-src');
        console.log(url);
        if (!LOADING) media.loadFromURL('background', url, function(){});
    } else {
        if (!LOADING) updateImage();
    }
}

function loadImagePid() {
    var pid = prompt("Enter a valid image pid:", "p04zwtlb");
    if (pid != null) {
        utils.setClass("loading");
        updateImage(null, "background");
        var url = "/ichef/" + pid;
        var blob = null;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "blob";
        xhr.onload = function(data) {
            if (xhr.status == 200) {
                updateImage(null, "background", xhr.response);
                utils.setClass(null);
                logger.info(USER.name + " imported an image pid from iChef (" + pid + ")");
            } else {
                utils.setClass("error", "There was an error (" + xhr.status + ") fetching image '" + pid + "' form iChef.");
            }
        };
        xhr.send();
    }
}

function useVideoAsBackground() {
    d3.select('#loading-message').text('Loading video...');
    utils.setClass('loading');
    $('#videoload a').attr('data-used', true);
    var sourceBlob = media.blobs('audio');
    if (sourceBlob && sourceBlob.type.startsWith('video')) {
      updateImage("useVideoAsBackground", "background", sourceBlob, function() {
        utils.setClass(null);
        logger.info(USER.name + " used their audio source file as the background video");
      });
    } else {
      var id = $("#videoload a").attr("data-id");
      var mediaSelector = require("./mediaSelector");
      mediaSelector.poll(id, "video", { processStart: performance.now() });
    }
    d3.select('#videoload').classed('hidden', true);
}


function updateImage(event, type, blob, cb) {
    type = type ? type : event ? event.target.name : null;

    d3.select('#row-' + type).classed('error', false);
    var upload = this;

    if (!type || blob === false || (blob === undefined && (!upload.files || !upload.files[0]))) {
        var types = type ? [type] : ['background', 'foreground'];
        types.forEach(function(type) {
            preview.img(type, null);
            preview.imgInfo(type, null);
            jQuery("#input-" + type).val('');
            // var input = jQuery('#input-' + type);
            // input.replaceWith(input.val('').clone(true));
            media.upload(type, null);
        });
        utils.setClass(null);
        if (cb) cb(null);
        return true;
    }

    var imgFile = blob || this.files[0];
    if (event == 'useVideoAsBackground') {
        var obj = media.get('audio');
        obj.type = 'background';
        media.set(obj, 'background');
    } else {
        media.upload(type, imgFile);
    }
    var filename = blob
        ? 'blob'
        : jQuery('#input-' + type)
              .val()
              .split('\\')
              .pop();

    var size = imgFile.size / 1000000;
    if (size >= 150) {
        utils.setClass('error', 'Maximum upload size is 150MB. (' + type + ': ' + filename + ' - ' + Math.round(size * 10) / 10 + 'MB)');
        return;
    }

    if (type == 'background' && imgFile.type.startsWith('video')) {
        var vid = document.createElement('video');
        vid.autoplay = false;
        vid.loop = false;
        vid.style.display = 'none';
        vid.addEventListener(
            'loadeddata',
            function() {
                setTimeout(function() {
                    preview.img(type, vid);
                    preview.imgInfo(type, { type: imgFile.type, height: vid.videoHeight, width: vid.videoWidth, duration: vid.duration });
                });
            },
            false
        );
        var source = document.createElement('source');
        source.type = imgFile.type;
        source.src = window.URL.createObjectURL(imgFile);
        vid.appendChild(source);
        if (!blob) logger.info(USER.name + ' uploaded a video ' + type + ' (' + filename + ')');
    } else if ((type == 'background' && imgFile.type.startsWith('image')) || imgFile.type.endsWith('png')) {
        function getImage(file) {
            var imageFile = new Image();
            imageFile.src = window.URL.createObjectURL(file);
            return imageFile;
        }

        imgImage = getImage(imgFile);
        preview.img(type, imgImage);
        imgImage.onload = function() {
            preview.imgInfo(type, { type: imgFile.type, height: this.height, width: this.width });
            if (!blob) logger.info(USER.name + ' uploaded an image ' + type + ' (' + filename + ')');
        };
    } else {
        utils.setClass('error', "That file type can't be used in the " + type + '. (' + filename + ')');
        return true;
    }
    utils.setClass(null);
    if (cb) cb(null);
}
jQuery(document).on('change', '#input-background', updateImage);
jQuery(document).on('change', '#input-foreground', updateImage);

function updateCaption(value) {
    if (typeof value == 'string') {
        jQuery('#input-caption').val(value);
    } else {
        value = jQuery('#input-caption:visible').length ? jQuery('#input-caption').val() : '';
    }
    preview.caption(value);
}
d3.select("#input-caption").on("change keyup", updateCaption);

function update(theme) {
    if (theme && themesRaw[theme.name]) {
        theme.backgroundImageFile = jQuery.extend(true, {}, themesRaw[theme.name].backgroundImageFile);
        theme.backgroundImageInfo = jQuery.extend(true, {}, themesRaw[theme.name].backgroundImageInfo);
        theme.foregroundImageFile = jQuery.extend(true, {}, themesRaw[theme.name].foregroundImageFile);
    }
    var sel = jQuery('#input-theme').get(0);
    var theme = theme || d3.select(sel.options[sel.selectedIndex]).datum();
    preview.theme(theme);
    updateImage();
    if (theme.caption) {
        var caption = theme.caption.text || '';
        updateCaption(caption);
    }
    $('#videoload a[data-used=true]')
        .parent()
        .removeClass('hidden');
    // Reset custom config fields
    jQuery('.themeConfig').each(function() {
        if (this.name != 'size') {
            // XXX hack to set subproperties (eg: theme.prop.subprob) without the use of `eval`. Need a nicer wary of doing it.
            prop = this.name.split('.');
            if (prop.length == 1) {
                this.value = theme[prop[0]];
            } else if (prop.length == 2) {
                this.value = theme[prop[0]][prop[1]];
            } else if (prop.length == 3) {
                this.value = theme[prop[0]][prop[1]][prop[2]];
            }
        }
    });
    // Force sizes if theme doesn't support all of them
    jQuery("#input-size [data-orientation='landscape']").attr('disabled', (themesRaw[theme.name].backgroundImage && !themesRaw[theme.name].backgroundImage.landscape) || (themesRaw[theme.name].foregroundImage && !themesRaw[theme.name].foregroundImage.landscape) ? true : false);
    jQuery("#input-size [data-orientation='square']").attr('disabled', (themesRaw[theme.name].backgroundImage && !themesRaw[theme.name].backgroundImage.square) || (themesRaw[theme.name].foregroundImage && !themesRaw[theme.name].foregroundImage.square) ? true : false);
    jQuery("#input-size [data-orientation='portrait']").attr('disabled', (themesRaw[theme.name].backgroundImage && !themesRaw[theme.name].backgroundImage.portrait) || (themesRaw[theme.name].foregroundImage && !themesRaw[theme.name].foregroundImage.portrait) ? true : false);
    jQuery('#input-size').val(jQuery("#input-size option[data-orientation='" + theme.orientation + "']:not(':disabled'):first").val());
    if (jQuery('#input-size option:selected').is(':disabled')) {
        jQuery('#input-size').val(jQuery("#input-size option:not(':disabled'):first").val());
    }
    if (jQuery().slider) {
        // Reset wave sliders
        jQuery('.wave-slider[name=vertical]').slider('values', [(theme.wave.y - theme.wave.height / 2) * 100, (theme.wave.y + theme.wave.height / 2) * 100]);
        jQuery('.wave-slider[name=horizontal]').slider('values', [(theme.wave.x - theme.wave.width / 2) * 100, (theme.wave.x + theme.wave.width / 2) * 100]);
        // Reset background sliders
        jQuery('.background-slider[name=vertical]').slider('values', [theme.backgroundPosition.y * 100, (theme.backgroundPosition.y + theme.backgroundPosition.height) * 100]);
        jQuery('.background-slider[name=horizontal]').slider('values', [theme.backgroundPosition.x * 100, (theme.backgroundPosition.x + theme.backgroundPosition.width) * 100]);
        // Reset subs sliders
        jQuery('.subs-slider[name=vertical]').slider('values', [theme.subtitles.margin.vertical * 100]);
        jQuery('.subs-slider[name=horizontal]').slider('values', [theme.subtitles.margin.horizontal * 100]);
        // Reset captions sliders
        jQuery('.caption-slider[name=vertical]').slider('values', [theme.caption.margin.vertical * 100]);
        jQuery('.caption-slider[name=horizontal]').slider('values', [theme.caption.margin.horizontal * 100]);
    }
    // Show options for settings not specified in theme
    if (theme.name == 'Custom') {
        ui.showAdvancedConfig();
    } else {
        d3.select('#row-background').classed('hidden', theme.raw.backgroundImage);
        d3.select('#row-wave').classed('hidden', theme.raw.wave || theme.raw.pattern == 'none');
        d3.select('#row-caption').classed('hidden', !(theme.raw.caption && theme.raw.caption.hasOwnProperty('text')));
        d3.selectAll('.row.caption-advanced').classed('hidden', !jQuery('#section-theme').hasClass('advanced'));
        d3.selectAll('.row.background-advanced').classed('hidden', !jQuery('#section-theme').hasClass('advanced'));
        d3.select('#row-subs-alias').classed('hidden', !jQuery('#section-theme').hasClass('advanced'));
        // Show "advanced" button, if some rows are still hidden
        d3.select('#row-theme').classed('advanced', jQuery('#section-theme > .row:not(:visible)').length);
        d3.select('#config-save').classed('hidden', !jQuery('#section-theme').hasClass('advanced'));
        d3.select('#row-foreground').classed('hidden', !jQuery('#section-theme').hasClass('advanced'));
        if ($('#row-foreground:visible').length) {
            jQuery('#input-webcap').val('');
            webCapList();
        }
    }
    backgroundType();
    transcript.format();
    ui.windowResize(); // Bcause sometimes it makes the vertical scroll-bar appear, and elements need resizing
}

function updateThemeConfig() {
    preview.themeConfig(this.name, this.type == 'checkbox' ? this.checked : this.value);
    // if (this.name == 'subtitles.enabled') d3.select('#transcript-pane').classed('hidden', !this.checked);
    if (this.name.includes('subtitles')) {
        transcript.format();
        preview.redraw();
    }
}

function init() {
    d3.selectAll('.themeConfig').on('change', updateThemeConfig);
    d3.selectAll('#theme-reset').on('click', themeReset);
    d3.selectAll('#theme-save').on('click', themeSave);
    d3.select('#videoload a').on('click', useVideoAsBackground);
    jQuery(document).on('click', '#section-design .design-block .heading', function(e){
        jQuery("#section-design .design-block .heading").not(this).each(function(){
            jQuery(this).parent().find('.body').slideUp();
            jQuery(this).find(".fa-minus").hide();
            jQuery(this).find(".fa-plus").show();
        });
        jQuery(this).parent().find('.body').slideToggle();
        jQuery(this).find(".fa-minus").toggle();
        jQuery(this).find(".fa-plus").toggle();
    });
    jQuery(document).on("click", "#input-image-pid", loadImagePid);
    jQuery(document).on("change", "#input-background-type", backgroundType);
}

module.exports = {
    raw: _raw,
    update,
    reset: themeReset,
    updateImage,
    init
}