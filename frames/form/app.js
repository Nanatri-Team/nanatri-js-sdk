import { all as allCountries } from "country-codes-list";

// ── Countries ─────────────────────────────────────────────────────────────
const COUNTRIES = allCountries()
  .filter((c) => c.countryCallingCode)
  .map((c) => ({
    code: c.countryCode,
    dial: "+" + c.countryCallingCode,
    name: c.countryNameEn,
    flag: c.flag,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// ── Config: URL params first (dev), overridden by INIT message ───────────
const urlParams   = new URLSearchParams(window.location.search);
let currentLang   = urlParams.get("lang")         || "en";
let apiBaseUrl    = urlParams.get("apiBaseUrl")   || "";
let merchantSlug  = urlParams.get("merchantSlug") || "";
let itemId        = urlParams.get("itemId")       || "";
let dashboardUrl  = urlParams.get("dashboardUrl") || "";
// Product display info for the success screen — sourced from the merchant's own product
// page (it's already rendering this exact data next to the "Add to wishlist" button), not
// fetched from the backend: the item snapshot isn't guaranteed to exist synchronously yet
// (import/enrichment is async on the new-user OTP path).
let itemTitle     = urlParams.get("itemTitle")    || "";
let itemImage     = urlParams.get("itemImage")    || "";
let itemPrice     = urlParams.get("itemPrice")    || "";
let itemCurrency  = urlParams.get("itemCurrency") || "";

// ── State ─────────────────────────────────────────────────────────────────
let selectedCountry = COUNTRIES.find((c) => c.code === "GE") || COUNTRIES[0];
let phone           = "";
let resendInterval  = null;
let dropdownOpen    = false;

// ── DOM refs ──────────────────────────────────────────────────────────────
const slider          = document.getElementById("slider");
const countryBtn      = document.getElementById("country-btn");
const countryFlagEl   = document.getElementById("country-flag");
const countryDialEl   = document.getElementById("country-dial");
const countryDropdown = document.getElementById("country-dropdown");
const countrySearch   = document.getElementById("country-search");
const countryList     = document.getElementById("country-list");
const phoneField      = document.getElementById("phone-field");
const phoneNumberInput = document.getElementById("phone-number-input");
const phoneSubmit     = document.getElementById("phone-submit");
const errPhone        = document.getElementById("err-phone");
const phoneDisplay    = document.getElementById("phone-display");
const backBtn         = document.getElementById("back-btn");
const otpBoxes        = Array.from(document.querySelectorAll(".otp-box"));
const otpSubmit       = document.getElementById("otp-submit");
const errOtp          = document.getElementById("err-otp");
const resendBtn       = document.getElementById("resend-btn");
const closeBtn        = document.getElementById("close-btn");
const langBtns        = document.querySelectorAll(".lang-btn");
const loadingOverlay  = document.getElementById("loading-overlay");
const viewWishlistLink = document.getElementById("view-wishlist-link");
const itemPreview      = document.getElementById("item-preview");
const itemPreviewImage = document.getElementById("item-preview-image");
const itemPreviewTitle = document.getElementById("item-preview-title");
const itemPreviewPrice = document.getElementById("item-preview-price");
const recentItems      = document.getElementById("recent-items");
const recentItemsList  = document.getElementById("recent-items-list");

// ── i18n ──────────────────────────────────────────────────────────────────
function t(key) {
  const i18n = window.__i18n && window.__i18n[currentLang];
  return (i18n && i18n[key]) || "";
}

function applyLang() {
  document.getElementById("screen-title").textContent    = t("title");
  document.getElementById("screen-subtitle").textContent = t("subtitle");
  document.getElementById("phone-label").textContent     = t("phoneLabel");
  phoneNumberInput.placeholder                           = t("phonePlaceholder") || "599 000 000";
  phoneSubmit.textContent                                = t("continue");
  document.getElementById("or-text").textContent         = t("or");
  document.getElementById("google-label").textContent    = t("google");
  document.getElementById("facebook-label").textContent  = t("facebook");
  document.getElementById("otp-title").textContent       = t("otpTitle");
  document.getElementById("sent-to-text").textContent    = t("otpSentTo");
  otpSubmit.textContent                                  = t("verify");
  backBtn.textContent                                    = "← " + t("back");
  document.getElementById("success-title").textContent    = t("successTitle");
  document.getElementById("success-subtitle").textContent = t("successSubtitle");
  viewWishlistLink.textContent                           = t("viewWishlist");
  document.getElementById("recent-items-label").textContent = t("recentItems");

  langBtns.forEach((b) => {
    b.classList.toggle("active", b.getAttribute("data-lang") === currentLang);
  });
}

langBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentLang = btn.getAttribute("data-lang");
    applyLang();
  });
});

// ── Country selector ──────────────────────────────────────────────────────
function updateCountryBtn() {
  countryFlagEl.textContent = selectedCountry.flag;
  countryDialEl.textContent = selectedCountry.dial;
}

function renderCountryList(query) {
  const q = (query || "").trim().toLowerCase();
  const filtered = q
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.dial.includes(q) ||
          c.code.toLowerCase() === q
      )
    : COUNTRIES;

  countryList.innerHTML = "";
  filtered.forEach((country) => {
    const li = document.createElement("li");
    li.className = "country-item" + (country.code === selectedCountry.code ? " selected" : "");
    li.setAttribute("role", "option");
    li.setAttribute("aria-selected", country.code === selectedCountry.code ? "true" : "false");
    li.innerHTML =
      '<span class="country-item-flag">' + country.flag + "</span>" +
      '<span class="country-item-name">' + country.name + "</span>" +
      '<span class="country-item-dial">' + country.dial + "</span>";
    li.addEventListener("click", () => selectCountry(country));
    countryList.appendChild(li);
  });
}

function openDropdown() {
  dropdownOpen = true;
  countryDropdown.hidden = false;
  countryBtn.setAttribute("aria-expanded", "true");
  countrySearch.value = "";
  renderCountryList("");
  requestAnimationFrame(() => {
    countrySearch.focus();
    const sel = countryList.querySelector(".selected");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  });
}

function closeDropdown() {
  dropdownOpen = false;
  countryDropdown.hidden = true;
  countryBtn.setAttribute("aria-expanded", "false");
}

function selectCountry(country) {
  selectedCountry = country;
  updateCountryBtn();
  closeDropdown();
  phoneNumberInput.focus();
}

countryBtn.addEventListener("click", () => {
  dropdownOpen ? closeDropdown() : openDropdown();
});

countrySearch.addEventListener("input", () => {
  renderCountryList(countrySearch.value);
});

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  if (dropdownOpen && phoneField && !phoneField.contains(e.target)) {
    closeDropdown();
  }
});

// Keyboard navigation in dropdown
countrySearch.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeDropdown(); phoneNumberInput.focus(); }
  if (e.key === "Enter") {
    const first = countryList.querySelector(".country-item");
    if (first) first.click();
  }
});

// ── Phone assembly & validation ────────────────────────────────────────────
function getFullPhone() {
  const local = phoneNumberInput.value.replace(/[\s\-()]/g, "").replace(/^\+/, "");
  return selectedCountry.dial + local;
}

function isValidE164(val) {
  return /^\+[1-9]\d{6,14}$/.test(val);
}

// ── Loading states ─────────────────────────────────────────────────────────
function setPhoneLoading(loading) {
  phoneNumberInput.disabled = loading;
  countryBtn.disabled       = loading;
  phoneSubmit.disabled      = loading;
  phoneSubmit.textContent   = loading ? "..." : t("continue");
}

function setOtpLoading(loading) {
  otpBoxes.forEach((b) => { b.disabled = loading; });
  otpSubmit.disabled    = loading;
  resendBtn.disabled    = loading;
  otpSubmit.textContent = loading ? "..." : t("verify");
}

// ── Error helpers ─────────────────────────────────────────────────────────
function showPhoneError(msg) {
  errPhone.textContent = msg;
  errPhone.classList.add("visible");
}
function hidePhoneError() { errPhone.classList.remove("visible"); }

function showOtpError(msg) {
  errOtp.textContent = msg;
  errOtp.classList.add("visible");
}
function hideOtpError() { errOtp.classList.remove("visible"); }

// ── Resend countdown ──────────────────────────────────────────────────────
function startResendCountdown(seconds) {
  clearInterval(resendInterval);
  let remaining = seconds;
  resendBtn.disabled    = true;
  resendBtn.textContent = "Resend in " + remaining + "s";

  resendInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(resendInterval);
      resendBtn.disabled    = false;
      resendBtn.textContent = "Resend code";
    } else {
      resendBtn.textContent = "Resend in " + remaining + "s";
    }
  }, 1000);
}

// ── API ───────────────────────────────────────────────────────────────────
function apiPost(path, body) {
  return fetch(apiBaseUrl + path, {
    method:      "POST",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify(body),
    // Only takes effect once this widget is served from a nanatri.com subdomain (same-site
    // with the API) — a cross-site iframe never gets to set/send the refresh cookie regardless
    // of this flag. Harmless to send either way, and free forward-compatibility.
    credentials: "include",
  });
}

function extractErrorMessage(status, data, fallback) {
  if (status === 429) return "Too many attempts. Please wait and try again.";
  if (status === 423) return "This account is temporarily locked.";
  if (status === 503) return "SMS service unavailable. Please try again later.";
  if (status === 404) return "Merchant not found. Please check your integration.";
  if (status === 403) return "This merchant is currently unavailable.";
  if (data && data.detail)       return data.detail;
  if (data && data.description)  return data.description;
  return fallback;
}

async function sendOtp(phoneNumber) {
  const res  = await apiPost("/api/v1/auth/otp/send-sms", { phoneNumber, merchantSlug });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(res.status, data, "Failed to send code. Please try again."));
  return data;
}

async function verifyOtp(phoneNumber, code) {
  const res  = await apiPost("/api/v1/auth/otp/verify-sms", { phoneNumber, code, merchantSlug, itemId });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(extractErrorMessage(res.status, data, "Invalid or expired code. Please try again."));
  return data;
}

// ── Recently added (this merchant) ──────────────────────────────────────────
// Best-effort: a 404 (member has no wishlist with this merchant yet, or a race with the
// async item-import cascade on a brand-new item) just means nothing to show yet — never
// blocks or errors the success screen itself.
async function fetchRecentItems(accessToken) {
  try {
    const res = await fetch(apiBaseUrl + "/api/v1/wishlists/" + encodeURIComponent(merchantSlug), {
      headers: { "Authorization": "Bearer " + accessToken },
    });
    if (!res.ok) return [];
    const data = await res.json().catch(() => null);
    if (!data || !Array.isArray(data.items)) return [];
    return data.items
      .slice()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
  } catch {
    return [];
  }
}

function renderRecentItems(items) {
  recentItemsList.innerHTML = "";

  if (!items.length) {
    recentItems.hidden = true;
    return;
  }

  items.forEach((item) => {
    // A just-added item starts "pending_import" — the product snapshot and funding target
    // are filled in asynchronously by the backend's import worker, so there's no title/price
    // to show yet. Show a clear "still preparing" state instead of a raw product id and 0 GEL.
    const isPending = item.status === "pending_import" || !item.product;
    const isFailed  = item.status === "import_failed";

    const row = document.createElement("div");
    row.className = "recent-item-row";

    if (item.product && item.product.imageUrl) {
      const img = document.createElement("img");
      img.className = "recent-item-image";
      img.src = item.product.imageUrl;
      img.alt = "";
      row.appendChild(img);
    }

    const title = document.createElement("span");
    title.className = "recent-item-title";
    title.textContent = (item.product && item.product.title) || item.externalProductId;
    row.appendChild(title);

    const price = document.createElement("span");
    price.className = "recent-item-price";
    if (isFailed) {
      price.textContent = t("itemImportFailed");
    } else if (isPending) {
      price.textContent = t("itemImporting");
    } else if (item.funding && typeof item.funding.target === "number") {
      price.textContent = item.funding.target.toFixed(0) + " " + item.currency;
    }
    if (price.textContent) row.appendChild(price);

    recentItemsList.appendChild(row);
  });

  recentItems.hidden = false;
}

// ── Success screen ────────────────────────────────────────────────────────
function hideLoadingOverlay() {
  loadingOverlay.hidden = true;
}

function showSuccess(details) {
  if (dashboardUrl) {
    const hashParams = {
      access_token: details.accessToken,
      expires_at:   details.expiresAt,
    };
    // merchantSlug is known synchronously (from INIT/URL config), independent of the async
    // item-import cascade, so it's always safe to send. itemId is only known on the
    // silent-add path, where the backend already returned the created item — passing it
    // when we have it lands the dashboard on the exact item instead of just the shop page.
    if (merchantSlug)  hashParams.merchant_slug = merchantSlug;
    if (details.itemId) hashParams.item_id = details.itemId;
    const query = details.requiresProfileCompletion ? "?requires_profile_completion=true" : "";
    viewWishlistLink.href = dashboardUrl + "/" + query + "#" + new URLSearchParams(hashParams).toString();
    viewWishlistLink.style.display = "inline-flex";
  } else {
    viewWishlistLink.style.display = "none";
  }

  if (itemTitle || itemImage) {
    itemPreviewTitle.textContent = itemTitle;
    itemPreviewPrice.textContent = itemPrice ? itemPrice + (itemCurrency ? " " + itemCurrency : "") : "";
    itemPreviewImage.hidden = !itemImage;
    if (itemImage) {
      itemPreviewImage.src = itemImage;
      itemPreviewImage.alt = itemTitle;
    }
    itemPreview.hidden = false;
  } else {
    itemPreview.hidden = true;
  }

  hideLoadingOverlay();
  slider.classList.remove("at-otp");
  slider.classList.add("at-success");

  // The success screen can hold more (item preview, recently-added list) than the
  // phone/OTP screens ever need — ask the parent page to grow the iframe just for this.
  parent.postMessage({ type: "RESIZE_MODAL", version: "1", height: 600 }, "*");

  recentItems.hidden = true;
  if (details.accessToken) {
    fetchRecentItems(details.accessToken).then(renderRecentItems);
  }
}

// ── Phone submit ──────────────────────────────────────────────────────────
phoneSubmit.addEventListener("click", async () => {
  closeDropdown();
  const fullPhone = getFullPhone();

  if (!isValidE164(fullPhone)) {
    showPhoneError("Enter a valid phone number (e.g. 599 000 000)");
    phoneNumberInput.focus();
    return;
  }
  hidePhoneError();
  setPhoneLoading(true);

  try {
    await sendOtp(fullPhone);
    phone = fullPhone;
    phoneDisplay.textContent = phone;
    slider.classList.add("at-otp");
    startResendCountdown(30);
    setTimeout(() => { if (otpBoxes[0]) otpBoxes[0].focus(); }, 360);
  } catch (err) {
    showPhoneError(err.message);
  } finally {
    setPhoneLoading(false);
  }
});

phoneNumberInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") phoneSubmit.click();
});

phoneNumberInput.addEventListener("input", () => {
  if (errPhone.classList.contains("visible")) hidePhoneError();
});

// ── Back button ───────────────────────────────────────────────────────────
backBtn.addEventListener("click", () => {
  slider.classList.remove("at-otp");
  otpBoxes.forEach((b) => { b.value = ""; b.classList.remove("filled"); });
  clearInterval(resendInterval);
  hideOtpError();
  setTimeout(() => { phoneNumberInput.focus(); }, 360);
});

// ── Resend ────────────────────────────────────────────────────────────────
resendBtn.addEventListener("click", async () => {
  if (!phone) return;
  hideOtpError();
  resendBtn.disabled = true;

  try {
    await sendOtp(phone);
    otpBoxes.forEach((b) => { b.value = ""; b.classList.remove("filled"); });
    if (otpBoxes[0]) otpBoxes[0].focus();
    startResendCountdown(30);
  } catch (err) {
    showOtpError(err.message);
    resendBtn.disabled = false;
  }
});

// ── OTP boxes ─────────────────────────────────────────────────────────────
otpBoxes.forEach((box, i) => {
  box.addEventListener("input", () => {
    const digit = box.value.replace(/\D/g, "");
    box.value = digit.slice(-1);
    box.classList.toggle("filled", box.value !== "");
    hideOtpError();
    if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus();
  });

  box.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && !box.value && i > 0) {
      otpBoxes[i - 1].value = "";
      otpBoxes[i - 1].classList.remove("filled");
      otpBoxes[i - 1].focus();
    }
    if (e.key === "Enter") otpSubmit.click();
  });

  box.addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData?.getData("text") ?? "").replace(/\D/g, "");
    pasted.slice(0, otpBoxes.length).split("").forEach((ch, j) => {
      if (otpBoxes[i + j]) {
        otpBoxes[i + j].value = ch;
        otpBoxes[i + j].classList.add("filled");
      }
    });
    otpBoxes[Math.min(i + pasted.length, otpBoxes.length - 1)].focus();
  });
});

// ── OTP submit ────────────────────────────────────────────────────────────
otpSubmit.addEventListener("click", async () => {
  const code = otpBoxes.map((b) => b.value).join("");
  if (code.length < otpBoxes.length) {
    if (otpBoxes[code.length]) otpBoxes[code.length].focus();
    return;
  }
  hideOtpError();
  setOtpLoading(true);

  try {
    const result = await verifyOtp(phone, code);

    parent.postMessage({
      type:                    "USER_SIGNED_IN",
      version:                 "1",
      accessToken:             result.accessToken,
      expiresAt:               result.expiresAt,
      user:                    result.user,
      requiresProfileCompletion: result.requiresProfileCompletion ?? false,
    }, "*");

    // The item add itself is cascaded asynchronously on the backend from this
    // same OTP-verify call, so we don't have a wishlistId yet — but it's safe
    // to confirm optimistically.
    parent.postMessage({
      type:    "PRODUCT_ADDED",
      version: "1",
      userId:  result.user.id,
    }, "*");

    showSuccess({
      accessToken:  result.accessToken,
      expiresAt:    result.expiresAt,
      requiresProfileCompletion: result.requiresProfileCompletion || false,
    });
  } catch (err) {
    showOtpError(err.message);
    otpBoxes.forEach((b) => { b.value = ""; b.classList.remove("filled"); });
    if (otpBoxes[0]) otpBoxes[0].focus();
    setOtpLoading(false);
  }
});

// ── Close button ──────────────────────────────────────────────────────────
closeBtn.addEventListener("click", () => {
  parent.postMessage({ type: "MODAL_CLOSED", version: "1" }, "*");
});

// ── INIT message from parent ──────────────────────────────────────────────
// apiBaseUrl/merchantSlug/itemId/dashboardUrl read from the URL above are a
// dev-only fallback — the authoritative values arrive here, from component.ts,
// shortly after load.
let initHandled = false;

function handleInit(msg) {
  if (initHandled) return;
  initHandled = true;

  if (msg) {
    if (msg.lang)         currentLang  = msg.lang;
    if (msg.apiBaseUrl)   apiBaseUrl   = msg.apiBaseUrl;
    if (msg.merchantSlug) merchantSlug = msg.merchantSlug;
    if (msg.itemId)       itemId       = msg.itemId;
    if (msg.dashboardUrl) dashboardUrl = msg.dashboardUrl;
    if (msg.itemTitle)    itemTitle    = msg.itemTitle;
    if (msg.itemImage)    itemImage    = msg.itemImage;
    if (msg.itemPrice)    itemPrice    = msg.itemPrice;
    if (msg.itemCurrency) itemCurrency = msg.itemCurrency;
    applyLang();
  }

  hideLoadingOverlay();
  phoneNumberInput.focus();
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const msg = event.data;
  if (!msg || typeof msg.version !== "string") return;

  if (msg.type === "INIT") {
    handleInit(msg);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────
updateCountryBtn();
applyLang();
// Fallback for standalone/dev use where no parent ever sends INIT (proceeds
// with whatever the URL query string provided).
setTimeout(() => handleInit(null), 1500);
