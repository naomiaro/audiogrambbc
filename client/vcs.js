var media = require('./media');
var utils = require('./utils');
var projects = require('./projects');
var themeHelper = require('./themeHelper');

var logstore_blacklist = ['MOS_STORIES', 'PRI_NEWSPREP'];

function search() {
    jQuery('#vcs-search i.fa-search').hide();
    jQuery('#vcs-search i.fa-spinner').show();
    var site = jQuery('#vcs-site').val();
    var term = jQuery('#vcs-text').val();
    jQuery.getJSON(`/vcs/api/${site}:${term}`, function (res) {
        jQuery("#new-vcs-table-store tbody").text('');
        if (res.retval.results) {
            res.retval.results.forEach(function (item) {
                var logstore = item.logstore.split('$')[1];
                if (logstore_blacklist.indexOf(logstore) == -1) {
                    var el = `<tr data-id='${item.id}' data-site='${site}'><td>${item.id}</td><td>${logstore}</td><td>${item.title}</td></tr>`;
                    jQuery("#new-vcs-table-store tbody").append(el);
                }
            });
        } else if (res.retval.status){
            var id = res.retval.GENERIC.GENE_ID;
            var logstore = res.retval.GENERIC.GENE_LOGSTORE.split('$')[1];
            var title = res.retval.GENERIC.GENE_TITLE;
            var el = `<tr data-id='${id}' data-site='${site}'><td>${id}</td><td>${logstore}</td><td>${title}</td></tr>`;
            jQuery("#new-vcs-table-store tbody").append(el);
        } else if (res.retval.reason) {
            var el = `<tr class='error'><td colspan='3'>${res.retval.reason}</td></tr>`;
            jQuery("#new-vcs-table-store tbody").append(el);            
        }
        jQuery('#vcs-search i.fa-spinner').hide();
        jQuery('#vcs-search i.fa-search').show();
        jQuery('#new-vcs table').show();
    });
}

function load(site, id) {
    jQuery('#vcs-import span').hide();
    jQuery('#vcs-import i.fa-spinner').show();
    jQuery.getJSON(`/vcs/api/${site}:${id}`, function (res) {
        if (res.retval && res.retval.status) {
            var url = `/vcs/api/media/${site}:${id}`;
            media.loadFromURL('audio', url, function () {
                // utils.navigate('edit');
            });
            var title = res.retval.GENERIC.GENE_TITLE;
            projects.title(title);
            themeHelper.openModal();
        } else {
            var reason = res.retval ? res.retval.reason : null;
            var error = reason || 'Error fetching that item.';
            alert(error);
        }
        jQuery('#vcs-import i.fa-spinner').hide();
        jQuery('#vcs-import span').show();
    });
}

function init(cb) {
    var windowHeight = jQuery(window).height();    
    jQuery('#new-vcs table tbody').css('max-height', (windowHeight - 320) + 'px');
    jQuery.getJSON("/vcs/api/sites", function (res) {
        if (res.retval) {
            res.retval.sites.forEach(function(site){
                jQuery('#vcs-site').append(`<option value='${site.id}'>${site.name}</option>`);
            });
            var hasWest1 = jQuery('#vcs-site option[value=west1]').length;
            var defaultSite = hasWest1 ? 'west1' : jQuery('#vcs-site option:first').val();
            jQuery('#vcs-site').val(defaultSite);
        }
    });
    jQuery(document).on("click", "#vcs-search", function (e) {
        search();
    });
    jQuery(document).on("keyup", "#vcs-text", function (e) {
        if (e.keyCode == 13) {
            search();
        }
    });
    jQuery(document).on("click", "#new-vcs tr", function (e) {
        jQuery('#new-vcs tr').removeClass('active');
        jQuery(this).addClass('active');
    });
    jQuery(document).on("dblclick", "#new-vcs tr", function (e) {
        var id = jQuery(this).attr('data-id');
        var site = jQuery(this).attr('data-site');
        load(site, id);
    });
    jQuery(document).on('click', '#vcs-import', function(){
        var id = jQuery('#new-vcs tr.active').attr('data-id');
        var site = jQuery('#new-vcs tr.active').attr('data-site');
        load(site, id);
    });
    return cb(null);
}

module.exports = {
    init
}