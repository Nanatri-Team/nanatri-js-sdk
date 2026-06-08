(function () {
  "use strict";

  var SDK_ORIGIN = "https://your-sdk.com";
  var API_ENDPOINT = SDK_ORIGIN + "/api/v1/charge";

  // ── State ──────────────────────────────────────────────────────────────────

  var state = {
    apiKey: "",
    amount: "",
    currency: "USD",
    color: "#1a1a2e",
    textColor: "#ffffff",
    initialized: false,
  };

  // ── DOM refs ───────────────────────────────────────────────────────────────

  var form = document.getElementById("payment-form");
  var amountDisplay = document.getElementById("amount-display");
  var cardNumberInput = document.getElementById("card-number");
  var expiryInput = document.getElementById("expiry");
  var cvvInput = document.getElementById("cvv");
  var nameInput = document.getElementById("cardholder-name");
  var submitBtn = document.getElementById("submit-btn");
  var submitLabel = document.getElementById("submit-label");
  var globalError = document.getElementById("global-error");

  // ── Inbound messages ───────────────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    if (event.origin !== SDK_ORIGIN) return;
    var msg = event.data;
    if (!msg || typeof msg.version !== "string") return;

    if (msg.type === "INIT") {
      state.apiKey = msg.apiKey || "";
      state.amount = msg.amount || "";
      state.currency = msg.currency || "USD";
      state.color = msg.color || "#1a1a2e";
      state.textColor = msg.textColor || "#ffffff";
      state.initialized = true;
      applyTheme();
      renderAmount();
    }

    if (msg.type === "SET_LOADING") {
      setLoading(Boolean(msg.loading));
    }
  });

  // ── Theme ──────────────────────────────────────────────────────────────────

  function applyTheme() {
    document.documentElement.style.setProperty("--accent", state.color);
    document.documentElement.style.setProperty("--accent-text", state.textColor);
    submitBtn.style.backgroundColor = state.color;
    submitBtn.style.color = state.textColor;
  }

  function renderAmount() {
    if (!state.amount) return;
    var formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: state.currency,
    }).format(parseFloat(state.amount));
    amountDisplay.querySelector(".value").textContent = formatted;
    submitLabel.textContent = "Pay " + formatted;
  }

  // ── Input formatting ───────────────────────────────────────────────────────

  cardNumberInput.addEventListener("input", function () {
    var digits = this.value.replace(/\D/g, "").slice(0, 16);
    this.value = digits.replace(/(.{4})/g, "$1 ").trim();
    clearFieldError(this);
  });

  expiryInput.addEventListener("input", function () {
    var digits = this.value.replace(/\D/g, "").slice(0, 4);
    this.value = digits.length > 2 ? digits.slice(0, 2) + "/" + digits.slice(2) : digits;
    clearFieldError(this);
  });

  cvvInput.addEventListener("input", function () {
    this.value = this.value.replace(/\D/g, "").slice(0, 4);
    clearFieldError(this);
  });

  nameInput.addEventListener("input", function () {
    clearFieldError(this);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate() {
    var valid = true;

    var rawCard = cardNumberInput.value.replace(/\s/g, "");
    if (!luhn(rawCard) || rawCard.length < 13) {
      setFieldError(cardNumberInput, "Invalid card number.");
      valid = false;
    }

    var expiryParts = expiryInput.value.split("/");
    var expMonth = parseInt(expiryParts[0], 10);
    var expYear = 2000 + parseInt(expiryParts[1] || "0", 10);
    var now = new Date();
    if (
      isNaN(expMonth) || expMonth < 1 || expMonth > 12 ||
      isNaN(expYear) ||
      new Date(expYear, expMonth - 1) < new Date(now.getFullYear(), now.getMonth())
    ) {
      setFieldError(expiryInput, "Invalid or expired date.");
      valid = false;
    }

    if (cvvInput.value.length < 3) {
      setFieldError(cvvInput, "CVV must be 3–4 digits.");
      valid = false;
    }

    if (nameInput.value.trim().length < 2) {
      setFieldError(nameInput, "Enter the cardholder name.");
      valid = false;
    }

    return valid;
  }

  function luhn(num) {
    var sum = 0;
    var alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = parseInt(num[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0 && sum > 0;
  }

  function setFieldError(input, message) {
    var group = input.closest(".form-group");
    if (!group) return;
    group.classList.add("has-error");
    var errEl = group.querySelector(".field-error");
    if (errEl) errEl.textContent = message;
  }

  function clearFieldError(input) {
    var group = input.closest(".form-group");
    if (group) group.classList.remove("has-error");
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("loading", loading);
    [cardNumberInput, expiryInput, cvvInput, nameInput].forEach(function (el) {
      el.disabled = loading;
    });
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    globalError.classList.remove("visible");

    if (!validate()) return;
    if (!state.initialized) {
      showGlobalError("Payment session not initialized. Please try again.");
      return;
    }

    setLoading(true);
    parent.postMessage({ type: "SET_LOADING", version: "1", loading: true }, SDK_ORIGIN);

    // Card data is POSTed directly to our API — it never travels through postMessage.
    fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": state.apiKey,
      },
      body: JSON.stringify({
        amount: state.amount,
        currency: state.currency,
        // In production, tokenize card data server-side; never log or store raw PAN.
        card: {
          number: cardNumberInput.value.replace(/\s/g, ""),
          expMonth: expiryInput.value.split("/")[0],
          expYear: "20" + (expiryInput.value.split("/")[1] || ""),
          cvv: cvvInput.value,
          name: nameInput.value.trim(),
        },
      }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { ok: res.ok, body: body };
        });
      })
      .then(function (result) {
        if (result.ok) {
          parent.postMessage(
            {
              type: "PAYMENT_SUCCESS",
              version: "1",
              amount: state.amount,
              currency: state.currency,
              transactionId: result.body.transactionId || "",
            },
            SDK_ORIGIN
          );
        } else {
          var err = result.body.error || "Payment failed.";
          var code = result.body.code || "UNKNOWN";
          showGlobalError(err);
          parent.postMessage(
            { type: "PAYMENT_ERROR", version: "1", error: err, code: code },
            SDK_ORIGIN
          );
          setLoading(false);
        }
      })
      .catch(function (err) {
        var message = "Network error. Please check your connection.";
        showGlobalError(message);
        parent.postMessage(
          { type: "PAYMENT_ERROR", version: "1", error: message, code: "NETWORK_ERROR" },
          SDK_ORIGIN
        );
        setLoading(false);
      });
  });

  // ── Close button ───────────────────────────────────────────────────────────

  document.getElementById("close-btn").addEventListener("click", function () {
    parent.postMessage({ type: "CLOSE_MODAL", version: "1" }, SDK_ORIGIN);
  });

  function showGlobalError(msg) {
    globalError.textContent = msg;
    globalError.classList.add("visible");
  }
})();
