var logger = require('./slack');

global.USER = { name: 'Unknown', email: null };

function formatDate(input) {
    var d = input ? new Date(input) : new Date();
    var month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var date = d.getDate() + " " + month[d.getMonth()];
    var time = d
        .toLocaleTimeString()
        .toLowerCase()
        .replace(/([\d]+:[\d]+):[\d]+(\s\w+)/g, "$1$2");
    return date + ", " + time;
};

function displayMessages(messages) {
    var i = 1;
    messages.forEach(function(message) {
        if (i>1) {
            var div = jQuery(".user-messages.modal .message:last").clone();
            jQuery(".user-messages.modal .message:last").after(div);
        }
        jQuery(".user-messages.modal .message:last .user-messages-title").text(message.title);
        jQuery(".user-messages.modal .message:last .user-messages-user").text(message.user);
        jQuery(".user-messages.modal .message:last .user-messages-date").text(formatDate(message.date));
        jQuery(".user-messages.modal .message:last .user-messages-text").html(message.text);
        i++;
    });
    jQuery(".user-messages.modal").modal("show");
}

function checkMessages(since, force) {
    jQuery.getJSON('/messages/' + since,  function (data) {
        if (data.messages && data.messages.length) {
            jQuery(function () {
                displayMessages(data.messages);
            });
        } else if (force) {
            alert('There are no active user messages.');
        }
    }.bind(force));
}

function sendHeartbeat() {
    jQuery.getJSON('/heartbeat', function(data) {
        setTimeout(function() {
            sendHeartbeat();
        }, 60000);
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
            logger.error('Unkown user logged in... ' + JSON.parse(data));
        }

        sendHeartbeat();

        if(!window.location.hostname.startsWith('localhost')){
            // Piwik Code - for now, replaces Google Analytics
            global._paq = global._paq || [];
            /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
            global._paq.push(['setUserId', USER.email]);
            global._paq.push(['trackPageView']);
            global._paq.push(['enableLinkTracking']);
            (function() {
                var u = '//insight.newslabs.co/';
                global._paq.push(['setTrackerUrl', u + 'piwik.php']);
                global._paq.push(['setSiteId', '2']);
                var d = document,
                    g = d.createElement('script'),
                    s = d.getElementsByTagName('script')[0];
                g.type = 'text/javascript';
                g.async = true;
                g.defer = true;
                g.src = u + 'piwik.js';
                s.parentNode.insertBefore(g, s);
            })();
            // End Piwik Code
        }
    });

    jQuery(document).on("click", "#messagesLink", function(){
        checkMessages(0, true);
    });

}
