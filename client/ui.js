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
        minimap.width(jQuery('#minimap svg').parent().width());
        minimap.updateTrim(extent);
        d3.select('#minimap').classed('hidden', hidden);
        // Transcript height
        if (jQuery('.transcript-editor').is(':visible')) {
            var current = jQuery('.transcript-editor').css('height','').outerHeight();
            var diff = jQuery(document).height() - jQuery(window).height();
            var full = current - diff;
            var min = 300;
            var target = Math.min(current, Math.max(min, full));
            jQuery('.transcript-editor').css('height', target);
        }
    }
}

function sizeButtonSelect() {
    jQuery('body > .wrapper button.button-select').each(function(){
        var label = jQuery(this).find('label');
        var test = label.text();
        if (!label.length) {
            jQuery(this).prepend('&nbsp;');
        }
        var tmp = document.createElement("div");
        tmp.setAttribute("class", "intGEL");
        var clone = jQuery(this).clone();
        jQuery(tmp).append(clone);
        jQuery("body").append(tmp);
        jQuery(tmp).attr('id', 'tmp');
        var buttonWidth = clone.width();
        var labelWidth = clone.find('label').outerWidth() || 0;
        var selectWidth = clone.find('select').outerWidth();
        jQuery(this).width(buttonWidth);
        if (labelWidth) {
            jQuery(this).find('select').css('padding-left', (labelWidth + 10) + 'px');
            jQuery(this).find('select').css('margin-left', -(labelWidth + 10) + 'px');
        }
        jQuery(this).find('select').css('width', '100%');
        jQuery(tmp).remove();
    });
}

function sizeSliders() {
    jQuery('.slider-wrapper').each(function(){
        var offset = 0;
        jQuery(this).find('.ui-slider').prevAll().each(function () {
            offset += jQuery(this).outerWidth();
        });
        jQuery(this).find(".ui-slider").css({ 'width': `calc(100% - ${offset + 30}px)` });;
    });
}

function init(cb) {
    initializeSliders();
    sizeButtonSelect();
    sizeSliders();
    d3.select('#group-theme-advanced button').on('click', showAdvancedConfig);
    d3.select(window).on("resize", windowResize);
    windowResize();
    return cb(null);
}

module.exports = {
    init,
    showAdvancedConfig,
    windowResize
}