(function () {
  "use strict";

  var slider       = document.getElementById("slider");
  var phoneInput   = document.getElementById("phone-input");
  var phoneSubmit  = document.getElementById("phone-submit");
  var errPhone     = document.getElementById("err-phone");
  var phoneDisplay = document.getElementById("phone-display");
  var backBtn      = document.getElementById("back-btn");
  var otpBoxes     = Array.from(document.querySelectorAll(".otp-box"));
  var otpSubmit    = document.getElementById("otp-submit");
  var closeBtn     = document.getElementById("close-btn");
  var langBtns     = document.querySelectorAll(".lang-btn");

  var phone = "";

  // ── Language ────────────────────────────────────────────────────────────────

  langBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      langBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
  });

  // ── Phone screen ────────────────────────────────────────────────────────────

  function isValidPhone(val) {
    return val.replace(/[\s\-()]/g, "").length >= 6;
  }

  phoneSubmit.addEventListener("click", function () {
    phone = phoneInput.value.trim();
    if (!isValidPhone(phone)) {
      errPhone.textContent = "Please enter a valid phone number";
      errPhone.classList.add("visible");
      phoneInput.focus();
      return;
    }
    errPhone.classList.remove("visible");
    phoneDisplay.textContent = phone;
    slider.classList.add("at-otp");
    setTimeout(function () { otpBoxes[0].focus(); }, 360);
  });

  phoneInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") phoneSubmit.click();
  });

  phoneInput.addEventListener("input", function () {
    if (errPhone.classList.contains("visible") && isValidPhone(phoneInput.value.trim())) {
      errPhone.classList.remove("visible");
    }
  });

  // ── OTP screen ──────────────────────────────────────────────────────────────

  backBtn.addEventListener("click", function () {
    slider.classList.remove("at-otp");
    otpBoxes.forEach(function (b) { b.value = ""; b.classList.remove("filled"); });
    setTimeout(function () { phoneInput.focus(); }, 360);
  });

  otpBoxes.forEach(function (box, i) {
    box.addEventListener("input", function () {
      var digit = box.value.replace(/\D/g, "");
      box.value = digit.slice(-1);
      box.classList.toggle("filled", box.value !== "");
      if (box.value && i < otpBoxes.length - 1) {
        otpBoxes[i + 1].focus();
      }
    });

    box.addEventListener("keydown", function (e) {
      if (e.key === "Backspace" && !box.value && i > 0) {
        otpBoxes[i - 1].value = "";
        otpBoxes[i - 1].classList.remove("filled");
        otpBoxes[i - 1].focus();
      }
      if (e.key === "Enter") otpSubmit.click();
    });

    box.addEventListener("paste", function (e) {
      e.preventDefault();
      var pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      pasted.slice(0, otpBoxes.length).split("").forEach(function (ch, j) {
        if (otpBoxes[i + j]) {
          otpBoxes[i + j].value = ch;
          otpBoxes[i + j].classList.add("filled");
        }
      });
      var next = Math.min(i + pasted.length, otpBoxes.length - 1);
      otpBoxes[next].focus();
    });
  });

  otpSubmit.addEventListener("click", function () {
    var code = otpBoxes.map(function (b) { return b.value; }).join("");
    if (code.length < otpBoxes.length) {
      otpBoxes[code.length] && otpBoxes[code.length].focus();
      return;
    }
    window.open("https://www.youtube.com", "_blank");
    parent.postMessage({ type: "PRODUCT_ADDED", version: "1", userId: phone }, "*");
  });

  // ── Close ────────────────────────────────────────────────────────────────────

  closeBtn.addEventListener("click", function () {
    parent.postMessage({ type: "MODAL_CLOSED", version: "1" }, "*");
  });

  // ── Inbound messages ─────────────────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || typeof msg.version !== "string") return;
    if (msg.type === "INIT") {
      phoneInput.focus();
    }
  });

  phoneInput.focus();

})();
