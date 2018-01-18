function updateList() {
    // Get list of Web:Cap files in the W1 Dropzone
    jQuery.getJSON('/webcap', function(data) {
        if (data.err) return console.log(data.err);
        var count = 0,
            eq = 4;
        // Loop through each file
        for (var i = 0; i < data.files.length; i++) {
            var file = data.files[i];
            if (
                count > 100 ||
                jQuery("#input-webcap option[value='" + file + "']").length
            ) {
                // Already in the list, or the list is too long
                break;
            }
            if (file[0] != '.' && file.endsWith('.png')) {
                jQuery('#input-webcap option:eq(' + eq + ')').before(
                    '<option value=' + file + '>' + file + '</option>'
                );
                eq++;
                count++;
            }
        }
        jQuery("#input-webcap option[value='loading']").remove();
        if (jQuery('#input-webcap:visible').length)
            setTimeout(updateList, 10000);
    });
}

function use() {
    var filename = jQuery('#input-webcap').val();
    d3
        .select('#input-foreground-wrapper')
        .classed('hidden', filename != 'local');

    if (filename == 'local') {
        setTimeout(function() {
            jQuery('#input-foreground').click();
        }, 1000);
    }

    if (!filename.endsWith('.png')) {
        updateImage(null, 'foreground');
        return;
    }

    utils.setClass('loading');
    var url = '/webcap/' + filename;
    var blob = null;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'blob';
    xhr.onload = function(data) {
        if (xhr.status == 200) {
            updateImage(null, 'foreground', xhr.response);
            utils.setClass(null);
            logger.info(
                USER.name +
                    ' imported a foreground image from Web:Cap (' +
                    filename +
                    ')'
            );
        } else {
            utils.setClass(
                'error',
                'There was an error (' +
                    xhr.status +
                    ") fetching image '" +
                    filename +
                    "' form Web:Cap."
            );
        }
    };
    xhr.send();
}

function init() {
    updateList();
    jQuery(document).on('change', '#input-webcap', updateList);
}

module.exports = {
    updateList,
    init
}