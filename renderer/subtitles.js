
var nextStart = {i: 0, j: 0, time: 0},
    subs = [],
    lines = [],
    srt = [];

function _srt(_) {
  return arguments.length ? (srt = _) : srt;
}

function _transcript(_) {
  return arguments.length ? (transcript = _) : transcript;
}

function _nextStart(_) {
  return arguments.length ? (nextStart = _) : nextStart;
}

function ifNumeric(val, alt, ratio) {
  ratio = ratio || 1;
  return (typeof val === "number" && !isNaN(val)) ? val*ratio : alt;
}

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

function save(type, subs, path, cb) {

  var fs = require('fs');
  subs = JSON.parse(subs);
  
  if (type=="srt"){
      // SRT
      text = "";
      for (var i = 0; i < subs.length; i++) {
          if (text.length) text += '\n\n';
          text += (i + 1) + '\n';
          text += formatHMS(subs[i].start).replace('.', ',');
          text += ' --> ';
          text += formatHMS(subs[i].end).replace('.', ',');
          for (var j = 0; j < subs[i].lines.length; j++) {
              text += '\n' + subs[i].lines[j];
          }
      }
    } else if (type=="xml") {
      // EBU-TT-D
      text = '<?xml version="1.0"?> <tt xmlns="http://www.w3.org/2006/10/ttaf1" xmlns:st="http://www.w3.org/ns/ttml#styling" xml:lang="eng"> <head> <styling> <style id="backgroundStyle" st:fontFamily="proportionalSansSerif" st:fontSize="18px" st:textAlign="center" st:backgroundColor="rgba(0,0,0,0)" st:displayAlign="center"/> </styling> <layout/> </head> <body> <div>';
      for (var i = 0; i < subs.length; i++) {
          var start = formatHMS(subs[i].start);
          var end = formatHMS(subs[i].end);
          text += `<p begin="${start}" end="${end}">`;
          for (var j = 0; j < subs[i].lines.length; j++) {
              if (j > 0) text += '<br/>';
              text += subs[i].lines[j];
          }
          text += '</p>';
      }
      text += '</div></body></tt>';
    } else {
      return cb("Unsupported subtitle format");
    }

    fs.writeFile(path, text, function(err){
      err = err ? "Error saving subtitle file: " + err : null;
      return cb(err);
    });

}

function format(options, cb) {

    if (cb) cb(null);
    return;

  if (!options.transcript) return;

  subs = [];

  var segments = options.transcript.segments,
      theme = options.theme,
      maxLineChars = ifNumeric(+theme.subtitles.lineWidth, 30),
      maxNumLines = ifNumeric(+theme.subtitles.linesMax, 2);

  // Loop through each transcript segment
  for (var i = 0; i < segments.length; i++) {
    var words = segments[i].words,
        speaker = segments[i].speaker,
        forceNewFrame = true;

    // Loop through each segment word
    for (var j = 0; j < words.length; j++) {

      var word = words[j],
          start = word.start - options.trim.start,
          end = word.end - options.trim.start,
          text = word.punct || word.text,
          middle = start + (end-start)/2;

      if (start >= 0 && end <= options.trim.end - options.trim.start ) {

        var latestFrame = subs.length ? subs[subs.length-1] : null,
            latestLine = latestFrame ? latestFrame.lines[latestFrame.lines.length-1] : null;

        if (!latestFrame || forceNewFrame || (latestLine.length + text.length + 1 > maxLineChars && latestFrame.lines.length + 1 > maxNumLines) || subs[subs.length-1].end < (start - 5)  ) {
          // Make a new frame if:
          //    - it's the first one
          //    - we've moved to a new segment
          //    - we've reached maximum number of lines (and the last line is full)
          //    - there was a long gap between the last word and this one
          if ( latestFrame && start - latestFrame.end < 2 ) {
            // If the start of the new frame is within 1s of the end of the last, split the difference
            var diff = start - latestFrame.end;
            start = start - diff/2;
            latestFrame.end += diff/2;
          } else if (!latestFrame && start < 2) {
            // If the first frame is near the start, force it to zero
            start = 0;
          }
          subs.push( {lines: [text], start: start, end: end, speaker: speaker} );
          forceNewFrame = false;
        } else {
          if (latestLine.length + text.length + 1 > maxLineChars) {
            // Make a new line in an existing frame if the current one is full
            latestFrame.lines.push(text);
          } else {
            // Or append the text to the current line if there's still space
            latestFrame.lines[latestFrame.lines.length-1] += " " + text;
          }
          // Update the end time of the frame
          latestFrame.end = end;
        }

      } // if within trim range

    } // word loop

  } // segment loop

  // Generate Subtile File
  if (subs.length>0) {
    function timeFormat(t) {
      t = Number(t);
      var h = Math.floor(t / 3600),
          m = Math.floor(t % 3600 / 60),
          s = (t % 3600 % 60).toFixed(2),
          string = `00${h}`.slice(-2) + ":" + `00${m}`.slice(-2) + ":" + `00${s}`.slice(-5);
      return string.replace(".",",");
    }
    srt = [];
    for (var i = 0; i < subs.length; i++) {
      var key = timeFormat(subs[i].start) + " --> " + timeFormat(subs[i].end);
      srt[key] = subs[i].lines.join("\n");
    }
  }

  if (cb) cb(null);

}

function draw(context, theme, subs, time) {

  var lines = null;
  for (var i = 0; i < subs.length; i++) {
    if (subs[i].start <= time && subs[i].end > time) {
      lines = subs[i].lines;
      var speaker = subs[i].speaker;
      break;
    }
  }

  if (!lines) return false;

  // Format
  if (theme.subtitles.fontWeight=="Regular") theme.subtitles.fontWeight = ""; 
  var ratio = { // Font sizes/spacing are relative to the default theme size, (1280x720), so scale accordingly
        width: theme.width/1280,
        height: theme.height/720
      },
      fontSize = theme.subtitles.fontSize * ratio.width,
      font = fontSize + "px '" + theme.subtitles.font + theme.subtitles.fontWeight + "'",
      left = ifNumeric(theme.subtitles.left, 0, theme.width),
      right = ifNumeric(theme.subtitles.right, 1, theme.width),
      captionWidth = right - left,
      horizontal = ifNumeric(+theme.subtitles.margin.horizontal, 0.5, theme.width),
      vertical = ifNumeric(+theme.subtitles.margin.vertical, 0.5, theme.height),
      spacing = theme.subtitles.lineSpacing;

  var totalHeight = lines.length * (fontSize + (spacing * ratio.width)),
      x = horizontal,
      // x = theme.subtitles.align === "left" ? left : theme.subtitles.align === "right" ? right : (left + right) / 2,
      y;

  if (theme.subtitles.valign=="top") {
    y = vertical;
  } else if (theme.subtitles.valign=="bottom") {
    y = vertical - totalHeight;
  } else {
    y = vertical - totalHeight/2;
  }

  // Draw background box
  if (lines.length && theme.subtitles.box && theme.subtitles.box.opacity>0) {
    context.globalAlpha = theme.subtitles.box.opacity;
    context.fillStyle = theme.subtitles.box.color || "#000000";
    context.fillRect(0, y-spacing, theme.width, totalHeight + spacing * (Math.max(2, lines.length)) );
    context.globalAlpha = 1;
  }

  context.font = font;
  context.textBaseline = "top";
  context.textAlign = theme.subtitles.align || "center";
  lines.forEach(function(text, i){
    text = text.replace(/  +/g, ' ');
    if (theme.subtitles.fontTransform == 'upper') {
      text = text.toUpperCase();
    } else if (theme.subtitles.fontTransform == 'lower') {
      text = text.toLowerCase();
    }
    var lineY = y + i * (fontSize + (spacing * ratio.width))
    if (theme.subtitles.stroke && theme.subtitles.stroke.width>0) {
      context.strokeStyle = theme.subtitles.stroke.color;
      context.lineWidth = theme.subtitles.stroke.width * ratio.width;
      context.strokeText(text, x, lineY);
    }
    context.fillStyle = theme.subtitles.color[speaker] ? theme.subtitles.color[speaker] : theme.subtitles.color[0];
    context.fillText(text, x, lineY);
  });

 }


module.exports = {
  draw: draw,
  format: format,
  nextStart: _nextStart,
  transcript: _transcript,
  save: save
}
