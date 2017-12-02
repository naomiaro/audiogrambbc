const media = require('./media');
const utils = require('./utils');

function updateList() {
    jQuery.getJSON("/vcs/list", function (list) {
        jQuery("#new-vcs table tbody").text('');
        list.forEach(function (item) {
            const el = `<tr><td><input type="radio" name="vcs-import" value="${item.file}"></td><td>${item.id}</td><td>${item.name}</td></tr>`;
            jQuery("#new-vcs table tbody").append(el);
        });
        jQuery("#new-vcs input[name=vcs-import]:first").attr("checked", true);
    });
}

function load(file) {
    file = file || jQuery("#new-vcs input[name=vcs-import]:checked").val();
    const title = file.split('#')[1].split('.')[0];
    const projects = require('./projects');
    projects.title(title);
    const src = encodeURIComponent(file);
    const url = "/vcs/media/" + src;
    media.loadFromURL('audio', url, function () {
        utils.navigate('edit');
    });
}

function init() {
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
}

module.exports = {
    updateList,
    init
}