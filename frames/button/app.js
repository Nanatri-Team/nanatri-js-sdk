(function () {
  "use strict";

  var params    = new URLSearchParams(location.search);
  var lang      = params.get("lang")      || "en";
  var color     = params.get("color");
  var textColor = params.get("textColor");

  var btn     = document.getElementById("pay-btn");
  var labelEl = document.getElementById("label-text");

  // ── Resolve label from locale or explicit param ────────────────────────────

  // The visible text is the brand name in every language; the accessible name says what it does.
  function getLabel() {
    return params.get("label") || "Nanatri";
  }

  function getAccessibleLabel() {
    var t = window.__i18n && window.__i18n[lang];
    return params.get("label") || (t && t.addToWishlist) || "Nanatri";
  }

  function getProcessingText() {
    var t = window.__i18n && window.__i18n[lang];
    return t ? t.processing : "Processing…";
  }

  // ── Apply styles ───────────────────────────────────────────────────────────

  // Optional overrides from the shop; without them the stylesheet's Nanatri design applies.
  if (color) {
    btn.style.backgroundColor = color;
    btn.style.borderColor     = color;
  }
  if (textColor) btn.style.color = textColor;

  var label = getLabel();
  btn.setAttribute("aria-label", getAccessibleLabel());
  labelEl.textContent = label;

  // ── Events ─────────────────────────────────────────────────────────────────

  btn.addEventListener("click", function () {
    window.NanatriAuth.handleClick({
      merchantSlug: params.get("merchantSlug") || "",
      itemId:       params.get("itemId") || "",
      lang:         lang,
    }, function () {
      parent.postMessage({ type: "BUTTON_CLICKED", version: "1" }, "*");
    });
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
