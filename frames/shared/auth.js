// Sign-in for the widget frames: the public OIDC client `nanatri-widget` (authorization code +
// PKCE, no refresh token). The member signs in on the Nanatri auth host in a popup; a member
// already signed in there is recognised and the popup closes by itself.
//
// The access token lives only in the memory of our own frames. Frames of this origin on the same
// shop page share it over a BroadcastChannel, which the shop's page cannot join (different
// origin), so one sign-in covers every button on the page. Never put the token in storage, a URL,
// or a message to the parent page.
(function () {
  "use strict";

  var cfg = window.__NANATRI_CONFIG;
  var CHANNEL_NAME = "nanatri-widget-auth";
  // Treat the token as expired a little early, so a request never leaves with a dying token.
  var EXPIRY_SKEW_MS = 30 * 1000;
  // The popup gets this long to report back before the attempt counts as abandoned.
  var POPUP_TIMEOUT_MS = 2 * 60 * 1000;
  // In-app browsers (Instagram, Facebook, LINE, TikTok) open popups with no window.opener, so the
  // code could never come back: they use redirect mode instead. Keep the list here, in one place.
  var IN_APP_BROWSER_PATTERN = /FBAN|FBAV|Instagram|Line\/|musical_ly|BytedanceWebview/i;

  var session = null;      // { accessToken, expiresAt, userId }
  var pending = null;      // this frame's sign-in in progress: { popup, state, nonce, verifier, ... }
  var listeners = { session: [], ended: [] };
  var channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(CHANNEL_NAME) : null;

  function emit(type, payload) {
    listeners[type].forEach(function (cb) { cb(payload); });
  }

  function hasValidSession() {
    return Boolean(session && session.expiresAt - EXPIRY_SKEW_MS > Date.now());
  }

  function setSession(next, broadcast) {
    session = next;
    if (broadcast && channel) channel.postMessage({ type: "session", session: next });
    emit("session", next);
  }

  // ── Channel between our own frames ─────────────────────────────────────────

  if (channel) {
    channel.onmessage = function (event) {
      var msg = event.data || {};
      if (msg.type === "query") {
        if (hasValidSession()) channel.postMessage({ type: "session", session: session });
        else if (pending) channel.postMessage({ type: "pending" });
      } else if (msg.type === "session" && msg.session) {
        session = msg.session;
        emit("session", session);
      } else if (msg.type === "ended") {
        emit("ended", msg.outcome);
      } else if (msg.type === "cleared") {
        session = null;
      }
    };
  }

  // ── PKCE helpers ───────────────────────────────────────────────────────────

  function randomString(bytes) {
    var buf = new Uint8Array(bytes);
    crypto.getRandomValues(buf);
    return base64Url(buf);
  }

  function base64Url(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function sha256Base64Url(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (digest) {
      return base64Url(new Uint8Array(digest));
    });
  }

  function decodeJwtPayload(jwt) {
    var part = (jwt || "").split(".")[1] || "";
    var json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────

  function endSignIn(outcome) {
    if (!pending) return;
    clearInterval(pending.closedPoll);
    clearTimeout(pending.timeout);
    pending = null;
    if (channel) channel.postMessage({ type: "ended", outcome: outcome });
    emit("ended", outcome);
  }

  function exchangeCode(code) {
    var p = pending;
    var body = new URLSearchParams({
      grant_type:    "authorization_code",
      code:          code,
      redirect_uri:  cfg.redirectUri,
      client_id:     cfg.clientId,
      code_verifier: p.verifier,
    });
    return fetch(cfg.authUrl + "/connect/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body,
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok || !data.access_token) throw new Error(data.error || "token_exchange_failed");
          var claims = decodeJwtPayload(data.id_token);
          if (claims.nonce !== p.nonce) throw new Error("nonce_mismatch");
          return {
            accessToken: data.access_token,
            expiresAt:   Date.now() + (data.expires_in || 0) * 1000,
            userId:      claims.sub,
          };
        });
      });
  }

  function onPopupMessage(event) {
    if (!pending || event.origin !== location.origin || event.source !== pending.popup) return;
    var msg = event.data || {};
    if (msg.type !== "nanatri:auth") return;
    if (msg.state !== pending.state) return;

    clearInterval(pending.closedPoll);
    if (msg.error) {
      endSignIn(msg.error === "access_denied" ? "cancelled" : "error");
      return;
    }
    exchangeCode(msg.code).then(
      function (next) {
        setSession(next, true);
        parent.postMessage({ type: "USER_SIGNED_IN", version: "1", userId: next.userId }, "*");
        endSignIn("signed-in");
      },
      function () { endSignIn("error"); }
    );
  }

  window.addEventListener("message", onPopupMessage);

  // Centred over the browser window; left to itself the browser places popups at an edge.
  // screenX/outerWidth describe the browser window even from inside an iframe.
  function centeredPopupFeatures(width, height) {
    var left = Math.round(window.screenX + Math.max(0, (window.outerWidth - width) / 2));
    var top  = Math.round(window.screenY + Math.max(0, (window.outerHeight - height) / 2));
    return "popup,width=" + width + ",height=" + height + ",left=" + left + ",top=" + top;
  }

  // Must be called synchronously inside a click handler, or the browser blocks the popup.
  // Returns false when the popup could not be opened (then use redirect mode).
  function startSignIn(options) {
    var prompt = options && options.prompt;
    var popup = window.open("", "nanatri-auth", centeredPopupFeatures(420, 640));
    if (!popup) return false;

    var state = randomString(32);
    var nonce = randomString(32);
    var verifier = randomString(48);

    if (pending) clearInterval(pending.closedPoll);
    pending = { popup: popup, state: state, nonce: nonce, verifier: verifier };
    if (channel) channel.postMessage({ type: "pending" });

    sha256Base64Url(verifier).then(function (challenge) {
      var params = new URLSearchParams({
        client_id:             cfg.clientId,
        response_type:         "code",
        redirect_uri:          cfg.redirectUri,
        scope:                 "openid nanatri.api",
        state:                 state,
        nonce:                 nonce,
        code_challenge:        challenge,
        code_challenge_method: "S256",
      });
      if (options && options.merchantSlug) params.set("merchant", options.merchantSlug);
      if (options && options.lang)         params.set("ui_locales", options.lang);
      if (prompt)                          params.set("prompt", prompt);
      popup.location.href = cfg.authUrl + "/connect/authorize?" + params.toString();
    });

    // Closing the popup without finishing counts as cancelling.
    pending.closedPoll = setInterval(function () {
      if (pending && pending.popup.closed) endSignIn("cancelled");
    }, 500);
    pending.timeout = setTimeout(function () { endSignIn("cancelled"); }, POPUP_TIMEOUT_MS);
    return true;
  }

  // ── Redirect mode ──────────────────────────────────────────────────────────

  function isInAppBrowser() {
    return IN_APP_BROWSER_PATTERN.test(navigator.userAgent || "");
  }

  // Navigates the shop's tab to the dashboard's /add page, which signs in and adds the item.
  // Must run inside a click handler (top navigation needs user activation).
  function redirectToAdd(merchantSlug, itemId) {
    var params = new URLSearchParams({ merchant: merchantSlug || "", item: itemId || "" });
    window.top.location.href = cfg.dashboardUrl + "/add?" + params.toString();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  window.NanatriAuth = {
    getSession: function () { return hasValidSession() ? session : null; },

    // Asks the other frames on this page. Resolves "session", "pending" or "none".
    query: function (timeoutMs) {
      if (hasValidSession()) return Promise.resolve("session");
      if (pending) return Promise.resolve("pending");
      if (!channel) return Promise.resolve("none");
      return new Promise(function (resolve) {
        var done = false;
        function finish(result) {
          if (done) return;
          done = true;
          channel.removeEventListener("message", onReply);
          resolve(result);
        }
        function onReply(event) {
          var msg = event.data || {};
          if (msg.type === "session" && msg.session) finish("session");
          else if (msg.type === "pending") finish("pending");
        }
        channel.addEventListener("message", onReply);
        channel.postMessage({ type: "query" });
        setTimeout(function () { finish("none"); }, timeoutMs || 300);
      });
    },

    onSession: function (cb) { listeners.session.push(cb); },
    // outcome: "signed-in", "cancelled" or "error"
    onSignInEnded: function (cb) { listeners.ended.push(cb); },

    // For a 401 from the API or "Not you?": forget the token in every frame on this page.
    clear: function () {
      session = null;
      if (channel) channel.postMessage({ type: "cleared" });
    },

    startSignIn:    startSignIn,
    isInAppBrowser: isInAppBrowser,
    redirectToAdd:  redirectToAdd,

    // The click handler of the button frames. onReady runs when the modal should open: right
    // away when already signed in, or once this click's popup sign-in succeeds — so the modal
    // never shows next to the popup. Nothing opens if the member closes the popup.
    // options: { merchantSlug, itemId, lang }
    handleClick: function (options, onReady) {
      if (hasValidSession()) {
        onReady();
        return;
      }
      if (isInAppBrowser() || !startSignIn(options)) {
        redirectToAdd(options.merchantSlug, options.itemId);
        return;
      }
      var started = pending;
      listeners.ended.push(function onEnded(outcome) {
        // Only the outcome of the sign-in this click started.
        if (pending === started) return;
        listeners.ended.splice(listeners.ended.indexOf(onEnded), 1);
        if (outcome === "signed-in") onReady();
      });
    },
  };
})();
