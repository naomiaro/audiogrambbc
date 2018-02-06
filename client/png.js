var media = require('./media');
var utils = require('./utils');

function updateList() {
    jQuery.getJSON("/png/list", function (list) {
        jQuery("#new-png table tbody").text('');
        if (!list) return;
        for (let i = 0; i < list.length; i++) {
            var item = list[i];
            var el = `<tr><td><input type="radio" name="png-import" value="${item.file}" data-title="${item.name}"></td><td>${item.name}</td><td>${item.user}</td></tr>`;
            jQuery("#new-png table tbody").append(el);
        }
        jQuery("#new-png input[name=png-import]:first").attr("checked", true);
    });
}

function load(file) {
    file = file || jQuery("#new-png input[name=png-import]:checked").val();
    var title = jQuery("#new-png input[name=png-import]:checked").attr('data-title');
    var projects = require('./projects');
    projects.title(title);
    var src = encodeURIComponent(file);
    var url = "/png/media/" + src;
    media.loadFromURL('audio', url, function () {
        utils.navigate('edit');
    });
}

function init() {
    jQuery(document).on("click", "#new-png tr", function (e) {
        jQuery(this)
            .find("input[name=png-import]")
            .prop("checked", true);
    });
    jQuery(document).on("dblclick", "#new-png tr", function (e) {
        load();
    });
    jQuery(document).on('click', '#png-import', function(){
        load();
    });
    updateList();
}

module.exports = {
    updateList,
    init
}