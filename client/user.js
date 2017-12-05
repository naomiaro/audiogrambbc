const logger = require('./slack');

global.USER = { name: 'Unknown', email: null };

function displayMessages(messages) {
    let i = 1;
    messages.forEach(message => {
        if (i>1) {
            const div = jQuery("#user-messages .message:last").clone();
            jQuery("#user-messages .message:last").after(div);
        }
        jQuery("#user-messages .message:last .user-messages-title").text(message.title);
        jQuery("#user-messages .message:last .user-messages-user").text(message.user);
        jQuery("#user-messages .message:last .user-messages-date").text(message.date);
        jQuery("#user-messages .message:last .user-messages-text").html(message.text);
        i++;
    });
    jQuery("#user-messages").modal("show");
}

function checkMessages(since) {
    jQuery.getJSON('/messages/' + since, function (data) {
        if (data.messages && data.messages.length) {
            jQuery(function () {
                displayMessages(data.messages);
            });
        }
    });
}

module.exports.init = function() {
    jQuery.getJSON('/whoami', function(data) {
        if (data.email) {
            USER.name = data.name;
            USER.email = data.email;
            jQuery("#recent-filter option[value='user']").text(data.name);
            logger.info(USER.name + ' logged in.\n`' + navigator.userAgent + '`');
            checkMessages(data.lastLogin);
        } else {
            logger.error('Unkown user logged in... ' + data);
        }
    
        // Piwik Code - for now, replaces Google Analytics
        // global._paq = global._paq || [];
        // /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
        // global._paq.push(['setUserId', USER.email]);
        // global._paq.push(['trackPageView']);
        // global._paq.push(['enableLinkTracking']);
        // (function() {
        //     var u = '//insight.newslabs.co/';
        //     global._paq.push(['setTrackerUrl', u + 'piwik.php']);
        //     global._paq.push(['setSiteId', '2']);
        //     var d = document,
        //         g = d.createElement('script'),
        //         s = d.getElementsByTagName('script')[0];
        //     g.type = 'text/javascript';
        //     g.async = true;
        //     g.defer = true;
        //     g.src = u + 'piwik.js';
        //     s.parentNode.insertBefore(g, s);
        // })();
        // End Piwik Code
    });
}
