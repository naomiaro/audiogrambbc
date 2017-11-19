const utils = require("./utils");
const logger = require('./slack');
const media = require("./media");
const themeHelper = require("./themeHelper");

let MSID = null;

function purge() {
    console.log('MEDIA SELECTOR PURGE >> ', MSID);
    jQuery.get("/simulcast/delete/" + MSID);
}

function txTimeUpdate() {
    var isValid = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/.test(this.value);
    $('#tx-search').attr('disabled', !isValid);
    this.style.backgroundColor = isValid ? null : '#fba';
}

function txGetDate(time) {
    var now = new Date();
    dateString = now.toDateString();
    inputString = dateString + ' ' + time;
    inputDate = new Date(inputString);
    if (now < inputDate) {
        inputDate.setTime(inputDate.getTime() - 24 * 60 * 60 * 1000);
    }
    return inputDate;
}

function txSearch() {
    var now = new Date(),
        min = now.getTime() - 12 * 60 * 60 * 1000,
        start = txGetDate($('#input-tx-start').val()),
        end = txGetDate($('#input-tx-end').val()),
        vpid = $('#input-tx-vpid').val();
    if (!vpid) {
        jQuery('#input-tx-vpid').effect('highlight');
        return;
    }
    if (start.getTime() < min) {
        return utils.setClass('error', 'Broadcast media is only available for the last 12 hours. (' + vpid + ', ' + start + ')');
    } else if (end.getTime() - start.getTime() > 15 * 60 * 1000) {
        return utils.setClass('error', 'Please select a broadcast window < 15 minutes. If a larger window would be useful, let us know. (' + vpid + ', ' + start + ')');
    }
    utils.setClass(null);
    jQuery('#new-tx').modal('hide');
    const sourceName = jQuery("#input-tx-vpid option[value='" + vpid + "']").text();
    d3.select('#loading-message').text('Fetching media: ' + sourceName + ' (' + start.toLocaleString() + ')');
    utils.setClass('loading');
    jQuery('audio').attr('data-type', 'tx');
    var postData = { vpid: vpid, start: start.getTime() / 1000, end: end.getTime() / 1000, processStart: performance.now() };
    jQuery
        .post('/simulcast', postData)
        .fail(function(xhr, status, error) {
            utils.setClass('error', status);
        })
        .done(function(data) {
            console.log(data);
            if (data.error) {
                return utils.setClass('error', data.error);
            }
            $('#videoload a').attr('data-id', data.video);
            $('#videoload a').attr('data-used', false);
            d3.select('#videoload').classed('hidden', data.video == null);
            MSID = data.audio;
            txPoll(data.audio, "audio", postData);
        });
}

function txPoll(id, type, req) {
    req = req || null;
    const ext = (type=='audio') ? 'mp3' : 'mp4';
    const url = "/simulcast/status/" + id + "." + ext;
    utils.setClass('loading');
    vpid = $('#input-tx-vpid').val();
    jQuery.getJSON(url, function(data) {
        console.log(data);
        if (data.err) {
            utils.setClass('error', 'Simulcast Error: ' + data.err);
        } else if (data.ready === true) {
            var processDuration = '\n[process time: ' + Math.round((performance.now() - req.processStart) / 10) / 100 + 's]';
            if (req.start && req.end) {
                var startDate = new Date(req.start * 1000),
                    endDate = new Date(req.end * 1000);
                logger.info(USER.name + " imported " + data.type + " from " + vpid + " (" + utils.pad(startDate.getHours()) + ":" + utils.pad(startDate.getMinutes()) + ":" + utils.pad(startDate.getSeconds()) + " - " + utils.pad(endDate.getHours()) + ":" + utils.pad(endDate.getMinutes()) + ":" + utils.pad(endDate.getSeconds()) + ")" + processDuration);
            } else {
                logger.info(USER.name + ' imported ' + data.type + ' from ' + vpid + processDuration);
            }
            if (data.type === 'audio') {
                media.loadFromURL('audio', data.src, function(){
                    media.deleteMedia('mediaselector-audio');
                    utils.navigate('edit');
                });
            } else if (data.type === 'video') {
                var blob = null;
                var xhr = new XMLHttpRequest();
                xhr.open('GET', data.src);
                xhr.responseType = 'blob';
                xhr.onload = function() {
                    themeHelper.updateImage(null, 'background', xhr.response);
                };
                xhr.send();
            }
        } else {
            txPollTimeout = setTimeout(function() {
                txPoll(id, type, req);
            }, 5000);
        }
    });
}

function init(){
    // Fetch broadcast audio
    d3.selectAll("input[id^='input-tx-']").on("keyup", txTimeUpdate);
    jQuery(document).on("click", "#tx-search", txSearch);
    // Populate tx times
    var now = new Date(),
        startDate = new Date(now - 120000),
        endDate = new Date(now - 60000);
    jQuery("#input-tx-start").val(utils.pad(startDate.getHours()) + ":" + utils.pad(startDate.getMinutes()) + ":00");
    jQuery("#input-tx-end").val(utils.pad(endDate.getHours()) + ":" + utils.pad(endDate.getMinutes()) + ":00");
}

module.exports = {
    init,
    purge,
    poll: txPoll
}