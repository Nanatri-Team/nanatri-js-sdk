(function () {
  "use strict";

  var SDK_ORIGIN    = location.hostname === "localhost" ? "http://localhost:3000" : "https://your-sdk.com";
  var AUTH_ENDPOINT = SDK_ORIGIN + "/api/v1/auth/login";

  var I18N = window.__i18n;

  // ── State ──────────────────────────────────────────────────────────────────

  var lang = new URLSearchParams(location.search).get("lang") || "en";
  var pwVisible = false;

  // ── DOM refs ───────────────────────────────────────────────────────────────

  var form         = document.getElementById("auth-form");
  var emailInput   = document.getElementById("email");
  var passwordInput= document.getElementById("password");
  var submitBtn    = document.getElementById("submit-btn");
  var togglePwBtn  = document.getElementById("toggle-pw");
  var globalError  = document.getElementById("global-error");
  var langBtns     = document.querySelectorAll(".lang-btn");

  // ── Apply translations ─────────────────────────────────────────────────────

  function applyLang() {
    var t = I18N[lang];
    document.documentElement.lang = lang;

    document.getElementById("t-title").textContent       = t.title;
    document.getElementById("t-subtitle").textContent    = t.subtitle;
    document.getElementById("t-email-label").textContent = t.emailLabel;
    document.getElementById("t-password-label").textContent = t.passwordLabel;
    document.getElementById("t-submit").textContent      = t.submit;
    document.getElementById("t-or").textContent          = t.or;
    document.getElementById("t-google").textContent      = t.google;
    document.getElementById("t-facebook").textContent    = t.facebook;

    emailInput.placeholder    = t.emailPlaceholder;
    passwordInput.placeholder = t.passwordPlaceholder;

    togglePwBtn.setAttribute("aria-label", pwVisible ? t.hidePassword : t.showPassword);
    togglePwBtn.textContent = pwVisible ? "🙈" : "👁";

    langBtns.forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    // re-validate visible errors in new language
    if (document.getElementById("group-email").classList.contains("has-error")) {
      document.getElementById("err-email").textContent = getEmailError();
    }
    if (document.getElementById("group-password").classList.contains("has-error")) {
      document.getElementById("err-password").textContent = getPasswordError();
    }
  }

  // ── Language switcher ──────────────────────────────────────────────────────

  langBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      lang = btn.dataset.lang;
      applyLang();
    });
  });

  // ── Password toggle ────────────────────────────────────────────────────────

  togglePwBtn.addEventListener("click", function () {
    pwVisible = !pwVisible;
    passwordInput.type = pwVisible ? "text" : "password";
    applyLang();
  });

  // ── Validation helpers ─────────────────────────────────────────────────────

  function getEmailError() {
    var t = I18N[lang].errors;
    if (!emailInput.value.trim()) return t.emailRequired;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) return t.emailInvalid;
    return "";
  }

  function getPasswordError() {
    var t = I18N[lang].errors;
    if (!passwordInput.value) return t.passwordRequired;
    if (passwordInput.value.length < 6) return t.passwordShort;
    return "";
  }

  function setFieldError(groupId, errId, message) {
    var group = document.getElementById(groupId);
    var errEl = document.getElementById(errId);
    if (message) {
      group.classList.add("has-error");
      errEl.textContent = message;
    } else {
      group.classList.remove("has-error");
      errEl.textContent = "";
    }
  }

  function clearFieldError(groupId, errId) {
    setFieldError(groupId, errId, "");
  }

  // Live validation on blur
  emailInput.addEventListener("blur", function () {
    setFieldError("group-email", "err-email", getEmailError());
  });
  emailInput.addEventListener("input", function () {
    if (document.getElementById("group-email").classList.contains("has-error")) {
      setFieldError("group-email", "err-email", getEmailError());
    }
  });

  passwordInput.addEventListener("blur", function () {
    setFieldError("group-password", "err-password", getPasswordError());
  });
  passwordInput.addEventListener("input", function () {
    if (document.getElementById("group-password").classList.contains("has-error")) {
      setFieldError("group-password", "err-password", getPasswordError());
    }
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  function setLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.classList.toggle("loading", loading);
    document.getElementById("btn-google").disabled   = loading;
    document.getElementById("btn-facebook").disabled = loading;
    emailInput.disabled    = loading;
    passwordInput.disabled = loading;
  }

  function showGlobalError(msg) {
    globalError.textContent = msg;
    globalError.classList.add("visible");
  }

  function clearGlobalError() {
    globalError.classList.remove("visible");
  }

  // ── Form submit ────────────────────────────────────────────────────────────

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearGlobalError();

    var emailErr    = getEmailError();
    var passwordErr = getPasswordError();
    setFieldError("group-email",    "err-email",    emailErr);
    setFieldError("group-password", "err-password", passwordErr);

    if (emailErr || passwordErr) return;

    setLoading(true);

    fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email:    emailInput.value.trim(),
        password: passwordInput.value,
      }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        setLoading(false);
        if (result.ok) {
          parent.postMessage({
            type: "PAYMENT_SUCCESS",
            version: "1",
            amount: "",
            currency: "",
            transactionId: result.body.userId || result.body.token || result.body.transactionId || "",
          }, SDK_ORIGIN);
        } else {
          showGlobalError(result.body.message || I18N[lang].errors.authFailed);
          parent.postMessage({
            type: "PAYMENT_ERROR",
            version: "1",
            error: result.body.message || I18N[lang].errors.authFailed,
            code: result.body.code || "AUTH_FAILED",
          }, SDK_ORIGIN);
        }
      })
      .catch(function () {
        setLoading(false);
        showGlobalError(I18N[lang].errors.network);
        parent.postMessage({
          type: "PAYMENT_ERROR",
          version: "1",
          error: I18N[lang].errors.network,
          code: "NETWORK_ERROR",
        }, SDK_ORIGIN);
      });
  });

  // ── Social auth ────────────────────────────────────────────────────────────

  document.getElementById("btn-google").addEventListener("click", function () {
    window.open(SDK_ORIGIN + "/auth/google", "google-auth", "width=500,height=600");
  });

  document.getElementById("btn-facebook").addEventListener("click", function () {
    window.open(SDK_ORIGIN + "/auth/facebook", "facebook-auth", "width=500,height=600");
  });

  // ── Close button ───────────────────────────────────────────────────────────

  document.getElementById("close-btn").addEventListener("click", function () {
    parent.postMessage({ type: "CLOSE_MODAL", version: "1" }, SDK_ORIGIN);
  });

  // ── Inbound messages (INIT, SET_LOADING) ───────────────────────────────────

  window.addEventListener("message", function (event) {
    if (event.origin !== SDK_ORIGIN) return;
    var msg = event.data;
    if (!msg || typeof msg.version !== "string") return;
    if (msg.type === "SET_LOADING") setLoading(Boolean(msg.loading));
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  applyLang();

})();
