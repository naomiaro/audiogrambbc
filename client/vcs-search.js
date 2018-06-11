function vcsTranscript(id, audioFile) {
    d3.select('#transcript').classed('loading', true);
    transcript.clear();
    $.getJSON('/vcs/transcript/' + id, function(data) {
        var statusCode = data.statusCode;
        if (statusCode == 200) {
            var body = JSON.parse(data.body);
            var loaded = body.hasOwnProperty('commaSegments');
            if (loaded) {
                transcript.load(body);
                d3.select('#transcript').classed('loading', false);
            } else if (audioFile) {
                generateTranscript(audioFile);
            } else {
                utils.setClass('error', 'Error generating VCS transcript (audioFile not loaded) for #' + item);
            }
        } else {
            console.log('VCS TRANSCRIPT ERROR');
            console.log(data);
            var item = d3.select('#input-vcs').property('value');
            if (data.statusCode == 404 && audioFile) {
                generateTranscript(audioFile);
            } else {
                utils.setClass('error', 'Error (' + data.statusCode + ') fetching transcript for VCS item ' + item);
            }
        }
    });
}

function vcsAudio(url, item) {
    id = url.split('/').pop();
    
    d3.select('#loading-message').text('Fetching Audio...');
    utils.setClass('loading');
    
    // Get aduio
    loadMediaFromURL('audio', '/vcs/media/' + id);
    
    item = item || d3.select('#input-vcs').property('value');
    logger.info(USER.name + ' imported VCS Item #' + item);
}

function vcsSearch(id, media) {
    var item = id || d3.select('#input-vcs').property('value');
    if (id) d3.select('#input-vcs').property('value', id);
    
    d3.select('#loading-message').text('Searching VCS...');
    utils.setClass('loading');
    
    $.getJSON('/vcs/search/' + item, function(data) {
        var statusCode = data.statusCode;
        
        if (statusCode == 200) {
            var items = JSON.parse(data.body);
            // Load audio
            vcsAudio(media || items[items.length - 1].mediaurl, item);
            // Write results
            d3.select('#vcs-results').html('');
            for (var i = items.length - 1; i >= 0; i--) {
                if (media) {
                    var checked = items[i].mediaurl.split('/').pop == media.split('/').pop ? 'checked' : null;
                } else {
                    var checked = i == items.length - 1 ? 'checked' : null;
                }
                var disp = items[i].file.split('#').pop() + ' [' + items[i].vcsinfo.take.GENERIC.GENE_LOGSTORE.split('$').pop() + ']';
                var option = "<div class='form-check'> <label class='form-check-label'> <input class='form-check-input' type='radio' name='vcs-item' value='" + items[i].mediaurl + "' " + checked + '> ' + disp + ' </label> </div>';
                d3
                .select('#vcs-results')
                .insert('div')
                .html(option)
                .classed('error', false);
            }
        } else if (statusCode == 404) {
            d3.select('#vcs-results').classed('hidden', true);
            utils.setClass('error', "VCS item '" + item + "' wasn't found. Make sure your item is saved in a logstore that auto-exports to the S-drive.");
            // d3.select("#vcs-results").html("<b>That item wasn't found.</b><br/>Make sure your item is saved in a logstore that auto-exports to the S-drive.").classed("error", true);
        } else {
            d3.select('#vcs-results').classed('hidden', true);
            utils.setClass('error', "There was an error searching for VCS item '" + item + "'. Check it's correctly formated.");
            // d3.select("#vcs-results").html("<b>There was an error searching for that item.</b><br/>Check it was correctly formated, or try again.").classed("error", true);
        }
        
        // if (statusCode!=200) utils.setClass(null);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
        d3.select('#vcs-results').classed('hidden', true);
        utils.setClass('error', "An internal error occured searching for VCS item '" + item + "'. " + errorThrown);
        // d3.select("#vcs-results").html("<b>An internal error occured.</b><br/>Please try again, or <a href='mailto:audiogram@bbcnewslabs.co.uk'>report the issue</a>.").classed("error", true);
        console.log(errorThrown);
        // utils.setClass(null);
    })
    .complete(function() {
        d3.select('#vcs-results').classed('hidden', false);
    });
}

function init() {
    // Search for VCS audio
    d3.select("#vcs-search").on("click", vcsSearch);
    d3.select("#input-vcs").on("keydown", function(){
        if (d3.event.key == "Enter") vcsSearch();
    });
    // Select VCS audio
    jQuery("#vcs-results").on('change','input:radio',function () {
        vcsAudio(this.value);
    });
}

module.exports = {
    init
}