var supportedBrowser = true;
var browserWarning = false;
var userAgent = navigator.userAgent;
if (userAgent.indexOf('Chrome') === -1) {
  supportedBrowser = false;
} else {
  var version = +userAgent.split('Chrome/')[1].split('.')[0];
  if (version < 46) browserWarning = true;
  if (version < 44) supportedBrowser = false
}
if (!supportedBrowser) {
  window.location.replace("/unsupported.html");
}
if (browserWarning) {
  window.onload = function () { 
    document.getElementById("browserWarning").classList.remove('hidden');
  }
}