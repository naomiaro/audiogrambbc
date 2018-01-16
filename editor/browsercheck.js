var supportedBrowser = true;
var userAgent = navigator.userAgent;
console.log(userAgent);
if (userAgent.indexOf('Chrome') === -1) {
  supportedBrowser = false;
} else {
  var version = +userAgent.split('Chrome/')[1].split('.')[0];
  if (version < 46) supportedBrowser = false;
}

if (!supportedBrowser) {
  window.location.replace("/unsupported.html");
}