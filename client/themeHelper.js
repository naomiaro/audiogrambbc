var preview = require('./preview');
var media = require('./media');
var utils = require('./utils');
var ui = require('./ui');
var transcript = require("./transcript");
var logger = require("./slack");

var defaultTheme = require('../settings/theme_default');

var themesRaw = {};
function _raw(_) {
    return arguments.length ? (themesRaw = _) : themesRaw;
}

function themeReset() {
    if (confirm("Reset design to theme defaults?")) {
        var current = preview.theme();
        updateImage();
        preview.imgInfo(null);
        update(themesRaw[current.id]);
    }
}

function themeSave() {
    var theme = preview.theme();
    // Prompt for theme name
    var newName = prompt('Save theme with these settings.\n\nEnter a theme name.\nUsing an existing theme name will overwrite that theme.', theme.name);
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
            // Add preview image
            var subs = transcript.toSubs();
            var lorem = "Lorem ipsum dolor sit amet consectetur adipiscing elit Phasellus mollis massa eu ornare consectetur orci mauris lobortis elit accumsan condimentum nulla nisi in mauris Duis sit amet lacinia ante non placerat dui Aenean commodo ligula ac hendrerit cursus Proin et dui id ligula lobortis accumsan Phasellus iaculis condimentum massa a porta Phasellus turpis mi porta nec molestie eget convallis sit amet metus Praesent in nunc id ligula tempor egestas Interdum et malesuada fames ac ante ipsum primis in faucibus Curabitur pharetra nec ex in pulvinar";
            for (var i = 0; i < subs[0].lines.length; i++) {
                var line = subs[0].lines[i];
                var dummy = lorem.slice(0, line.length).trim();
                lorem = lorem.slice(line.length);
                lorem = lorem.slice(lorem.indexOf(" ")).trim();
                subs[0].lines[i] = dummy;
            }
            preview.redraw(subs);
            body.preview = jQuery("canvas")[0].toDataURL();
            preview.redraw();
            // Post
            body.theme = JSON.stringify(newTheme);
            $.ajax({
              url: "/themes/save/",
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
                loadThemeList();
              },
              error: error
            });
        }
    }
}

function waveformType() {
    var type = jQuery("#input-pattern").val();
    d3.select('#input-pattern-color').classed('hidden', type == 'none');
    d3.select('#input-pattern-position').classed('hidden', type == 'none');
}

function overlayType() {
    jQuery("#input-overlay-type-detail").children().hide();
    var type = jQuery("#input-overlay-type").val();
    if (type == "file") {
        jQuery("#input-foreground").show();
        setTimeout(function () {
            jQuery("#input-foreground").click();
        }, 1000);
    } else if (type == "webcap") {
        jQuery("#input-webcap-wrapper").show();
        var webcap = require('./webcap');
        webcap.use();
    } else if (type == "history") {
        var url = jQuery("#input-overlay-type option[value='history']").attr('data-src');
        if (!LOADING) media.loadFromURL('foreground', url, function () { });
    } else {
        if (!LOADING) updateImage(null, 'foreground');
    }
}

function backgroundType() {
    jQuery("#input-background-type-detail").children().hide();
    jQuery('#design-background .position-wrapper').show();
    var type = jQuery("#input-background-type").val();
    if (type == "source") {
        useVideoAsBackground();
    } else if (type == "file") {
        jQuery("#input-background").show();
    } else if (type == "color") {
        jQuery("#input-color-wrapper").show();
        jQuery('#design-background .position-wrapper').hide();
    } else if (type == "pid") {
        jQuery("#input-image-pid").show().click();
    } else if (type == "history") {
        var url = jQuery("#input-background-type option[value='history']").attr('data-src');
        if (!LOADING) media.loadFromURL('background', url, function(){});
    } else {
        if (!LOADING) updateImage(null, 'background');
    }
    if (!LOADING) preview.redraw();
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
        jQuery('#input-image-pid').attr('data-pid', pid);
    }
}

function useVideoAsBackground() {
    if (!jQuery('body').hasClass('loading')) {
        d3.select('#loading-message').text('Loading video...');
        utils.setClass('loading');
    }
    var sourceBlob = media.blobs('audio');
    if (sourceBlob && sourceBlob.type.startsWith('video')) {
      updateImage("useVideoAsBackground", "background", sourceBlob, function() {
        utils.setClass(null);
      });
    } else {
      var mediaSelector = require("./mediaSelector");
      mediaSelector.poll(id, "video", { processStart: performance.now() });
    }
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
    var filename = blob ? 'blob' : jQuery('#input-' + type).val().split('\\').pop();

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

function loadThemeImages(theme, cb) {
    if (!theme.backgroundImage && !theme.foregroundImage) {
        return cb(null, theme);
    }
    theme.backgroundImage = theme.backgroundImage ? theme.backgroundImage.landscape || theme.backgroundImage : null;
    theme.foregroundImage = theme.foregroundImage ? theme.foregroundImage.landscape || theme.foregroundImage : null;

    var imageQueue = d3.queue();

    // Load background images
    if (theme.backgroundImage) {
        theme.backgroundImageFile = theme.backgroundImageFile || {};
        theme.backgroundImageInfo = theme.backgroundImageInfo || {};
        imageQueue.defer(function(imgCb) {
            theme.backgroundImageFile = new Image();
            theme.backgroundImageFile.onload = function() {
                theme.backgroundImageInfo = { type: "image", height: this.height, width: this.width };
                return imgCb(null);
            };
            theme.backgroundImageFile.onerror = function(e) {
                console.warn(e);
                return imgCb(e);
            };
            theme.backgroundImageFile.src = "/settings/backgrounds/" + theme.backgroundImage;
        });
    }
    // Load foreground images
    if (theme.foregroundImage) {
        theme.foregroundImageFile = theme.foregroundImageFile || {};
        theme.foregroundImageInfo = theme.foregroundImageInfo || {};
        imageQueue.defer(function(imgCb) {
            theme.foregroundImageFile = new Image();
            theme.foregroundImageFile.onload = function() {
                theme.foregroundImageInfo = { type: "image", height: this.height, width: this.width };
                return imgCb(null);
            };
            theme.foregroundImageFile.onerror = function(e) {
                console.warn(e);
                return imgCb(e);
            };
            theme.foregroundImageFile.src = "/settings/backgrounds/" + theme.foregroundImage;
        });
    }


    // Finished loading this theme
    imageQueue.await(function(err) {
        // Update raw themes
        themesRaw[theme.id].backgroundImageFile = theme.backgroundImageFile;
        themesRaw[theme.id].backgroundImageInfo = theme.backgroundImageInfo;
        themesRaw[theme.id].foregroundImageFile = theme.foregroundImageFile;
        return cb(err, theme);
    });
}

function initialiseTheme(theme, cb) {
  if (!themesRaw[theme.id]) {
    // Initialise theme
    var themeStr = JSON.stringify(theme);
    themesRaw[theme.id] = JSON.parse(themeStr);
    return loadThemeImages(theme, cb);
  } else {
    return cb(null, theme);
  }
}

function update(theme, cb) {
    theme = jQuery.extend(true, JSON.parse(JSON.stringify(defaultTheme)), theme);
    theme.id = theme.id || theme.name;
    var dispName = theme.name.slice(0, 60);
    if (theme.name.length > dispName.length) dispName = dispName.trim() + '...';
    jQuery("#theme-change span").text(dispName);
    initialiseTheme(theme, function (err, theme) {
        if (err || !theme) {
            console.error(err || "Error initialising theme");
            if (cb) return cb(err);
        };
        apply(theme, function(err){
            if (cb) return cb(err);
        });
    })
}

function apply(theme, cb) {
    if (!theme) {
        var err = "No theme defined";
        console.warn(err);
        return cb(err);
    }
    if (theme && themesRaw[theme.id]) {
        theme.backgroundImageFile = themesRaw[theme.id].backgroundImageFile;
        theme.backgroundImageInfo = themesRaw[theme.id].backgroundImageInfo;
        theme.foregroundImageFile = themesRaw[theme.id].foregroundImageFile;
    }
    preview.theme(theme);
    updateImage();
    if (theme.caption) {
        var caption = theme.caption.text || '';
        updateCaption(caption);
    }
    // Can't handle short color codes
    if (theme.backgroundColor.length == 4) {
        var shortColor = theme.backgroundColor.slice(1);
        theme.backgroundColor = `#${shortColor}${shortColor}`;
    }
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
    // Reset UI
    var metadata = media.get('audio');
    var isVideo = metadata ? metadata.mimetype ? metadata.mimetype.startsWith('video') : metadata.name.endsWith('mp4') : false;
    jQuery("#input-background-type").val(isVideo ? "source" : theme.backgroundImage ? "default" : "file");
    if (theme.customBackgroundPath) jQuery('#input-background-type').val("history");
    if (theme.noBackground) jQuery('#input-background-type').val("color");
    jQuery("#input-overlay-type").val("default");
    if (theme.customForegroundPath) jQuery('#input-overlay-type').val("history");
    jQuery("#input-pattern").val(theme.pattern);
    updateDesignTab();
    transcript.format();
    ui.windowResize();
    preview.theme(theme);
    jQuery(".design-block button.button-prompt").each(function(){
        var val = jQuery(this).find('input').val();
        jQuery(this).find('span').text(val);
    });
    cb(null);
}

function updateThemeConfig() {
    preview.themeConfig(this.name, this.type == 'checkbox' ? this.checked : this.value);
    if (this.name.includes('subtitles')) {
        transcript.format();
        preview.redraw();
    }
}

function updateDesignSummaries() {
    // Background
    var type = jQuery('#input-background-type').val();
    var summary = jQuery('#input-background-type option[value="' + type + '"]').text();
    var metadata = media.get('background');
    var isVideo = metadata ? metadata.mimetype ? metadata.mimetype.startsWith('video') : metadata.name.endsWith('mp4') : false;
    if (type == 'file') {
        summary = metadata ? isVideo ? "Video" : "Image" : "None";
        if (metadata) summary += ": " + metadata.name;
    } 
    if (type == 'pid') {
        var pid = jQuery("#input-image-pid").attr("data-pid");
        if (pid) summary += ": " + pid;
    }
    if (type == 'history') {
        summary = "Loaded from version history";
    }
    jQuery('#design-background .summary').text(utils.trimText(summary, 50));
    // Overlay
    var type = jQuery('#input-overlay-type').val();
    var summary = jQuery('#input-overlay-type option[value="' + type + '"]').text();
    if (type == 'file') {
        var metadata = media.get('foreground');
        summary = metadata ? "Image: " + metadata.name : "None";
    }
    if (type == 'webcap') {
        summary += ": " + jQuery("#input-webcap").val();
    }
    if (type == 'history') {
        summary = "Loaded from version history";
    }
    jQuery('#design-overlay .summary').text(utils.trimText(summary, 50));
    // Waveform
    var type = jQuery('#input-pattern').val();
    var summary = jQuery('#input-pattern option[value="' + type + '"]').text();
    jQuery('#design-waveform .summary').text(utils.trimText(summary, 50));
    // Subtitles
    var currentTheme = preview.theme();
    var unchanged = JSON.stringify(currentTheme.subtitles) == JSON.stringify(themesRaw[currentTheme.id].subtitles)
    jQuery('#design-subtitles .summary').text(unchanged ? "Theme Default" : "Custom");
    // Text
    var text = jQuery('#input-caption').val().replace(/(\n)+/g, ' ');
    if (text.trim().length) {
        var summary = text.slice(0, 32);
        if (text.length > summary.length) summary = summary.trim() + "...";
    } else {
        var summary = "None";
    }
    jQuery('#design-caption .summary').text(utils.trimText(summary, 50));
    // Size
    var type = jQuery('#input-size').val();
    var summary = jQuery('#input-size option[value="' + type + '"]').text();
    jQuery('#design-size .summary').text(utils.trimText(summary, 50));
}

function updateDesignTab() {
    backgroundType();
    overlayType();
    waveformType();
}

function loadThemeList(cb) {
    var bodyHeight = jQuery(window).height() - 200;
    jQuery("#themes .modal-body").css('height', bodyHeight + "px");
    var recent = USER.config && USER.config.themes_recent ? USER.config.themes_recent.split(',') : [];

    jQuery.getJSON("/themes/list", function(data) {
        if (data.error) {
            console.log("Error fetching themes", data.error);
            return cb(data.error);
        }
        // Add themes
        data.themes.forEach(function(theme){
            var id = theme.id;
            var name = theme.name;
            var deleted = theme.deleted;
            if (!deleted && id && name && name !== "default" && name !== "Custom") {
                var recentIndex = recent.indexOf(id);
                var clone = jQuery("#themes-all .theme.template:first").clone();
                jQuery("#themes-all .themes").append(clone);
                clone.removeClass("template");
                clone.attr("data-id", id);
                clone.attr("data-name", name);
                clone.attr("data-count", theme.useCount);
                clone.attr("data-user", theme.user);
                if (recentIndex > -1) clone.attr("data-recent", recentIndex);
                if (theme.videoOptimised) clone.attr("data-videoOptimised", true);
                clone.find(".title").text(name);
                clone.find(".preview img").attr("src", `/settings/themes/${id}`);
                if (theme.user == USER.email) {
                    clone.find(".edit").removeClass('hidden');
                }
            }
        });
        // Move recently used
        var recentCount = jQuery('#themes-all .theme[data-recent]').length;
        for (let i = 0; i < recentCount; i++) {
            var theme = jQuery(`#themes-all .theme[data-recent=${i}]`);
            theme.appendTo("#themes-recent .themes");
        }
        if (!recentCount) jQuery('#themes-recent').hide();
        // Sort
        sortThemes();
        if (cb) return cb(null);
    });
}

function renameTheme(e) {
    utils.stopIt(e);
    var theme = jQuery(this).parents('.theme:first');
    var user = theme.attr('data-user');
    if (user != USER.email) {
        return alert('Only the original author of a theme can edit it.');
    }
    var themeId = theme.attr('data-id');
    var currentName = theme.attr('data-name');
    var newName = prompt('Update the theme name:', currentName);
    if (newName && newName != currentName && newName != '') {
        var postData = { id: themeId, name: newName };
        jQuery.post('/themes/update', postData)
            .fail(function (xhr, status, error) {
                return alert('Sorry, an error occured.\n\n' + status);
            })
            .done(function (data) {
                if (data.error) {
                    return alert('Sorry, an error occured.\n\n' + data.error);
                }
                theme.attr('data-name', newName);
                theme.find('.info .title').text(newName);
            });
    }
}

function deleteTheme(e) {
    utils.stopIt(e);
    var theme = jQuery(this).parents('.theme:first');
    var user = theme.attr('data-user');
    if (user != USER.email) {
        return alert('Only the original author of a theme can delete it.');
    }
    var confirmed = confirm('Are you sure you want to delete this theme?\nYou cannot undo this action!');
    if (confirmed) {
        var themeId = theme.attr('data-id');  
        jQuery.ajax({
            url: `/themes/${themeId}`,
            type: 'DELETE',
            failure: function (xhr, status, error) {
                return alert('Sorry, an error occured.\n\n' + status);
            },
            success: function (data) {
                if (data.result) {
                    return alert('Sorry, an error occured.\n\n' + data.error);
                }
                theme.hide();
            }
        });      
    }
}

function selectTheme() {
    var themeId = jQuery(this).attr('data-id');
    utils.setClass('loading');
    jQuery('.modal').modal('hide');
    jQuery.getJSON("/themes/config/" + themeId, function(data) {
        if (data.error) return console.log(data.error);
        jQuery('#input-theme').val(themeId);
        update(data.config, function(){
            var audioLoaded = media.get('audio');
            if (audioLoaded) {
                utils.setClass(null);
            } else {
                utils.setClass('loading', 'Loading audio source...');
            }
        });
    });
}

function sortThemes() {
    var by = jQuery('#themes-all .themes-filter').val();
    var all = jQuery("#themes-all .theme:not(.template)");
    var names = [];
    var counts = [];
    all.each(function (i, el) {
        var name = jQuery(el).attr('data-name')
        names.push(name.toLocaleLowerCase());
        var count = jQuery(el).attr('data-count');
        if (counts.indexOf(counts) == -1) counts.push(count);
    });
    var namesSorted = names.sort();
    all.each(function (i, el) {
        var name = jQuery(el).attr('data-name');
        var position = namesSorted.indexOf(name.toLocaleLowerCase());
        jQuery(el).attr('data-sort', position);
    });
    all.sort(function (a, b) {
        return +jQuery(a).attr('data-sort') - +jQuery(b).attr('data-sort');
    });
    jQuery("#themes-all .themes").html(all);
    if (by == 'count') {
        var position = 0;
        counts = counts.sort().reverse();
        for (let i = 0; i < counts.length; i++) {
            var themes = jQuery(`#themes-all .theme[data-count=${counts[i]}]`).each(function (i, el){
                jQuery(el).attr('data-sort', position);
                position++;
            });
        }
        all.sort(function (a, b) {
            return +jQuery(a).attr('data-sort') - +jQuery(b).attr('data-sort');
        });
        jQuery("#themes-all .themes").html(all);
    }
}

function openModal() {
    jQuery('#loading-message').text('Selecting theme...');
    var mediaBlobs = media.blobs();
    if (mediaBlobs && mediaBlobs.audio && mediaBlobs.audio.type.startsWith('video')) {
        var count = jQuery('#themes-all .theme[data-videoOptimised=true]').length;
        if (count) {
            jQuery('#themes-video').show();
            jQuery('#themes-all .theme[data-videoOptimised=true]').each(function(i, el){
                jQuery(el).appendTo("#themes-video .themes");
            });
        }
    } else {
        var count = jQuery('#themes-video .theme').length;
        if (count) {
            jQuery('#themes-video .theme').each(function (el) {
                jQuery(el).appendTo("#themes-all .themes");
            });
            // TODO: reorder all
        }
        jQuery('#themes-video').hide();
    }
    jQuery('#themes').modal('show'); 
}

function init(cb) {
    // d3.selectAll('.themeConfig').on('change', updateThemeConfig);
    jQuery(document).on("click", ".theme .theme-delete", deleteTheme);
    jQuery(document).on("click", ".theme .theme-edit", renameTheme);
    jQuery(document).on("change", ".themeConfig", updateThemeConfig);
    jQuery(document).on("click", "#theme-change", openModal);
    jQuery(document).on("change", '#themes-all .themes-filter', sortThemes);
    d3.selectAll('#theme-reset').on('click', themeReset);
    d3.selectAll('#theme-save').on('click', themeSave);
    jQuery(document).on('show.bs.modal', '#themes', function (e) {
        jQuery("#themes").addClass('active');
    });
    jQuery(document).on('hide.bs.modal', '#themes', function (e) {
        jQuery("#themes").removeClass('active');
    });
    jQuery(document).on('hidden.bs.modal', '#themes', function (e) {
        if (jQuery('body').hasClass('loading') && jQuery('#loading-message').text() == 'Selecting theme...') {
            jQuery('#themes').modal('show'); 
        } else {
            jQuery('.modal').modal('hide');
        }
    });
    jQuery(document).on('shown.bs.modal', '#themes', function (e) {
        var current = preview.theme();
        if (!current) {
            jQuery("#themes .modal-footer").hide();
            jQuery("body").attr("class", "loading");
        } else {
            jQuery("#themes .modal-footer").show();
        }
    });
    jQuery(document).on('click', '#section-design .design-block .heading', function(e){
        var body = jQuery(this).parent().find('.body');
        var isOpening = !body.is(':visible');
        jQuery("#section-design .design-block .heading").not(this).each(function(){
            jQuery(this).parent().find('.body').slideUp();
            jQuery(this).find(".fa-minus").hide();
            jQuery(this).find(".fa-plus").show();
        });
        jQuery(".design-block input[type=color]").fadeTo(0, 0);
        if (isOpening) {
            setTimeout(() => {
                body.find("input[type=color]").fadeTo(200, 1);
            }, 200);
        }
        body.slideToggle(400);
        jQuery(this).find(".fa-minus").toggle();
        jQuery(this).find(".fa-plus").toggle();
    });
    jQuery(document).on("click", "#input-image-pid", loadImagePid);
    jQuery(document).on("change", "#input-background-type", backgroundType);
    jQuery(document).on("change", "#input-overlay-type", overlayType);
    jQuery(document).on("change", "#input-pattern", waveformType);
    jQuery(document).on("click", "#themes .theme", selectTheme);
    return cb(null);
}

module.exports = {
    raw: _raw,
    update,
    updateDesignTab,
    reset: themeReset,
    updateImage,
    updateDesignSummaries,
    loadThemeList,
    openModal,
    init
}