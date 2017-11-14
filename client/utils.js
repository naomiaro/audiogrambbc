const projects = require('./projects');

function setClass(cl, msg, log) {
  if (jQuery('.modal').hasClass('in') && msg) {
    alert(msg);
  } else {
    jQuery('body').attr('class', cl || null);
    jQuery('#error, #success').text(msg || '');
  }
  // Log warning
  if ((log || (log === undefined && cl == 'error')) && msg) {
    // Get stack trace
    console.warn(msg);
    console.trace();
    var err = new Error();
    console.log(err.stack);
    // Log
    logger.warn(msg, err, USER);
  }
  jQuery('html,body').scrollTop(0);
}

function getURLParams(qs) {
    qs = qs || document.location.search;
    qs = qs.split('+').join(' ');
    var params = {},
        tokens,
        re = /[?&]?([^=]+)=([^&]*)/g;
    while ((tokens = re.exec(qs))) {
        params[decodeURIComponent(tokens[1])] = decodeURIComponent(tokens[2]);
    }
    return params;
}

function stopIt(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    if (e.stopPropagation) {
        e.stopPropagation();
    }
}

function pad(n, width, z) {
    z = z || '0';
    width = width || 2;
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function error(err) {
    setClass('error', 'Error...', false);
    if (typeof err === 'string') {
        var error = { message: err, stack: null };
    } else {
        var error = JSON.parse(err);
    }
    console.error(error.message);
    console.log(error.stack);
    // console.log("RLW  client error function: "  + msg.code + " / " + msg.name + " / " + msg.message);
    if (!error.message) {
        error.message = 'Unknown error';
    }
    logger.error(error.message, error, USER);
    d3.select('#loading-message').text('Loading...');
    utils.setClass('error', error.message, false);
}


function setBreadcrumb(level, id) {
    jQuery('section.breadcrumbs > span').removeClass('active');
    if (id) {
        jQuery('#breadcrumb_edit span').text(id);
    }
    jQuery('#breadcrumb_' + level).addClass('active');
    jQuery('#breadcrumb_' + level).prevAll().removeClass('hidden');
    jQuery('#breadcrumb_' + level).nextAll().addClass('hidden');
    d3.select('#breadcrumb_new').classed('hidden', level != 'new');
}

function clickBreadcrumb(level) {
    level = level || d3.event ? d3.event.currentTarget.attributes['id'].value.split('_').pop() : null;
    if (!level) return false;
    if (level == 'home') {
        if (!confirm('Are you sure you want to abandon your current proejct?')) return;
        projects.getProjects();
        utils.setClass('landing');
    } else if (level == 'edit') {
        utils.setClass(null);
    }
    setBreadcrumb(level);
}
d3.select('section.breadcrumbs > span').on('click', clickBreadcrumb);

module.exports = {
    setClass,
    getURLParams,
    stopIt,
    pad,
    error,
    setBreadcrumb
}
