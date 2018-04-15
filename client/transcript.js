var jQuery = require("jquery"),
  logger = require("./slack.js"),
  utils = require("./utils"),
  audio = require("./audio.js"),
  minimap = require("./minimap.js"),
  uuid = require("uuid/v4"),
  currentTranscript,
  kaldiPoll,
  formatTimeout,
  kaldiTimer;


function formatHMS(t) {
    t = Number(t);
    var h = Math.floor(t / 3600),
    m = Math.floor((t % 3600) / 60),
    s = ((t % 3600) % 60).toFixed(2),
    string = `00${h}`.slice(-2) + ":" + `00${m}`.slice(-2) + ":" + `00${s}`.slice(-5);
    return string;
}

function reverseHMS(str) {
    str = str.replace(',','.');
    var time = str.split(':');
    var sec = 0;
    var place = 0;
    for (var i = time.length - 1; i >= 0; i--) {
        sec += +time[i].replace(/[^\d.-]/g, '') * Math.pow(60, place);
        place++;
    }
    return sec;
}

// Highlight selected words 
function highlight(start, end) {
    jQuery(".transcript-word").removeClass("unused");
    var allAdded = !jQuery(".transcript-word:not(.added)").length;
    if (!allAdded && start>=0 && end) {
        jQuery(".transcript-word").filter(function() {
            var wordStart = jQuery(this).attr("data-start"),
            wordEnd = jQuery(this).attr("data-end"),
            wordMiddle = wordEnd - (wordEnd-wordStart)/2;
            return wordEnd < start || wordStart > end;
        }).addClass("unused");
        // hideunused();
        scrollIntoView();
    }
}

function scrollIntoView() {
    var first = jQuery(".transcript-word:not(.unused):first").position().top;
    var last = jQuery(".transcript-word:not(.unused):last").position().top;
    var viewHeight = jQuery(".transcript-editor").height();
    if (viewHeight - first < 0 || viewHeight - last > viewHeight) {
        var current = jQuery(".transcript-editor").scrollTop();
        var diff = current + first - 50;
        jQuery(".transcript-editor").scrollTop(diff);
    }
}

function hideUnused() {
    jQuery(".transcript-block").removeClass("hidden");
    jQuery(".transcript-more").remove();
    jQuery(".transcript-word:not(.unused):first")
      .parents(".transcript-block")
      .prev()
      .prevAll()
      .addClass("hidden");
    jQuery(".transcript-word:not(.unused):last")
      .parents(".transcript-block")
      .next()
      .nextAll()
      .addClass("hidden");
    var first = jQuery(".transcript-block:not(.hidden):first");
    var last = jQuery('.transcript-block:not(.hidden):last');
    if (!first.is(':first-child')) {
        first.before("<div class='transcript-more before' contenteditable='false'><a href='#'>Show more</a></div>");
        jQuery(".transcript-more.before a").width(getBlockWidth(first));
    }
    if (!first.is(":last-child")) {
        last.after("<div class='transcript-more after' contenteditable='false'><a href='#'>Show more</a></div>");
        jQuery(".transcript-more.after a").width(getBlockWidth(last));        
    }
    jQuery(".transcript-word:not(.unused):first").parents(".transcript-block").removeClass("same-speaker");
}

function getBlockWidth() {
    var max = 0;
    jQuery(".transcript-block").each(function(){
        var block = jQuery(this);
        var line = block.find(".transcript-line:first");
        if (line.length) {
            var word = line.prevAll(".transcript-word:first");
        } else {
            var word = block.find(".transcript-word:last");
        }
        var width = word.position().left + word.width() - block.find('.transcript-speaker').width();
        max = Math.max(max, width);
    });
    return max;
}

function format() {
    if (LOADING) return false;
    if (!jQuery(".transcript-word").length) {
        if (jQuery("transcript:visible").length) {
            loadEmpty();
        }
        return;
    }
    // Get selection pos
    var sel = window.getSelection();
    if (sel.focusNode) {
        var selNode = sel.focusNode.parentElement;
        var selPos = sel.focusOffset;
        if (selNode.className.includes('transcript-space')) {
            selNode = jQuery(selNode).nextAll('.transcript-word')[0];
            selPos = 0;
        }
    }
    // Clear lines/breaks
    jQuery('.transcript-space, .transcript-line, .transcript-break').remove();
    // Merge segments
    jQuery('.transcript-timestamp').remove();
    jQuery('.transcript-block').each(function () {
        var speaker = jQuery(this).attr('data-speaker');
        var prevSpeaker = jQuery(this).prev().attr('data-speaker');
        if (speaker != prevSpeaker) jQuery(this).removeClass('same-speaker');
    });
    jQuery(".transcript-block.same-speaker:not(.break)").each(function () {
        var words = jQuery(this).find('.transcript-word');
        jQuery(this).prev().find('.transcript-segment').append(words);
        jQuery(this).remove();
    });
    // Split words
    jQuery(".transcript-word").each(function () {
        var text = jQuery(this).text()
          .replace("&nbsp;", " ")
          .replace("\n", " ");
        if (!jQuery(this).is('.transcript-word:first:last') || jQuery(this).text().length > 1) {
            text = text.replace(/^\s+/, "");
        }
        jQuery(this).text(text);
        if (text.includes(' ') && (text!=' ' || !jQuery(this).is('.transcript-word:first:last'))) {
            var words = text.split(' ').reverse();
            for (var i = 0; i < words.length - 1; i++) {
                if (words[i].length) {
                    var newWord = jQuery(this).clone();
                    newWord.text(words[i]);
                    if ( words[i] != newWord.attr('data-text') ) {
                        newWord.addClass('added');
                        newWord.attr('data-text', null);
                    }
                    jQuery(this).after(newWord);
                }
            }
            var word0 = words[words.length - 1];
            jQuery(this).text(word0);
            if (word0 != jQuery(this).attr('data-text')) {
                jQuery(this).attr('data-text', null);
                jQuery(this).addClass('added');
            }
            if (selNode && jQuery(this).is(jQuery(selNode))) {
                var posWords = text.slice(0, selPos).split(' ');
                var wordOffset = posWords.length - 1;
                var wordIndex = jQuery(this).index() + wordOffset;
                selNode = jQuery(this).parent().find(`:eq(${wordIndex})`).get()[0];
                selPos = posWords[posWords.length - 1].length;
            }
        } else if (text == '') {
            jQuery(this).remove();
        }
    });
    // Set added word timings
    var extent = audio.extent();
    var duration = audio.duration();
    // var selectionStart = extent[0] * duration;
    // var selectionEnd = extent[1] * duration;
    var selectionStart = utils.getSeconds(jQuery('#start').val());
    var selectionEnd = utils.getSeconds(jQuery('#end').val());
    jQuery('.transcript-word.added').attr('data-start', null).attr('data-end', null);
    jQuery('.transcript-word').each(function (i) {
        if (jQuery(this).hasClass('added') && !jQuery(this).attr('data-start')) {
            var start = +jQuery(this).prevAll('.transcript-word:not(.added)').first().attr('data-end');
            if (!start) start = +jQuery(this).parentsUntil('.transcript-content').last().prev().find('.transcript-word:last').attr('data-end');
            if (!start) start = selectionStart;
            var next = jQuery('.transcript-word:not(.added)').filter(function () {
                return jQuery(this).attr('data-start') > start;
            }).first();
            var end = next.length ? +next.attr('data-start') || selectionEnd : selectionEnd;
            var dur = end - start;
            var remainingWords = jQuery(`.transcript-word:gt(${i})`);
            var lastIndex = remainingWords.length;
            remainingWords.each(function(i){
                if (!jQuery(this).hasClass('added')) {
                    lastIndex = i;
                    return false;
                }
            });
            var nextWords = remainingWords.slice(0, lastIndex);
            // var nextWords = jQuery(this).nextUntil('.transcript-word:not(.added)').filter('.transcript-word');
            var charCount = jQuery(this).text().length;
            nextWords.each(function () {
                charCount += jQuery(this).text().length;
            });
            var secPerChar = dur / charCount;
            var wordStart = start;
            var wordEnd = wordStart + secPerChar * jQuery(this).text().length;
            jQuery(this).attr('data-start', wordStart).attr('data-end', wordEnd);
            nextWords.each(function () {
                wordStart = wordEnd;
                wordEnd = wordStart + secPerChar * jQuery(this).text().length;
                jQuery(this).attr('data-start', wordStart).attr('data-end', wordEnd);
            });
        }
    });
    // Highlight words
    if (!jQuery('.transcript-word:not(.added)').length) {
        highlight(selectionStart, selectionEnd);
    }
    // Insert new lines
    var firstWord = jQuery('.transcript-word:not(.unused):first');
    var lastWord = jQuery('.transcript-word:not(.unused):last');
    var maxChar = +jQuery("input[name='subtitles.lineWidth']").val();
    var maxLines = +jQuery("input[name='subtitles.linesMax']").val();
    jQuery(".transcript-block").each(function () {
        var charCount = 0;
        var lineCount = 1;
        jQuery(this).find(".transcript-word").each(function () {
            var text = jQuery(this).text();
            if (jQuery(this).is(firstWord)) {
                var breakSpan = document.createElement('span');
                breakSpan.setAttribute('class', 'transcript-break');
                jQuery(this).before(breakSpan);
                charCount = text.length;
                lineCount = 1;
            } else if (jQuery(this).is(lastWord)) {
                var breakSpan = document.createElement('span');
                breakSpan.setAttribute('class', 'transcript-break');
                jQuery(this).after(breakSpan);
                charCount += text.length;
                if (charCount > maxChar) {
                    lineCount++;
                    if (lineCount > maxLines) {
                        var cl = 'transcript-break';
                        lineCount = 1;
                    } else {
                        var cl = 'transcript-line';
                    }
                    var lineSpan = breakSpan.cloneNode()
                    lineSpan.setAttribute('class', cl);
                    jQuery(this).before(lineSpan);
                }
                charCount = 0;
                lineCount = 1;
            } else {
                if (charCount > 0) {
                    charCount++;
                }
                charCount += text.length;
                if (charCount > maxChar) {
                    charCount = text.length;
                    lineCount++;
                    if (lineCount > maxLines) {
                        var cl = 'transcript-break';
                        lineCount = 1;
                    } else {
                        var cl = 'transcript-line';
                    }
                    var lineSpan = document.createElement('span');
                    lineSpan.setAttribute('class', cl);
                    jQuery(this).before(lineSpan);
                }
            }
        });
    });
    // Insert new blocks
    jQuery('.transcript-break').each(function() {
        if (!jQuery(this).is(':first-child, :last-child')) {
            var block = jQuery(this).parentsUntil('.transcript-content').last();
            var newBlock = block.clone();
            newBlock.addClass('same-speaker').removeClass('break');
            newBlock.find('.transcript-segment').html('').append(jQuery(this).nextAll());
            jQuery(this).parentsUntil('.transcript-content').last().after(newBlock);
        }
    });
    jQuery('.transcript-break').remove();
    // Normalise blocks
    jQuery('.transcript-block').each(function () {
        var totalLines = jQuery(this).find('.transcript-line').length + 1;
        var totalChars = jQuery(this).find('.transcript-word').length - 1;
        jQuery(this).find('.transcript-word').each(function () {
            totalChars += +jQuery(this).text().length;
        });
        var charsPerLine = totalChars / totalLines;
        jQuery(this).find('.transcript-line').remove();
        var charCount = 0;
        var lineCount = 1;
        jQuery(this).find('.transcript-word').each(function () {
            var textLength = +jQuery(this).text().length;
            if (charCount > 0) charCount++;
            charCount += textLength;
            if (charCount > charsPerLine) {
                var lineSpan = document.createElement('span');
                lineSpan.setAttribute('class', 'transcript-line');
                if (charCount > maxChar) {
                    jQuery(this).before(lineSpan);
                } else {
                    jQuery(this).after(lineSpan);
                }
                charCount = textLength;
                lineCount++;
                if (lineCount == totalLines) {
                    return false;
                }
            }
        });
    });
    // Insert timestamps
    jQuery('.transcript-block').each(function () {
        var first = jQuery(this).find('.transcript-word:not(.unused):first');
        if (first.length) {
            var startTime = first.attr('data-start') - selectionStart;
            startTime = Math.max(startTime, 0);
            var disp = utils.formatHMS(startTime);
            jQuery(this).prepend("<span class='transcript-timestamp'>" + disp + "</span>");
        }
    });
    // Insert spaces
    jQuery(".transcript-word:not(:last-child)").each(function () {
        var spaceSpan = document.createElement('span');
        spaceSpan.setAttribute('class', 'transcript-space');
        spaceSpan.textContent = " ";
        jQuery(this).after(spaceSpan);
    });
    // Reset selection
    if (selNode && selNode.firstChild) {
      selPos = Math.min(selPos, selNode.firstChild.length);
      sel.collapse(selNode.firstChild, selPos);
    }
    // Set speaker colours
    jQuery('.transcript-block').each(function () {
        var speaker = jQuery(this).attr('data-speaker');
        var prevSpeaker = jQuery(this).prev().attr('data-speaker');
        var trimStart = jQuery(this).prev().find('.transcript-word:last').is('.unused') && !jQuery(this).find('.transcript-word:first').is('.unused');
        jQuery(this).find('.transcript-speaker select').val(speaker);
        if (speaker === prevSpeaker && !trimStart) {
          jQuery(this).addClass("same-speaker");
        } else {
          jQuery(this).removeClass("same-speaker");
        }
        if (jQuery("input[name='subtitles.color." + speaker + "']").length) {
            var color = jQuery("input[name='subtitles.color." + speaker + "']").val();
        } else {
            var preview = require("./preview.js"),
                theme = preview.theme();
            if (theme.subtitles.color[speaker]) {
                color = theme.subtitles.color[speaker];
            } else {
                color = theme.subtitles.color[0];
                preview.themeConfig("subtitles.color." + speaker, color);
            }
            var el = jQuery("input[name^='subtitles.color']:last").parent();
            el.after(el.clone());
            jQuery("input[name^='subtitles.color']:last").attr("name", "subtitles.color." + speaker).val(color);
        }
        jQuery(this).find('.transcript-segment').css("border-color", color);
    });

    // Add word titles and mark unused words
    jQuery('.transcript-word').each(function(){
        var start = jQuery(this).attr("data-start");
        var end = jQuery(this).attr("data-end");
        var title = '';
        if (start <= duration) {
            var dispStart = formatHMS( start ).replace(/00:/g, '');
            var dispEnd = formatHMS( end ).replace(/00:/g, '');
            title = `${dispStart} - ${dispEnd}`;
        }
        jQuery(this).attr({title});
        if (jQuery(this).attr("data-start") > selectionEnd) {
            jQuery(this).addClass('unused');
        }
    });

    return;
}

function speakerCount() {
    var speakerCount = 1;
    jQuery( ".transcript-editor-block__speaker" ).each(function( index ) {
        var next = jQuery(this).next();
        if (next.is("select.transcript-speaker")) {
            var value = +next.val().split(" ").pop();
        } else {
            var value = +jQuery(this).text().split(" ").pop();
        }
        speakerCount = Math.max(speakerCount, value);
    });
    return speakerCount;
}

function toSubs() {
    var subs = [];
    jQuery('.transcript-block').each(function() {
        var wordCount = jQuery(this).find('.transcript-word:not(.unused)').length;
        if (wordCount) {
            var speaker = +jQuery(this).attr('data-speaker');
            var lines = [];
            var start = +jQuery(this).find('.transcript-word:not(.unused):first').attr('data-start');
            var end = +jQuery(this).find('.transcript-word:not(.unused):last').attr('data-end');
            var str = '';
            jQuery(this).find('.transcript-word, .transcript-space, .transcript-line').each(function() {
                if ( jQuery(this).is('.transcript-line') ) {
                    lines.push(str);
                    str = '';
                } else {
                    str += jQuery(this).text();
                }
            });
            lines.push(str);
            subs.push({speaker, start, end, lines});
        }
    });
    // If in timings mode
    if (jQuery('#transcript-timings .block:visible').length) {
        var max = audio.duration() + 1;
        subs.forEach(function(sub, i) {
            var block = jQuery(`#transcript-timings .block:eq(${i})`);
            var start = block.attr('data-start') || max;
            var end = block.attr('data-end') || max;
            subs[i].start = start;
            subs[i].end = end;
        });
    }
    // Trim offset
    var selectionStart = utils.getSeconds(jQuery('#start').val());
    for (var i = 0; i < subs.length; i++) {
        subs[i].start -= selectionStart;
        subs[i].end -= selectionStart;
    }
    // Remove small gaps between segments
    for (var i = 1; i < subs.length; i++) {
        var mergeGapsSmallerThan = 1;
        var gap = subs[i].start - subs[i-1].end;
        if (gap > 0 && gap < mergeGapsSmallerThan) {
            var diff = gap / 2;
            subs[i].start -= diff;
            subs[i - 1].end += diff;
        }
    }
    // Pad short segments
    var minSegmentDur = 1;
    for (var i = 0; i < subs.length; i++) {
        var dur = subs[i].end - subs[i].start;
        if (dur < minSegmentDur) {
            // move start time
            var diff = minSegmentDur - dur;
            if (subs[i-1]) {
                var prevEnd = Math.max(subs[i-1].end - diff/2, subs[i-1].start + minSegmentDur);
                subs[i-1].end = Math.min(prevEnd, subs[i-1].end);
                subs[i].start = Math.max(subs[i].start - diff/2, subs[i-1].end);
            }
            // move end time
            var remainingDiff = minSegmentDur - (subs[i].end - subs[i].start);
            if (subs[i+1]) {
                if (subs[i+1].end - subs[i+1].start > minSegmentDur) {
                    subs[i].end += remainingDiff;
                    subs[i+1].start += remainingDiff;
                }
            } else {
                var extent = audio.extent();
                var duration = audio.duration();
                var selectionEnd = extent[1] * duration;
                subs[i].end = Math.min(selectionEnd, subs[i].end + remainingDiff);
            }
        }
    }
    return subs;
}

function toJSON() {
    if (!currentTranscript) return null;
    var speakers = [];
    var segments = [];
    var speakerMax = 0;
    var json = {speakers, segments};
    // Segments
        if (!jQuery(".transcript-word").length) {
            if (currentTranscript.toJSON) {
                json = currentTranscript.toJSON();
            } else {
                json = currentTranscript;
            }
        } else {
            jQuery(".transcript-block").each(function () {
                var speaker = +jQuery(this).find('.transcript-speaker select').val();
                if (speaker > speakerMax) speakerMax = speaker;
                var segment = { speaker, words: [] };
                if (jQuery(this).hasClass('break')) {
                    segment.break = true;
                }
                jQuery(this).find(".transcript-word").each(function () {
                    var text = jQuery(this).text();
                    var start = +jQuery(this).attr('data-start');
                    var end = +jQuery(this).attr('data-end');
                    var orig = jQuery(this).attr('data-text');
                    var word = {text, orig, start, end};
                    if (jQuery(this).hasClass('added')) {
                        word.added = true;
                    }
                    if (jQuery(this).hasClass("time-manual")) {
                      word.timeManual = true;
                    }
                    segment.words.push(word);
                });
                json.segments.push(segment);
            });
        }

    // Speakers
        for (var i = 0; i <= speakerMax; i++) {
            speakers.push({name: null});
        }
    return json;
}

function  loadEmpty() {
    clear();
    var emptyScript = {
        segments: [{
            speaker: 0,
            words: [{
                start: 0,
                end: 0,
                text: ' '
            }]
        }]
    };
    load(emptyScript);
}

function load(json) {
    clear();
    if (!json) return;
    currentTranscript = json;
    var script = toJSON();

    // Generate speaker dropdown
        var speakerDiv = document.createElement('div');
        speakerDiv.setAttribute('class', 'transcript-speaker');
        speakerDiv.setAttribute('contenteditable', 'false');
        var speakerSel = document.createElement('select');
        speakerDiv.appendChild(speakerSel);
        var speakerCount = 1;
        script.segments.forEach(function(segment){
            var speakerId = segment.speaker + 1;
            if (speakerId>speakerCount) speakerCount = speakerId;
        });
        for (var i = 0; i <= speakerCount; i++) {
            var speakerOpt = document.createElement('option');
            speakerOpt.value = i;
            speakerOpt.text = `Speaker ${i + 1}`;
            speakerSel.appendChild(speakerOpt);
        }
    
    // Add segments
        script.segments.forEach(function(segment) {
            if (segment.words.length) {
                // Make block
                var blockDiv = document.createElement('div');
                var cl = 'transcript-block';
                if (segment.break) cl += ' break';
                blockDiv.setAttribute('class', cl);
                jQuery('.transcript-content').append(blockDiv);
                // Insert speaker
                blockDiv.setAttribute('data-speaker', segment.speaker);
                blockDiv.appendChild(speakerDiv.cloneNode(true));
                // Insert segment
                var segmentDiv = document.createElement('div');
                segmentDiv.setAttribute('class', 'transcript-segment');
                blockDiv.appendChild(segmentDiv);
                // Insert words
                segment.words.forEach(function(word) {
                    var wordSpan = document.createElement('span');
                    var cl = 'transcript-word';
                    if (word.added) cl += " added";
                    if (word.timeManual) cl += ' time-manual';
                    wordSpan.setAttribute('class', cl);
                    wordSpan.setAttribute('data-start', word.start);
                    wordSpan.setAttribute('data-end', word.end);
                    wordSpan.setAttribute('data-text', word.text);
                    wordSpan.textContent = word.text;
                    segmentDiv.appendChild(wordSpan);
                });
            }
        });

    format();
    var preview = require("./preview.js");
    preview.redraw();
    
}

function clear() {
    jQuery(".transcript-content").text("");
    jQuery("#transcript").removeClass("loading");
    currentTranscript = null;
    clearTimeout(formatTimeout);
    clearTimeout(kaldiPoll);
    return currentTranscript;
}

function poll(job) {
    kaldiPoll = setTimeout(function(){
        var duration = +jQuery("#minimap #end").val();
        var pollUrl = `/kaldi/${job}?time=${kaldiTimer}&duration=${duration}`;
        jQuery.getJSON( pollUrl, function( data ) {
            if (data.status=="SUCCESS" && !data.error) {
                load({segments: data.script});
                jQuery("#transcript").removeClass("loading");
                format();                
            } else if (data.error) {
                jQuery("#transcript-pane .error span").html("The BBC R&D Kaldi transcription failed<br/><i>Ref: " + job + "</i>");
                jQuery("#transcript").removeClass("loading").addClass("error");
                logger.error("Kaldi job failed: " + job);
            } else {
                return poll(job);
            }
        });
    }, 5000);
    
}

function generate(blob) {
    
    clear();
    
    jQuery('#transcript')
    .addClass('loading');
    
    var formData = new FormData();
    formData.append("audio",blob);
    
    jQuery.ajax({
        url: "/kaldi/",
        data: formData,
        cache: false,
        contentType: false,
        processData: false,
        type: 'POST',
        success: function(data){
            kaldiTimer = Date.now();
            poll(data.job);
        },
        error: function(jqXHR, textStatus, errorThrown){
            jQuery("#transcript-pane .error span").text(errorThrown + " (" + jqXHR.status + "): " + jqXHR.responseText);
            jQuery("#transcript").removeClass("loading").addClass("error");
            logger.error("Error starting kaldi job (" + jqXHR.status + ": " + errorThrown + ")", jqXHR);
        }
    });
    
}

function exportTranscript() {
    
    var format = this.dataset.format,
    subs = toSubs(),
    duration = audio.duration(),
    preview = require('./preview'),
    selection = preview.selection(),
    projects = require('./projects'),
    projectTitle = projects.title().split('.')[0],
    text = '';

    utils.stats("increment", `user_activity.transcript.export.${format}`);

    var blocks = jQuery('.transcript-block').filter(function () {
        return jQuery(this).find('.transcript-word:not(.unused)').length;
    });
    
    if (format.startsWith('plain')) {
        // PLAIN
        subs.forEach(function (sub, i) {
            if (text.length) text += '\n';
            if (format == 'plain-timecodes') {
                if (text.length) text += '\n';
                text += formatHMS(sub.start) + ' - SPEAKER ' + (sub.speaker + 1);
            }
            sub.lines.forEach(function (line) {
                if (text.length) text += '\n';
                text += line;
            });
        });
        window.open('/transcript?txt=' + btoa(text));
    } else if (format == 'srt') {
        // SRT
        subs.forEach(function(sub, i) {
            if (text.length) text += '\n\n';
            text += (i+1) + '\n';
            text += formatHMS(sub.start).replace('.', ',');
            text += ' --> ';
            text += formatHMS(sub.end).replace('.', ',');
            sub.lines.forEach(function(line) {
                text += '\n' + line;
            });
        });
        var src = 'data:text/srt;base64,' + btoa(text);
        jQuery('#trasncript-export-dummy').attr('href', src);
        jQuery('#trasncript-export-dummy').attr('download', `${projectTitle}.srt`);
        document.getElementById('trasncript-export-dummy').click();
    } else if (format == 'ebu') {
        // EBU
        text = '<?xml version="1.0"?> <tt xmlns="http://www.w3.org/2006/10/ttaf1" xmlns:st="http://www.w3.org/ns/ttml#styling" xml:lang="eng"> <head> <styling> <style id="backgroundStyle" st:fontFamily="proportionalSansSerif" st:fontSize="18px" st:textAlign="center" st:backgroundColor="rgba(0,0,0,0)" st:displayAlign="center"/> </styling> <layout/> </head> <body> <div>';
        subs.forEach(function (sub, i) {
            var start = formatHMS(sub.start);
            var end = formatHMS(sub.end);
            text += `<p begin="${start}" end="${end}">`;
            sub.lines.forEach(function (line, j) {
                if (j>0) text += '<br/>';
                text += line;
            });
            text += '</p>';
        });
        text += '</div></body></tt>';
        var src = 'data:text/xml;base64,' + btoa(text);
        jQuery('#trasncript-export-dummy').attr('href', src);
        jQuery('#trasncript-export-dummy').attr('download', `${projectTitle}.xml`);
        document.getElementById('trasncript-export-dummy').click();
    }
    
    logger.info(USER.name + ' exported the transcript (' + format + ')');
}

function importTranscript() {
    jQuery("#input-transcript").click();
}

function importFromFile() {
    utils.stats("increment", "user_activity.transcript.import");
    function onReaderLoad(event){
        var script = { segments: [] };
        var result = event.target.result;
        var fileName = jQuery('#input-transcript').get(0).files[0].name;
        jQuery("#input-transcript").val(null);
        if (fileName.indexOf('.srt') !== -1) {
            // SRT
            var blocks = result.split('\n\n');
            blocks.forEach(function(block) {
                var lines = block.split('\n');
                var times = lines[1].split(' --> ');
                var blockStart = reverseHMS(times[0]);
                var blockEnd = reverseHMS(times[1]);
                var text = lines.splice(2).join('');
                script.segments.push({
                    text,
                    start: blockStart,
                    end: blockEnd
                });
            });
        } else if (fileName.indexOf('.xml') !== -1) {
            // XML
            var blocks = result.split('<p ').splice(1);
            blocks.forEach(function(block) {
                var times = block.split('">')[0].split('"');
                var blockStart = reverseHMS(times[1]);
                var blockEnd = reverseHMS(times[3]);
                var text = block.split('">').splice(1).join('').replace(/<br\/>/g, '').split('</p>')[0];
                script.segments.push({
                    text,
                    start: blockStart,
                    end: blockEnd
                });
            });
        } else if (fileName.indexOf('.txt') !== -1) {
            var times = [];
            if (result.indexOf(" - SPEAKER ") !== -1) {
              result.split(' - SPEAKER ').forEach(function(line){
                times.push(line.split('\n\n').pop());
              });
              times.pop();
            }
            var blocks = result.split('\n\n');
            var charCount = 0;
            blocks.forEach(function(block, i) {
                var lines = block.split('\n');
                var segment = {};
                if (times.length) {
                    segment.text = lines.splice(1).join('');
                    segment.start = reverseHMS(times[i]);
                    segment.end = times[i + 1] ? reverseHMS(times[i + 1]) : audio.duration();
                } else {
                    segment.text = lines.join('');
                    charCount += segment.text.replace(/ /g, '').length;
                }
                script.segments.push(segment);
            });
            if (!times.length) {
                var dur = audio.duration();
                var secPerChar = dur / charCount;
                var time = 0;
                script.segments.forEach(function(segment) {
                    segment.start = time;
                    segment.end = time + secPerChar * segment.text.replace(/ /g, "").length;
                    time = segment.end;
                });
            }
        } else {
            return alert("Unsupported file type.");
        }

        // If empty
        if (!script.segments.length) {
            return alert("That file could not be imported.");
        }

        // Assign speaker and word timings
        script.segments.forEach(function(segment) {
            segment.speaker = 0;
            if (segment.text) {
                var dur = segment.end - segment.start;
                var charCount = segment.text.replace(/ /g, '').length;
                var secPerChar = dur / charCount;
                var time = segment.start;
                segment.words = [];
                segment.text.split(' ').forEach(function(word) {
                    var start = time;
                    var end = time + (secPerChar * word.length);
                    time = end;
                    segment.words.push({
                        start: +start.toFixed(2),
                        end: +end.toFixed(2),
                        text: word
                    });
                });
                delete segment.text;
            }
        });

        // Load
        load(script);
    }
    var reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(this.files[0]);
}

function init() {
    // Attach listener to hightlight words during playback
    jQuery('audio').on('timeupdate', function() {
        jQuery('.transcript-word').removeClass('played');
        if (!this.paused) {
            var currentTime = this.currentTime;
            jQuery('.transcript-word').filter(function() {
                var wordStart = +jQuery(this).attr('data-start') + 0.1;
                return wordStart < currentTime;
            }).addClass('played');
        }
    });

    jQuery(document).on('paste', '.transcript-editor', function(e){
        utils.stopIt(e);
        var sel = window.getSelection();
        var selNode = sel.focusNode.parentElement;
        var text = ' ' + e.originalEvent.clipboardData.getData("text/plain") + ' ';
        if (selNode.className.includes('transcript-segment')) {
            jQuery(selNode).find('.transcript-word:last').append(text);
            var newNode = jQuery(selNode).find('.transcript-word:last').get(0);
            newNode.normalize();
            sel.collapse(newNode.firstChild, newNode.firstChild.length);
        } else {
            document.execCommand("insertHTML", false, text);
        }
        format();
    });
    
    // Format text to simulate line/page breaks
    jQuery(document).on('keydown', '.transcript-editor', function (e) {
        clearTimeout(formatTimeout);
        jQuery('.transcript-btn-select').hide();
        // Arrow - down
        if (e.keyCode === 40) {
            var sel = window.getSelection();
            var selNode = sel.focusNode.parentElement;
            var offset = sel.focusOffset;
            jQuery(selNode).prevAll(".transcript-word, .transcript-space, .transcript-line").each(function() {
                if (jQuery(this).is('.transcript-line')) return false;
                if (jQuery(this).is(".transcript-space")) offset++;
                offset += jQuery(this).text().length;
            });
            var nextLine = jQuery(selNode).nextAll('.transcript-line').first();
            if (nextLine.length) {
                var firstWord = jQuery(nextLine).nextAll('.transcript-word').first();
            } else {
                var firstWord = jQuery(selNode).parentsUntil('.transcript-content').next().find('.transcript-word:first');
            }
            if (firstWord) {
                var charCount = firstWord.text().length;
                if (charCount >= offset) {
                    var newSel = firstWord.get()[0];
                } else {
                    var newSel = null;
                    jQuery(firstWord).nextAll('.transcript-word').each(function() {
                        charCount += jQuery(this).text().length + 1;
                        if (!newSel && charCount >= offset) {
                            newSel = jQuery(this).get()[0];
                            return false;
                        }
                    });
                    if (!newSel) {
                        var lastWord = jQuery(firstWord).nextAll(".transcript-word:last");
                        newSel = lastWord.length ? jQuery(lastWord).get()[0] : jQuery(firstWord).get()[0];
                    }
                }
            }
            if (newSel.firstChild) sel.collapse(newSel.firstChild, Math.round(newSel.firstChild.length / 2));
            utils.stopIt(e);
        // Arrow - up
        } else if (e.keyCode === 38) {
            var sel = window.getSelection();
            var selNode = sel.focusNode.parentElement;
            var offset = sel.focusOffset;
            jQuery(selNode).prevAll(".transcript-word, .transcript-space, .transcript-line").each(function() {
                if (jQuery(this).is('.transcript-line')) return false;
                if (jQuery(this).is(".transcript-space")) offset++;
                offset += jQuery(this).text().length;
            });
            var prevLines = jQuery(selNode).prevAll('.transcript-line');
            if (prevLines.length == 1) {
                var firstWord = jQuery(selNode).parentsUntil(".transcript-content").find('.transcript-word:first');
            } else if (prevLines.length > 1) {
                var firstWord = jQuery(prevLines[1]).nextAll('.transript-word').first();
            } else {
                var prevBlock = jQuery(selNode).parentsUntil('.transcript-content').prev();
                var prevBlockLines = prevBlock.find('.transcript-line');
                if (prevBlockLines.length) {
                    var firstWord = prevBlockLines.last().nextAll('.transcript-word:first');
                } else {
                    var firstWord = prevBlock.find('.transcript-word');
                }
            }
            if (firstWord) {
                var charCount = firstWord.text().length;
                if (charCount >= offset) {
                    var newSel = firstWord.get()[0];
                } else {
                    var newSel = null;
                    jQuery(firstWord).nextAll('.transcript-word').each(function() {
                        charCount += jQuery(this).text().length + 1;
                        if (!newSel && charCount >= offset) {
                            newSel = jQuery(this).get()[0];
                            return false;
                        }
                    });
                }
            }
            if (newSel.firstChild) sel.collapse(newSel.firstChild, Math.round(newSel.firstChild.length / 2));
            utils.stopIt(e);
        // Backspace
        } else if (e.keyCode === 8) {
            var sel = window.getSelection();
            var selNode = sel.focusNode.parentElement;
            var selPos = sel.focusOffset;
            if (jQuery(selNode).is('.transcript-segment')) {
                selNode = jQuery(selNode).find('.transcript-word:first').get()[0];
                selPos = 0;
            }
            // Merge with previous block
            if (jQuery(selNode).is(':first-child') && (selPos==0 || jQuery(selNode).text()==' ') && sel.focusNode===sel.anchorNode) {
                var block = jQuery(selNode).parents('.transcript-block')[0];
                if (jQuery(block).index() > 0) {
                    var words = jQuery(block).find('.transcript-segment').children();
                    var prevBlock = jQuery(block).prev();
                    var prevBlockIndex = prevBlock.index();
                    var selWord = jQuery(block).find('.transcript-word:first').get()[0];
                    prevBlock.find('.transcript-segment').append(words);
                    jQuery(block).remove();
                    selNode.normalize();
                    format();
                    sel.collapse(selWord.firstChild, 0);
                }
                utils.stopIt(e);
            // Merge with previous word
            } else if (selNode.className.includes('transcript-space')) {
                var prev = jQuery(selNode).prev();
                var newPos = prev.text().length;
                var next = jQuery(selNode).next();
                prev.append(next.text());
                next.remove();
                selNode.normalize();
                format();
                sel.collapse(prev.get()[0].firstChild, newPos);
                utils.stopIt(e);
            } else if (selNode.className.includes('transcript-word') && selPos === 0) {
                var prev = jQuery(selNode).prevAll('.transcript-word')[0];
                var newPos = prev.firstChild.length;
                prev.append(selNode.firstChild);
                selNode.remove();
                selNode.normalize();
                sel.collapse(prev.firstChild, newPos);
                format();
                utils.stopIt(e);
            }          
        // Delete
        } else if (e.keyCode === 46) {
            var sel = window.getSelection();
            var selNode = sel.focusNode.parentElement;
            var selPos = sel.focusOffset;
            if (selNode.className.includes('transcript-word') && selPos === sel.focusNode.length) {
                var newPos = sel.focusNode.length;
                var next = jQuery(selNode).nextAll('.transcript-word')[0];
                jQuery(selNode).append(next.firstChild);
                next.remove();
                selNode.normalize();
                format();
                sel.collapse(selNode.firstChild, newPos);
                utils.stopIt(e);
            }
        // New line
        } else if (e.keyCode === 13) {
            var sel = window.getSelection();
            var selNode = sel.focusNode.parentElement;
            var selPos = sel.focusOffset;
            if (selPos != sel.focusNode.length) {
                var word = sel.focusNode.textContent;
                var splitWord = [word.slice(0, selPos), word.slice(selPos)].join(' ');
                jQuery(selNode).text(splitWord);
                format();
            }
            var block = jQuery(selNode).parentsUntil('.transcript-content').last();
            var words = jQuery(selNode).nextAll();
            var endOfBlock = !words.length;
            if (endOfBlock) {
                var words = document.createElement('span');
                words.setAttribute('class', 'transcript-word added');
                words.textContent = ' ';
            }
            var newBlock = block.clone();
            newBlock.find('.transcript-segment').html('').append(words);
            newBlock.addClass('break');
            block.after(newBlock);
            newBlock.next().addClass('break');
            if (!endOfBlock) format();
            sel.collapse(jQuery(newBlock).find('.transcript-word:first').get()[0], 0);
            utils.stopIt(e);
        }
    });
    jQuery(document).on('keyup', '.transcript-editor', function (e) {
        clearTimeout(formatTimeout);
        var sel = window.getSelection();
        if (sel.focusNode){
            var selNode = sel.focusNode.parentElement;
            if (selNode.className == '') {
                selNode = selNode.parentElement;
            }
            if (selNode.className.includes('transcript-space')) {
                var spaceText = sel.focusNode.textContent.trim();
                if (spaceText.length > 0) {
                    jQuery(selNode).prevAll('.transcript-word').first().append(' ' + spaceText);
                    newNode = jQuery(selNode).prevAll('.transcript-word')[0];
                    jQuery(selNode).remove();
                    newNode.normalize();
                    sel.collapse(newNode.firstChild, newNode.firstChild.length);
                    format();
                    return;
                }
            }
            if (jQuery(sel.focusNode.parentNode).hasClass('transcript-word') && sel.focusNode.nodeValue.includes(' ')) {
                format();
                return;
            } 
        }
        if (e.key!="Meta" && e.keyCode!==13) {
            formatTimeout = setTimeout(function(){
                format();
                var preview = require("./preview.js");
                preview.redraw();
            }, 500);
        }
    });
    
    // Move playhead when clicking on a word
    jQuery(document).on('click', '.transcript-word:not(.unused)', function (e) {
        var isPlaying = audio.isPlaying();
        var isAdded = jQuery(this).hasClass('added');
        if (!isPlaying || !isAdded) {
            var time = jQuery(this).attr('data-start');
            jQuery('audio').get(0).currentTime = time;
        }
    });
    
    // Make clip selection when highlighting transcript segments
    jQuery(document).on('mouseup', '.transcript-editor', function(e) {
        var sel = window.getSelection();
        if (e.detail < 2 && sel.anchorNode && sel.focusNode) {
            var selAnchor = sel.anchorNode.parentElement;
            var selFocus = sel.focusNode.parentElement;
            if (selAnchor != selFocus && selAnchor.className.includes('transcript-word') && selFocus.className.includes('transcript-word')) {
                if (selAnchor.offsetTop > selFocus.offsetTop) {
                    var firstNode = selFocus;
                    var lastNode = selAnchor;
                } else {
                    var firstNode = selAnchor;
                    var lastNode = selFocus;
                }
                var top = firstNode.offsetTop - 36;
                var lineEndNode = jQuery(selAnchor).nextUntil('.transcript-line').filter('.transcript-word').last();
                if (!lineEndNode.length) lineEndNode = firstNode;
                var startLeft = jQuery(firstNode).offset().left;
                if (jQuery(lineEndNode).offset().top < jQuery(lastNode).offset().top) {
                    var endLeft = jQuery(lineEndNode).offset().left + jQuery(lineEndNode).width();
                } else {
                    var endLeft = jQuery(lastNode).offset().left + jQuery(lastNode).width();
                }
                var offset = jQuery('#transcript').offset().left;
                var left = (startLeft - offset) + (endLeft - startLeft)/2;
                left -= jQuery('.transcript-btn-select').width()/2;
                jQuery('.transcript-btn-select').css('top', top);
                jQuery('.transcript-btn-select').css('left', left);
                var firstStart = +jQuery(selAnchor).attr('data-start');
                var firstEnd = +jQuery(selAnchor).attr('data-end');
                var start = firstStart + (firstEnd - firstStart) / 4;
                if (jQuery(selAnchor).is('.transcript-word:first') && start < 1) start = 0;
                var lastStart = +jQuery(selFocus).attr('data-start');
                var lastEnd = +jQuery(selFocus).attr('data-end');
                var end = lastEnd - (lastEnd - lastStart) / 4;
                if (jQuery(selFocus).is('.transcript-word:last') && dur - end < 1) end = dur;
                jQuery('.transcript-btn-select').attr('data-start', start).attr('data-end', end);
                jQuery('.transcript-btn-select').show();
            }
        }
    });
    jQuery(document).on('click', '.transcript-btn-select', function () {
        var dur = audio.duration();
        var start = +jQuery('.transcript-btn-select').attr('data-start');
        var end = +jQuery('.transcript-btn-select').attr('data-end');
        minimap.drawBrush({
            start: start / dur, 
            end: end / dur
        });
        jQuery('.transcript-btn-select').hide();
    });
    jQuery(document).on('click', function () {
        if (jQuery('.transcript-btn-select').is(':visible')) {
            var sel = window.getSelection();
            var selAnchor = sel.anchorNode.parentElement;
            var selFocus = sel.focusNode.parentElement;
            if (selAnchor == selFocus || !selAnchor.className.includes('transcript-word') || !selFocus.className.includes('transcript-word')) {
                jQuery('.transcript-btn-select').hide();
            }
        }
    });
    
    d3.selectAll(".transcript-export-btn").on("click", exportTranscript);
    d3.selectAll("#transcript-btn-import").on("click", importTranscript);
    d3.selectAll('#input-transcript').on('change', importFromFile);

    // Reformate line-breaks and speakers
    jQuery(document).on('change', '.transcript-speaker select', function() {
        var speaker = jQuery(this).val();
        jQuery(this).parentsUntil('.transcript-content').last().attr('data-speaker', speaker);
        format();
        // Count speakers
        var maxSpeaker = 0;
        jQuery('.transcript-block').each(function(){
            var blockSpeaker = +jQuery(this).attr('data-speaker');
            if (blockSpeaker > maxSpeaker) maxSpeaker = blockSpeaker;
        });
        var maxAvailable = jQuery(this).find('option').length - 1;
        if (maxSpeaker === maxAvailable) {
            // Add extra speaker option
            var newOpt = document.createElement("option");
            newOpt.value = maxSpeaker + 1;
            newOpt.text = `Speaker ${maxSpeaker + 2}`;
            jQuery('.transcript-speaker select').each(function(){
                jQuery(this).append(newOpt.cloneNode(true));
            });
            var lastColor = jQuery(".subtitle-color-col:last");
            lastColor.after(lastColor.clone());
            jQuery(".subtitle-color-col:last");
            jQuery(".subtitle-color-col:last input").attr("name", `subtitles.color.${maxSpeaker + 1}`);
        }
    });
    
    d3.selectAll('.subFormatToggle').on('click', function() {
        jQuery('#transcript .subFormatToggle, #transcript-settings').toggleClass('hidden');
        utils.stats("increment", "user_activity.transcript.format");
    });
    d3.selectAll('.subFormatAlias').on('click', function() {
        if (jQuery('#transcript-settings:visible').length) {
            jQuery('#transcript-settings')
            .stop()
            .css('background-color', '#FFFF9C')
            .animate({ backgroundColor: '#FFFFFF' }, 1500);
        } else {
            jQuery('#transcript .subFormatToggle, #transcript-settings').removeClass('hidden');
            jQuery('#transcript .subFormatToggle').addClass('hidden');
        }
    });

    jQuery(document).on('click', '#transcript-pane > div.tip', function(){
        format();
    });

    jQuery(document).on('change', 'input[name^="subtitle.color"]', function(){
        var block = jQuery(this).parentsUntil('.transcript-content').last();
        block.removeClass('same-speaker');
        format();
    });

    jQuery(document).on('click', '.transcript-manual', function (e) {
        loadEmpty();
        jQuery("#transcript").removeClass("loading error");
        utils.stopIt(e);
    });

    jQuery(document).on("click", ".transcript-import", function(e) {
      loadEmpty();
      jQuery("#transcript").removeClass("loading error");
      jQuery("#input-transcript").click();
      utils.stopIt(e);
    });

    var selectedNode = {};
    jQuery(document).on('mousedown', '#play, #pause', function(e){
        utils.stopIt(e);
        var sel = window.getSelection();
        selectedNode.node = sel.focusNode;
        selectedNode.offset = sel.focusOffset;
    });
    jQuery(document).on('mouseup', '#play, #pause', function (e) {
        var sel = window.getSelection();
        sel.collapse(selectedNode.node, selectedNode.offset);
    });

    jQuery(document).on('click', '#transcript-btn-enabled', function(e){
        var checkbox = jQuery(this).find('input');
        var checked = !checkbox.prop("checked");
        if (jQuery(e.target).is('input')) checked = !checked;
        checkbox.prop("checked", checked);
        jQuery(this).attr('data-enabled', checked);
        d3.select('#transcript-pane').classed('disabled', !checked);
        if (checked) {
            jQuery('#transcript .transcript-buttons .enabledOnly').show();
        } else {
            jQuery('#transcript .transcript-buttons .enabledOnly').hide();
        }
        var preview = require('./preview');
        preview.redraw();
    });
    
}

module.exports = {
    generate,
    load,
    clear,
    toJSON,
    toSubs,
    highlight,
    format,
    export: exportTranscript,
    init
};
