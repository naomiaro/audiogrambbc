var request = require('request');

  function isAdmin (email, cb) {
    var adminGroup = "CN=BBC News Labs Team,OU=B,OU=Distribution Groups,OU=Users and Desktops,OU=London,OU=MTS,DC=national,DC=core,DC=bbc,DC=co,DC=uk";
    if (email == "localhost@audiogram.newslabs.co") {
      return cb(null, true);
    }
    var url = `http://apis.labs.jupiter.bbc.co.uk/whois/${email}`;
    request({url, proxy: null }, function(err, adRes, adBody) {
      if (err) return cb(err, null);
      try {
        var userData = JSON.parse(adBody);
        var isAdmin = userData.retval.groups ? userData.retval.groups.includes(adminGroup) : false;
      } catch {
        var isAdmin = false;
      }
      cb(err, isAdmin);
    });
  }

  // function isWhitelisted (emailAddress) {
  //   return WHITELIST.some(function(e) {
  //     var re = new RegExp(e,"i");
  //     return emailAddress.match(re)}
  //   );
  // }

  // return function middleware (req, res, next) {

  //   if (req.url.startsWith("/whitelist")) {
  //     // Edit whitelist
  //     // if (req.header('BBC_IDOK') === 'SUCCESS' && isAdmin(req.header('BBC_EMAIL'))) {
  //     if (req.header('BBC_IDOK') && isAdmin(req.header('BBC_EMAIL'))) {
  //       delete require.cache[require.resolve('../whitelist.json')];
  //       WHITELIST = require('../whitelist.json');
  //       return next();
  //     } else {
  //       return res.status(401).send('HTTP/1.1 401 Unauthorized');
  //     }
  //   }

  //   // Do not proceed to the next code-block (white-list checking) as that feature is now deprecated.
  //   return next();
    
  //   var reg = new RegExp("^/(css|fonts|images|favicon|simulcast|whoami)", "i"); // Don't block these requests
  //   // if (reg.test(req.url) || (req.header('BBC_IDOK') === 'SUCCESS' && isWhitelisted(req.header('BBC_EMAIL')))) {
  //   if (reg.test(req.url) || (req.header('BBC_EMAIL') && isWhitelisted(req.header('BBC_EMAIL')))) {
  //     return next();
  //   } else {
  //     var path = require("path"),
  //         errPage = path.join(__dirname, "..", "401.html");
  //     return res.status(401).sendFile(errPage);
  //   }

  // }

module.exports = {
  isAdmin
};