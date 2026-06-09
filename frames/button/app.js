(function () {
  "use strict";

  var params    = new URLSearchParams(location.search);
  var lang      = params.get("lang")      || "en";
  var color     = params.get("color")     || "#5956E9";
  var textColor = params.get("textColor") || "#ffffff";

  var btn     = document.getElementById("pay-btn");
  var labelEl = document.getElementById("label-text");

  // ── Resolve label from locale or explicit param ────────────────────────────

  function getLabel() {
    var explicit = params.get("label");
    if (explicit) return explicit;
    var t = window.__i18n && window.__i18n[lang];
    return t ? t.addToWishlist : "Add to wishlist";
  }

  function getProcessingText() {
    var t = window.__i18n && window.__i18n[lang];
    return t ? t.processing : "Processing…";
  }

  // ── Apply styles ───────────────────────────────────────────────────────────

  btn.style.backgroundColor = color;
  btn.style.color            = textColor;

  var label = getLabel();
  btn.setAttribute("aria-label", label);
  labelEl.textContent = label;

  // ── Events ─────────────────────────────────────────────────────────────────

  btn.addEventListener("click", function () {
    parent.postMessage({ type: "BUTTON_CLICKED", version: "1" }, "*");
  });

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || typeof msg.version !== "string") return;

    if (msg.type === "SET_LOADING") {
      btn.disabled        = Boolean(msg.loading);
      labelEl.textContent = msg.loading ? getProcessingText() : label;
    }
  });

})();
