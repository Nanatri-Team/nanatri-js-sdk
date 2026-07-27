(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var lang   = params.get("lang")  || "en";
  var color  = params.get("color");

  var btn  = document.getElementById("heart-btn");
  var icon = document.getElementById("heart-icon");

  if (color) icon.style.color = color;

  function getLabel() {
    var t = window.__i18n && window.__i18n[lang];
    return (t && t.addToWishlist) || "Add to wishlist";
  }

  btn.setAttribute("aria-label", getLabel());

  // ── Events ─────────────────────────────────────────────────────────────────

  btn.addEventListener("click", function () {
    if (btn.disabled) return;
    parent.postMessage({ type: "BUTTON_CLICKED", version: "1" }, "*");
  });

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || typeof msg.version !== "string") return;

    if (msg.type === "SET_LOADING") {
      btn.disabled = Boolean(msg.loading);
    }

    if (msg.type === "SET_ADDED") {
      var added = Boolean(msg.added);
      btn.classList.toggle("is-added", added);
      btn.setAttribute("aria-pressed", String(added));
    }
  });

})();
