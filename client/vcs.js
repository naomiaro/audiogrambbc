var media = require('./media');
var utils = require('./utils');

function updateList() {
    jQuery.getJSON("/vcs/list", function (list) {
        jQuery("#new-vcs-table-store tbody").text('');
        list.forEach(function (item) {
            var el = `<tr><td><input type="radio" name="vcs-import" value="${item.file}"></td><td>${item.id}</td><td>${item.name}</td></tr>`;
            jQuery("#new-vcs-table-store tbody").append(el);
        });
        jQuery("#new-vcs input[name=vcs-import]:first").attr("checked", true);
    });
}

function search() {
    var id = jQuery('#new-vcs-search-input').val();
    jQuery.getJSON("/vcs/search/" + id, function (list) {
        jQuery("#new-vcs-table-store tbody").text('');
        list.forEach(function (item) {
            var el = `<tr><td><input type="radio" name="vcs-import" value="${item.file}"></td><td>${item.id}</td><td>${item.name}</td></tr>`;
            jQuery("#new-vcs-table-store tbody").append(el);
        });
        jQuery("#new-vcs input[name=vcs-import]:first").attr("checked", true);
    });
}

function load(file) {
    file = file || jQuery("#new-vcs input[name=vcs-import]:checked").val();
    var title = file.split('#')[1].split('.')[0];
    var projects = require('./projects');
    projects.title(title);
    var src = encodeURIComponent(file);
    var url = "/vcs/media/" + src;
    media.loadFromURL('audio', url, function () {
        // utils.navigate('edit');
    });
    jQuery('#themes.modal').modal('show');
}

function init(cb) {
    jQuery(document).on("click", "#new-vcs tr", function (e) {
        jQuery(this)
            .find("input[name=vcs-import]")
            .prop("checked", true);
    });
    jQuery(document).on("dblclick", "#new-vcs tr", function (e) {
        load();
    });
    jQuery(document).on('click', '#vcs-import', function(){
        load();
    });
    updateList();
    return cb(null);
}

module.exports = {
    updateList,
    init
}