var logger = require('./slack');

global.USER = { name: 'Unknown', email: null, config: null };

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
            var delay = window.location.pathname.split("/")[1] == 'ag' ? 3000 : 50;
            jQuery(function () {
                setTimeout(() => {
                    displayMessages(data.messages);
                }, delay);
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

module.exports.init = function(cb) {
    jQuery.getJSON('/whoami', function(data) {
        if (data.email) {
            USER.name = data.name;
            USER.email = data.email;
            USER.config = data.config;
            //jQuery("#recent-filter option[value='user']").text('jonty.usborne@bbc.co.uk');
            logger.info(USER.name + ' logged in.\n`' + navigator.userAgent + '`');
            checkMessages(data.lastLogin);
        } else {
            logger.error('Unkown user logged in... ' + JSON.parse(data));
        }

        sendHeartbeat();
        if (cb) return cb(null);

    });

    jQuery(document).on("click", "#messagesLink", function(){
        checkMessages(0, true);
    });

}
