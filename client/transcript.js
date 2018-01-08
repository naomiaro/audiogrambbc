var jQuery = require("jquery"),
  logger = require("./slack.js"),
  utils = require("./utils"),
  audio = require('./audio.js'),
  minimap = require('./minimap.js'),
  ReactDOM = require("react-dom"),
  React = require("react"),
  uuid = require("uuid/v4"),
  TranscriptEditor = require("transcript-editor").default,
  Transcript = require("transcript-model").Transcript,
  currentTranscript,
  kaldiPoll,
  formatTimeout;

var reformat = false;

// Highlight selected words 
function highlight(start, end) {
    jQuery(".transcript-word").removeClass("unused");
    if (start>=0 && end) {
        jQuery(".transcript-word").filter(function() {
            var wordStart = jQuery(this).attr("data-start"),
            wordEnd = jQuery(this).attr("data-end"),
            wordMiddle = wordEnd - (wordEnd-wordStart)/2;
            return wordEnd < start || wordStart > end;
        }).addClass("unused");
    }
}

function format() {
    if (!jQuery(".transcript-block").length) return;
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
        var text = jQuery(this).text();
        if (text.includes(' ')) {
            var words = text.split(' ').reverse();
            for (let i = 0; i < words.length - 1; i++) {
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
    jQuery('.transcript-word.added').attr('data-start', null).attr('data-end', null);
    jQuery('.transcript-word.added').each(function () {
        if (!jQuery(this).attr('data-start')) {
            var start = +jQuery(this).prevAll('.transcript-word:not(.added)').first().attr('data-end');
            if (!start) start = +jQuery(this).parentsUntil('.transcript-content').last().prev().find('.transcript-word:last').attr('data-end');
            if (!start) start = 0;
            var end = +jQuery(this).nextAll('.transcript-word:not(.added)').first().attr('data-start');
            if (!end) end = +jQuery(this).parentsUntil('.transcript-content').last().next().find('.transcript-word:first').attr('data-start');
            if (!end) end = audio.duration();
            var dur = end - start;
            var nextWords = jQuery(this).nextUntil('.transcript-word:not(.added)').filter('.transcript-word');
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
            newBlock.addClass('same-speaker');
            newBlock.find('.transcript-segment').html('').append(jQuery(this).nextAll());
            jQuery(this).parentsUntil('.transcript-content').last().after(newBlock);
        }
    });
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
        jQuery(this).find('.transcript-speaker select').val(speaker);
        if (speaker === prevSpeaker) {
            jQuery(this).addClass('same-speaker');
        } else {
            jQuery(this).removeClass('same-speaker');
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

    return;
}

function OLDformat() {
    var currentJSON = toJSON();
    var maxChar = +jQuery("input[name='subtitles.lineWidth']").val(),
    maxLines = +jQuery("input[name='subtitles.linesMax']").val(),
    charCount = 0,
    lineCount = 1;
    // LINE BREAKS
    jQuery('.transcript-editor-block__space').removeClass("line-break").removeClass("page-break");
    jQuery( ".transcript-editor-block__text, .transcript-editor-block__word" ).each(function( index ) {
        if (jQuery(this).is('.transcript-editor-block__word')) {
            if ( jQuery(this).is(".transcript-editor-block__word:not(.unused):first") && jQuery(this).prev().is(".transcript-editor-block__space") ) {
                // Audio has been trimmed at START
                jQuery(this).prev().addClass("page-break");
                charCount = 0;
                lineCount = 1;
            } else if ( jQuery(this).is(".transcript-editor-block__word:not(.unused):last") && jQuery(this).next().is(".transcript-editor-block__space") ) {
                // Audio has be trimmed at END
                jQuery(this).next().addClass("page-break");
                charCount = 0;
                lineCount = 1;
            }
            // Word (add to character count)
            var str = jQuery(this).text();
            charCount += str.length + 1;
            if ( (charCount-1) > maxChar ) {
                // Simulate line-break before word
                var space = jQuery(this).prevAll(".transcript-editor-block__space:first");
                space.addClass("line-break");
                if (lineCount+1 > maxLines) {
                    space.addClass("page-break");
                    lineCount = 1;
                } else {
                    lineCount++;
                }
                charCount = str.length + 1;
            }
        } else {
            // New block, reset counters
            charCount = 0;
            lineCount = 1;
        }
    });
    
    // SPEAKER SELECTION
    // Reset
    jQuery('select.transcript-speaker').remove();
    jQuery( ".transcript-editor-block__speaker" ).show();
    // Count number of speakers
    var count = Math.max(speakerCount(), currentJSON ? currentJSON.speakers.length : 0);
    // Add dropdown for each block
    var block = 0;
    jQuery( ".transcript-editor-block__speaker" ).each(function( index ) {
        var speaker = jQuery(this),
        select = document.createElement("select");
        speaker.after(select);
        speaker.hide();
        jQuery(select).addClass("transcript-speaker")
        for (var i = 1; i <= count+1 ; i++) {
            var option = document.createElement("option");
            option.text = "Speaker " + i;
            select.appendChild(option);
        }
        // jQuery(select).val(jQuery(speaker).text());
        if ( jQuery( ".transcript-editor-block__speaker" ).length == currentJSON.segments.length ) {
            var index = currentJSON.segments[block].speaker;
        } else {
            var index = +speaker.text().split(" ").pop() - 1;
        }
        jQuery(select).prop('selectedIndex', index);
        if (jQuery("input[name='subtitles.color." + index + "']").length) {
            var color = jQuery("input[name='subtitles.color." + index + "']").val();
        } else {
            var preview = require("./preview.js"),
            theme = preview.theme();
            if (theme.subtitles.color[index]) {
                color = theme.subtitles.color[index];
            } else {
                color = theme.subtitles.color[0];
                preview.themeConfig("subtitles.color." + index, color);
            }
            var el = jQuery("input[name^='subtitles.color']:last").parent();
            el.after(el.clone());
            jQuery("input[name^='subtitles.color']:last").attr("name","subtitles.color." + index).val(color);
        }
        jQuery(select).next().css("border-color",color);
        block++;
    });
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

function toJSON() {
    if (!currentTranscript) return null;
    var speakers = [];
    var segments = [];
    var speakerMax = 0;
    var json = {speakers, segments};
    // Segments
        if (!jQuery(".transcript-word").length) {
            json = currentTranscript.toJSON();
        } else {
            jQuery(".transcript-block").each(function () {
                var speaker = +jQuery(this).find('.transcript-speaker select').val();
                if (speaker > speakerMax) speakerMax = speaker;
                var segment = {speaker, words: []};
                jQuery(this).find(".transcript-word").each(function () {
                    var text = jQuery(this).text();
                    var start = +jQuery(this).attr('data-start');
                    var end = +jQuery(this).attr('data-end');
                    var word = {text, start, end};
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

function load(json) {
    clear();
    if (!json) return;

    if (json.hasOwnProperty("commaSegments")) {
        currentTranscript = Transcript.fromComma(json);
    } else if (json.hasOwnProperty("kaldi")) {
        currentTranscript = Transcript.fromKaldi(json.transcript, json.segments);
    } else {
        currentTranscript = Transcript.fromJSON(json);
    }    
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
        for (let i = 0; i <= speakerCount; i++) {
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
                blockDiv.setAttribute('class', 'transcript-block');
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
                    wordSpan.setAttribute('class', 'transcript-word');
                    wordSpan.setAttribute('data-start', word.start);
                    wordSpan.setAttribute('data-end', word.end);
                    wordSpan.setAttribute('data-text', word.text);
                    wordSpan.textContent = word.text;
                    segmentDiv.appendChild(wordSpan);
                });
            }
        });

    format();
    
}

function buildTranscript() {
    return data;

};

function clear() {
    jQuery(".transcript-content").text("");
    jQuery("#transcript").removeClass("loading");
    currentTranscript = null;
    clearTimeout(kaldiPoll);
    return currentTranscript;
}

function poll(job) {
    
    kaldiPoll = setTimeout(function(){
        jQuery.getJSON( "/kaldi/" + job, function( data ) {
            if (data.status=="SUCCESS" && !data.error) {
                var transcript = JSON.parse(data.transcript),
                segments = JSON.parse(data.segments);
                load({transcript: transcript, segments: segments, kaldi: transcript.metadata.version});
                jQuery("#transcript").removeClass("loading");
            } else if (data.error) {
                jQuery("#transcript-pane .error span").html("The BBC R&D Kaldi transcription failed<br/><i>Ref: " + job + "</i>");
                jQuery("#transcript").removeClass("loading").addClass("error");
                logger.error("Kaldi job failed: " + job);
            } else {
                poll(job);
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
    function formatHMS(t) {
        t = Number(t);
        var h = Math.floor(t / 3600),
        m = Math.floor((t % 3600) / 60),
        s = ((t % 3600) % 60).toFixed(2),
        string =
        `00${h}`.slice(-2) +
        ':' +
        `00${m}`.slice(-2) +
        ':' +
        `00${s}`.slice(-5);
        return string;
    }
    
    var format = this.dataset.format,
    script = transcript.toJSON(),
    selection = preview.selection(),
    text = '';
    
    if (format.startsWith('plain')) {
        // PLAIN
        script.segments.forEach(function(segment, i) {
            newLine = true;
            segment.words.forEach(function(word, i) {
                if (
                    word.start >= selection.start &&
                    word.end <= selection.end
                ) {
                    if (newLine) {
                        if (format == 'plain-timecodes') {
                            text += formatHMS(word.start) + '\n';
                        }
                        newLine = false;
                    }
                    text += word.text + ' ';
                }
            });
            text += '\n\n';
        });
        window.open('data:text/plain;charset=utf-8;base64,' + btoa(text));
    } else if (format == 'srt') {
        // SRT
        script.segments.forEach(function(segment, i) {
            var lineLength = 0,
            lines = 1;
            segment.words.forEach(function(word, i) {
                if (
                    word.start >= selection.start &&
                    word.end <= selection.end
                ) {
                    if (lineLength + word.text.length + 1 > 37) {
                        text += '\n';
                        lines++;
                        lineLength = 0;
                    }
                    if (lines > 2) {
                        lines = 1;
                        text += '\n';
                    }
                    if ((lines == 1) & (lineLength == 0)) {
                        var start = word.start,
                        end = Math.min(
                            selection.end,
                            segment.words[segment.words.length - 1].end
                        );
                        text +=
                        formatHMS(start).replace('.', ',') +
                        ' --> ' +
                        formatHMS(end).replace('.', ',') +
                        '\n';
                    }
                    text += word.text + ' ';
                    lineLength += word.text.length + 1;
                }
            });
            text += '\n\n';
        });
        text += '</div> </body> </tt>';
        var src = 'data:text/srt;base64,' + btoa(text);
        jQuery('#trasncript-export-dummy').attr('href', src);
        jQuery('#trasncript-export-dummy').attr('download', 'transcript.srt');
        document.getElementById('trasncript-export-dummy').click();
    } else if (format == 'ebu') {
        // EBU
        text =
        '<?xml version="1.0"?> <tt xmlns="http://www.w3.org/2006/10/ttaf1" xmlns:st="http://www.w3.org/ns/ttml#styling" xml:lang="eng" ';
        text +=
        '> <head> <styling> <style id="backgroundStyle" st:fontFamily="proportionalSansSerif" st:fontSize="18px" st:textAlign="center" st:backgroundColor="rgba(0,0,0,0)" st:displayAlign="center"/> </styling> <layout/> </head> <body> <div>';
        script.segments.forEach(function(segment, i) {
            var lineLength = 0,
            lines = 1;
            segment.words.forEach(function(word, i) {
                if (
                    word.start >= selection.start &&
                    word.end <= selection.end
                ) {
                    if (lineLength + word.text.length + 1 > 37) {
                        lines++;
                        text += '<br/>';
                        lineLength = 0;
                    }
                    if (lines > 2) {
                        lines = 1;
                        text += '</p>';
                    }
                    if ((lines == 1) & (lineLength == 0)) {
                        var start = word.start,
                        end = Math.min(
                            selection.end,
                            segment.words[segment.words.length - 1].end
                        );
                        text +=
                        '<p begin="' +
                        formatHMS(start)
                        .split('.')
                        .shift() +
                        '" end="' +
                        formatHMS(end)
                        .split('.')
                        .shift() +
                        '">';
                    }
                    text += word.text + ' ';
                    lineLength += word.text.length + 1;
                }
            });
            text += '</p>';
        });
        var src = 'data:text/srt;base64,' + btoa(text);
        jQuery('#trasncript-export-dummy').attr('href', src);
        jQuery('#trasncript-export-dummy').attr('download', 'transcript.xml');
        document.getElementById('trasncript-export-dummy').click();
    }
    
    logger.info(USER.name + ' exported the transcript (' + format + ')');
}

function importFromFile() {
    function onReaderLoad(event){
        var obj = JSON.parse(event.target.result);
        load(obj);
    }
    var reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(this.files[0]);
}

function init() {
    // Attach listener to hightlight words during playback
    jQuery('audio').on('timeupdate', function() {
        jQuery('.transcript-editor-block__word').removeClass('played');
        if (!this.paused) {
            var currentTime = this.currentTime;
            jQuery('.transcript-editor-block__word')
            .filter(function() {
                var wordStart = +jQuery(this).attr('data-start') + 0.1;
                return wordStart < currentTime;
            })
            .addClass('played');
        }
    });

    jQuery(document).on('paste', '.transcript-editor', function(e){
        utils.stopIt(e);
        var text = ' ' + e.originalEvent.clipboardData.getData("text/plain") + ' ';
        document.execCommand("insertHTML", false, text);
    });
    
    // Format text to simulate line/page breaks
    jQuery(document).on('keydown', '.transcript-editor', function (e) {
        clearTimeout(formatTimeout);
        // Backspace
        if (e.keyCode === 8) {
            var sel = window.getSelection();
            var selNode = sel.focusNode.parentElement;
            var selPos = sel.focusOffset;
            if (jQuery(selNode).is('.transcript-segment')) {
                selNode = jQuery(selNode).find('.transcript-word:first').get()[0];
                selPos = 0;
            }
            // Merge with previous block
            if (jQuery(selNode).is(':first-child')) {
                var block = jQuery(selNode).parents('.transcript-block')[0];
                if (jQuery(block).index() > 0) {
                    var words = jQuery(block).find('.transcript-segment').children();
                    var prevBlock = jQuery(block).prev();
                    var prevBlockIndex = prevBlock.index();
                    var prevBlockWordIndex = prevBlock.find('.transcript-word').length;
                    prevBlock.find('.transcript-segment').append(words);
                    jQuery(block).remove();
                    selNode.normalize();
                    format();
                    var selWord = jQuery(`.transcript-block:eq(${prevBlockIndex}) .transcript-word:eq(${prevBlockWordIndex})`).get()[0];
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
                var word = sel.focusNode.textContent.slice(0, selPos) + ' ';
                word += sel.focusNode.textContent.slice(3, sel.focusNode.textContent.length);
                jQuery(selNode).text(word);
                format();
            }
            var block = jQuery(selNode).parentsUntil('.transcript-content').last();
            var words = jQuery(selNode).nextAll();
            var newBlock = block.clone();
            newBlock.find('.transcript-segment').html('').append(words);
            newBlock.addClass('break');
            block.after(newBlock);
            format();
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
                    jQuery(selNode).nextAll('.transcript-word')[0].prepend(spaceText);
                    selNode = jQuery(selNode).nextAll('.transcript-word')[0];
                    sel.collapse(selNode.firstChild, spaceText.length);
                    format();
                    return;
                }
            }
            if (jQuery(sel.focusNode.parentNode).hasClass('transcript-word') && sel.focusNode.nodeValue.includes(' ')) {
                format();
                return;
            } 
        }
        // formatTimeout = setTimeout(function(){ format() }, 500);
    });
    
    // Move playhead when clicking on a word
    jQuery(document).on('click', '.transcript-editor', function (e) {
        var sel = window.getSelection();
        var selPos = sel.focusOffset;
        var selNode = sel.focusNode.parentElement;
        if (selNode.className.includes('transcript-word')) {
            var time = jQuery(selNode).attr('data-start');
            jQuery('audio').get(0).currentTime = time;
        }
        if (e.detail > 1) {
            utils.stopIt(e);
            if (sel.focusNode) {
                sel.collapse(sel.focusNode, 0);
            }
        }
    });
    
    // Make clip selection when highlighting transcript segments
    jQuery(document).on('mouseup', '.transcript-editor', function(e) {
        var sel = window.getSelection();
        if (e.detail < 2 && sel.anchorNode && sel.focusNode) {
            var selAnchor = sel.anchorNode.parentElement;
            var selFocus = sel.focusNode.parentElement;
            if (selAnchor != selFocus && selAnchor.className.includes('transcript-word') && selFocus.className.includes('transcript-word')) {
                var dur = audio.duration();
                var firstStart = +jQuery(selAnchor).attr('data-start');
                var firstEnd = +jQuery(selAnchor).attr('data-end');
                var start = firstStart + (firstEnd - firstStart) / 4;
                if (jQuery(selAnchor).is('.transcript-word:first') && start < 1) start = 0;
                var lastStart = +jQuery(selFocus).attr('data-start');
                var lastEnd = +jQuery(selFocus).attr('data-end');
                var end = lastEnd - (lastEnd - lastStart) / 4;
                if (jQuery(selFocus).is('.transcript-word:last') && dur - end < 1) end = dur;
                minimap.drawBrush({
                    start: start / dur, 
                    end: end / dur
                });
                sel.collapse(sel.anchorNode, 0);
            }
        }
    });

    // var selectionStart;
    // jQuery(document)
    // .on('mousedown', '.public-DraftStyleDefault-block', function() {
    //     // Start selection on block whitespace
    //     if (!selectionStart) {
    //         selectionStart = jQuery(this)
    //         .parents('[data-block]')
    //         .next()
    //         .find('.transcript-editor-block__word:first');
    //     }
    // })
    // .on('mousedown', '.transcript-editor-block__space', function() {
    //     // Start selection on space between words
    //     if (!selectionStart) {
    //         selectionStart = jQuery(this).prev();
    //     }
    // })
    // .on('mousedown', '.transcript-editor-block__word', function() {
    //     // Start selection on a word
    //     selectionStart = jQuery(this);
    // })
    // .on('mouseup', 'body *', function() {
    //     if (selectionStart) {
    //         var selectionEnd = null;
    //         if (jQuery(this).is('.transcript-editor-block__word *')) {
    //             // Finish selection on a word
    //             selectionEnd = jQuery(this).parents('.transcript-editor-block__word');
    //         } else if (jQuery(this).is('.transcript-editor-block__space *')) {
    //             // Finish selection on a space
    //             selectionEnd = jQuery(this)
    //             .parents('.transcript-editor-block__space')
    //             .prev();
    //         } else if (jQuery(this).is('.public-DraftStyleDefault-block')) {
    //             // Finish selection on block whitespace
    //             selectionEnd = jQuery(this).find('.transcript-editor-block__word:last');
    //         }
    //         if (selectionEnd && selectionStart.get(0) !== selectionEnd.get(0)) {
    //             // If start/end points aren't the same
    //             var minimap = require('./minimap.js'),
    //             audio = require('./audio.js'),
    //             duration = Math.round(100 * audio.duration()) / 100,
    //             start = +jQuery(selectionStart).attr('data-start'),
    //             end = +jQuery(selectionEnd).attr('data-end');
    //             if (start > end) {
    //                 end = +jQuery(selectionStart).attr('data-start');
    //                 start = +jQuery(selectionEnd).attr('data-end');
    //             }
    //             if (!jQuery(this).is('.public-DraftStyleDefault-block') || end - start > 1) {
    //                 start = start / duration;
    //                 end = end / duration;
    //                 minimap.drawBrush({ start: start, end: end });
    //                 if (window.getSelection) {
    //                     window.getSelection().removeAllRanges();
    //                 } else if (document.selection) {
    //                     document.selection.empty();
    //                 }
    //             }
    //         }
    //     }
    //     selectionStart = null;
    // });
    
    d3.selectAll('.transcript-export-btn').on('click', exportTranscript);
    d3.selectAll('#input-transcript').on('change', importFromFile);
    // Reformate line-breaks and speakers
    jQuery(document).on('change', '.transcript-speaker select', function() {
        var speaker = jQuery(this).val();
        jQuery(this).parentsUntil('.transcript-content').last().attr('data-speaker', speaker);
        format();
    });
    
    d3.selectAll('.subFormatToggle').on('click', function() {
        jQuery('#transcript .subFormatToggle, #transcript-settings').toggleClass('hidden');
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
        console.log(toJSON());
    });
    
}

module.exports = {
    generate,
    load,
    clear,
    toJSON,
    highlight,
    format,
    export: exportTranscript,
    init
};
