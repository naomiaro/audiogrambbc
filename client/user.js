const logger = require('./slack');

global.USER = { name: 'Unknown', email: null };

jQuery.getJSON('/whoami', function(data) {
    if (data.email) {
        USER.name = data.name;
        USER.email = data.email;
        jQuery("#recent-filter option[value='user']").text(data.name);
        logger.info(USER.name + ' logged in.\n`' + navigator.userAgent + '`');
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
