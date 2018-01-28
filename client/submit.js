var utils = require('./utils');
var media = require('./media');
var audio = require('./audio');
var video = require('./video');
var projects = require('./projects');
var preview = require('./preview');
var transcript = require('./transcript');
var logger = require('./slack');

var title = 'Untitled';

function submit() {
    var audio = media.get('audio');
    var theme = preview.theme();
    validate();
}

function validate() {
    d3.select('#loading-message').text('Uploading files...');
    utils.setClass('loading');
    var data = media.get();
    for (var type in data) {
        if (!data[type].path) {
            setTimeout(validate, 2000);
            return false;
        }
    }
    submitted();
}

function submitted() {
    if (d3.event) d3.event.preventDefault();

    var theme = preview.theme(),
        caption = preview.caption(),
        selection = preview.selection(),
        backgroundInfo = preview.imgInfo('background'),
        audioFile = preview.file(),
        mediaInfo = media.get();

    if (!audioFile) {
        d3.select('#row-audio').classed('error', true);
        return utils.setClass('error', 'Submit Error: No audio file selected.');
    }

    if (!theme.backgroundImage && (!backgroundInfo || !mediaInfo.background)) {
        return utils.setClass('error', "Submit Error: The '" + theme.name + "' theme requires you upload/import a background image or video");
    }

    if (theme.maxDuration && selection.duration > theme.maxDuration) {
        return utils.setClass('error', 'Submit Error: Your Audiogram must be under ' + theme.maxDuration + ' seconds.');
    }

    if (!theme || !theme.width || !theme.height) {
        return utils.setClass('error', 'Submit Error: No valid theme detected.');
    }

    video.kill();
    audio.pause();

    var formData = new FormData();

    formData.append("title", projects.title());
    formData.append('user', USER.email);

    var private = +jQuery("#input-private").val();
    formData.append('private', private);

    formData.append("reversion", window.location.pathname.indexOf("ag/") === -1 ? 0 : 1);

    // formData.append("audio", audioFile);
    // formData.append("background", imgFile.background);
    // formData.append("foreground", imgFile.foreground);

    formData.append('media', JSON.stringify(mediaInfo));

    formData.append('backgroundInfo', JSON.stringify(backgroundInfo || theme.backgroundImageInfo[theme.orientation]));
    if (selection.start || selection.end) {
        formData.append('start', selection.start);
        formData.append('end', selection.end);
        formData.append('duration', selection.end - selection.start);
    } else {
        formData.append('duration', audio.duration());
    }
    formData.append(
        'theme',
        JSON.stringify(
            $.extend({}, theme, {
                backgroundImage: theme.backgroundImage ? theme.backgroundImage[theme.orientation] : null,
                backgroundImageFile: null,
                foregroundImage: theme.foregroundImage ? theme.foregroundImage[theme.orientation] : null
            })
        )
    );
    formData.append('caption', caption);
    formData.append("transcript", JSON.stringify(transcript.toJSON()));
    formData.append("subtitles", JSON.stringify(transcript.toSubs()));

    utils.setClass('loading');
    d3.select('#loading-message').text('Uploading files...');

    var info = { theme: theme.name },
        fullDuration = Math.round(+audio.duration() * 10, 2) / 10,
        cutDuration = Math.round(+jQuery('#duration strong').text() * 10, 2) / 10;
    info.duration = fullDuration == cutDuration ? fullDuration + 's' : cutDuration + 's (cut from ' + fullDuration + 's)';

    $.ajax({
        url: '/submit/',
        type: 'POST',
        data: formData,
        contentType: false,
        dataType: 'json',
        cache: false,
        processData: false,
        success: function(data) {
            if (data.error == 'reupload') {
                // Temporary media files have been lost. Reupload them and try again.
                return reUploadMedia();
            } else if (data.error) {
                return utils.error(data.error);
            }
            utils.setBreadcrumb('view', data.id.split('-').shift());
            media.set(data.media);
            poll(data.id, 0);
            // Logging
            var fields = [];
            fields.push({ title: 'New Audiogram Started', value: '...' + data.id.split('-').shift(), short: true });
            fields.push({ title: 'User', value: '<http://ad-lookup.bs.bbc.co.uk/adlookup.php?q=' + USER.email + '|' + USER.name + '>', short: true });
            fields.push({ title: 'Theme', value: info.theme, short: true });
            fields.push({ title: 'Duration', value: info.duration, short: true });
            logger.info(null, fields, USER.name + ' started generating a new audiogram');
        },
        error: function(err) {
            console.log(err);
            utils.error(err.responseText);
        }
    });
}

function reUploadMedia() {
    var blobs = media.blobs();
    for (var type in blobs) {
        media.upload(type, blobs[type]);
    }
    validate();
}

function poll(id) {
    setTimeout(function() {
        $.ajax({
            url: '/status/' + id + '/',
            error: error,
            dataType: 'json',
            success: function(result) {
                if (result && result.status && result.status === 'ready' && result.url) {
                    video.update(result.url, {theme: preview.theme()});
                    utils.setClass('rendered');
                    history.replaceState(null, null, `/ag/${id}`);
                    logger.success(result);
                } else if (result.status === 'error') {
                    console.log('RLW status error');
                    utils.error(result.error);
                } else {
                    d3.select('#loading-message').text(utils.statusMessage(result));
                    poll(id);
                }
            }
        });
    }, 2500);
}

function init() {
    d3.select('#submit').on('click', submit);
    jQuery(document).on("click", "button#view", function() {
      utils.setBreadcrumb('view');
    });
}

module.exports = {
    init
}