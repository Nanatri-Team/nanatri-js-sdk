// Hands the authorization code to the widget iframe that opened this popup, then closes. The
// iframe checks the origin and the state; only it knows the PKCE verifier.
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  if (window.opener) {
    window.opener.postMessage({
      type:  "nanatri:auth",
      code:  params.get("code"),
      state: params.get("state"),
      error: params.get("error"),
    }, location.origin);
  }
  window.close();
})();
