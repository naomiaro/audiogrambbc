var webcap = require('./webcap');
var preview = require('./preview');
var minimap = require('./minimap');
var audio = require('./audio');

function initializeSliders() {
    $(function() {
        $('.wave-slider').slider({ range: true, min: 0, max: 100, values: [25, 75], slide: function(event, ui) {
            var size = ui.values[1] - ui.values[0],
            pos = ui.values[0] + size / 2;
            if (jQuery(this).attr('name') == 'vertical') {
                preview.themeConfig('wave.height', size / 100);
                preview.themeConfig('wave.y', pos / 100);
            } else {
                preview.themeConfig('wave.width', size / 100);
                preview.themeConfig('wave.x', pos / 100);
            }
        } });
        $('.background-slider').slider({ range: true, min: 0, max: 100, values: [25, 75], slide: function(event, ui) {
            var size = ui.values[1] - ui.values[0],
            pos = ui.values[0];
            if (jQuery(this).attr('name') == 'vertical') {
                preview.themeConfig('backgroundPosition.height', size / 100);
                preview.themeConfig('backgroundPosition.y', pos / 100);
            } else {
                preview.themeConfig('backgroundPosition.width', size / 100);
                preview.themeConfig('backgroundPosition.x', pos / 100);
            }
        } });
        $('.subs-slider').slider({ range: false, min: 0, max: 100, values: [50], slide: function(event, ui) {
            preview.themeConfig('subtitles.margin.' + jQuery(this).attr('name'), ui.value / 100);
        } });
        $('.caption-slider').slider({ range: false, min: 0, max: 100, values: [50], slide: function(event, ui) {
            preview.themeConfig('caption.margin.' + jQuery(this).attr('name'), ui.value / 100);
        } });
    });
}

function showAdvancedConfig() {
    // jQuery('#input-caption:not(:visible)').val('');
    jQuery('#section-theme .row').removeClass('hidden');
    d3.select('#row-theme').classed('advanced', false);
    jQuery('#config-save').removeClass('hidden');
    webcap.updateList();
    windowResize(); // Bcause sometimes it makes the vertical scroll-bar appear, and elements need resizing
}

function windowResize() {
    if (!jQuery('body').is('.loading,.rendered,.landing')) {
        preview.redraw();
        var audio = require('./audio');
        var duration = audio.duration();
        var extent = audio.extent().map(function(e) {
            return e * duration;
        });
        var hidden = d3.select('#minimap').classed('hidden');
        d3.select('#minimap').classed('hidden', false);
        minimap.width(jQuery('#minimap .page-header').width());
        minimap.updateTrim(extent);
        d3.select('#minimap').classed('hidden', hidden);
    }
}

function init() {
    initializeSliders();
    d3.select('#group-theme-advanced button').on('click', showAdvancedConfig);
    d3.select(window).on("resize", windowResize);
}

module.exports = {
    init,
    showAdvancedConfig,
    windowResize
}