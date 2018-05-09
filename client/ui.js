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
        sizeSliders();
    }
}

function sizeSelectButton(btn) {
    var label = btn.find('label');
    var test = label.text();
    if (!label.length) {
        btn.prepend('&nbsp;');
    }
    var tmp = document.createElement("div");
    tmp.setAttribute("class", "intGEL");
    var clone = btn.clone();
    jQuery(tmp).append(clone);
    jQuery("body").append(tmp);
    jQuery(tmp).attr('id', 'tmp');
    var buttonWidth = clone.width();
    var labelWidth = clone.find('label').outerWidth() || 0;
    var selectWidth = clone.find('select').outerWidth();
    btn.width(buttonWidth);
    if (labelWidth) {
        btn.find('select').css('padding-left', (labelWidth + 10) + 'px');
        btn.find('select').css('margin-left', -(labelWidth + 10) + 'px');
    }
    btn.find('select').css('width', '100%');
    jQuery(tmp).remove();
}

function sizeSelectButtons() {
    jQuery('body > .wrapper button.button-select, .modal button.button-select').each(function(){
        var btn = jQuery(this);
        sizeSelectButton(btn);
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

function hideHero() {
    jQuery('#hero, #welcome-wrapper').addClass('collapsed');
    jQuery("#welcome-toggle").text('Show More');
}

function init(cb) {
    jQuery(document).on("click", "#header-home", function () {
        window.location.href = '/';
    });
    document.cookie = "username=John Doe";
    var heroCookie = jQuery.cookie("ag_showhero");
    var showHero = (heroCookie == 'true' || heroCookie == undefined);
    if (heroCookie == undefined) jQuery.cookie("ag_showhero", "false");
    if (!showHero) hideHero();
    jQuery(document).on("click", "#welcome-toggle", function () {
        jQuery('#error, #success').hide();
        var currentlyOpen = !jQuery('#hero').hasClass('collapsed');
        jQuery('#hero, #welcome-wrapper').toggleClass('collapsed');
        var current = jQuery(this).text();
        var text = currentlyOpen ? 'Show More' : 'Hide'
        jQuery(this).text(text);
        if (currentlyOpen) {
            jQuery.cookie("ag_showhero", "false");
        } else {
            jQuery.cookie("ag_showhero", "true");
        }
    });
    initializeSliders();
    sizeSelectButtons();
    sizeSliders();
    d3.select('#group-theme-advanced button').on('click', showAdvancedConfig);
    d3.select(window).on("resize", windowResize);
    jQuery(document).on("click", "button.button-prompt", function (e) {
        var label = jQuery(this).find("b").text();
        var val = jQuery(this).find("span").text();
        var newVal = prompt(label, val);
        if (newVal == undefined) return;
        jQuery(this).find("span").text(newVal);
        jQuery(this).find("input").val(newVal).trigger('change');
    });
    jQuery(document).on("change", "button.button-prompt input", function(){
        var val = jQuery(this).val();
        jQuery(this).parent().find('span').text(val);
    });
    windowResize();
    // Design tooltip
    var designTabCoookie = jQuery.cookie("ag_designtab");
    if (designTabCoookie) {
        jQuery('#design-tab-tooltip').remove();
    } else {
        jQuery(document).on('click', '#design-tab-link', function () {
            jQuery('#design-tab-tooltip').remove();
            jQuery.cookie("ag_designtab", true);
        });
    }
    return cb(null);
}

module.exports = {
    init,
    showAdvancedConfig,
    sizeSelectButton,
    hideHero,
    windowResize
}