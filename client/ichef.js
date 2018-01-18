var themeHelper = require('./themeHelper');
var utils = require('./utils');

function load() {
    var pid = prompt('Enter a valid image pid:', 'p04zwtlb');
    if (pid != null) {
        utils.setClass('loading');
        themeHelper.updateImage(null, 'background');
        var url = '/ichef/' + pid;
        var blob = null;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.onload = function(data) {
            if (xhr.status == 200) {
                themeHelper.updateImage(null, 'background', xhr.response);
                utils.setClass(null);
                logger.info(USER.name + ' imported an image pid from iChef (' + pid + ')');
            } else {
                utils.setClass('error', 'There was an error (' + xhr.status + ") fetching image '" + pid + "' form iChef.");
            }
        };
        xhr.send();
    }
}

function init() {
    jQuery(document).on('click', '#input-image-pid', load);
}

module.exports = {
    load,
    init
}