// The widget's modal. Sign-in itself happens in a popup on the Nanatri auth host, started by the
// button frame's click (frames/shared/auth.js); this frame waits for it, adds the item with the
// access token, and shows the result.

// ── Config ────────────────────────────────────────────────────────────────
// Where member data is sent is fixed at build time (.env / .env.production). Never read it from
// the URL or the INIT message: both come from the merchant's page.
const apiBaseUrl   = __API_BASE_URL__;
const dashboardUrl = __DASHBOARD_URL__;

const auth = window.NanatriAuth;

// URL params first (dev), overridden by INIT message
const urlParams   = new URLSearchParams(window.location.search);
let currentLang   = urlParams.get("lang")         || "en";
let merchantSlug  = urlParams.get("merchantSlug") || "";
let itemId        = urlParams.get("itemId")       || "";
// Product display info for the success screen, sourced from the merchant's own product page
// rather than fetched: the backend imports the product snapshot asynchronously.
let itemTitle     = urlParams.get("itemTitle")    || "";
let itemImage     = urlParams.get("itemImage")    || "";
let itemPrice     = urlParams.get("itemPrice")    || "";
let itemCurrency  = urlParams.get("itemCurrency") || "";

// ── State ─────────────────────────────────────────────────────────────────
let adding = false;
let added  = false;

// ── DOM refs ──────────────────────────────────────────────────────────────
const slider           = document.getElementById("slider");
const authWaiting      = document.getElementById("auth-waiting");
const errAuth          = document.getElementById("err-auth");
const signInBtn        = document.getElementById("sign-in-btn");
const notYouBtn        = document.getElementById("not-you-btn");
const closeBtn         = document.getElementById("close-btn");
const langBtns         = document.querySelectorAll(".lang-btn");
const loadingOverlay   = document.getElementById("loading-overlay");
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
  document.getElementById("auth-title").textContent        = t("signInTitle");
  document.getElementById("auth-subtitle").textContent     = t("signInSubtitle");
  document.getElementById("auth-waiting-text").textContent = t("signInWaiting");
  signInBtn.textContent                                    = t("signInContinue");
  notYouBtn.textContent                                    = t("notYou");
  document.getElementById("success-title").textContent     = t("successTitle");
  document.getElementById("success-subtitle").textContent  = t("successSubtitle");
  viewWishlistLink.textContent                             = t("viewWishlist");
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

// ── Sign-in screen states ─────────────────────────────────────────────────
function hideLoadingOverlay() {
  loadingOverlay.hidden = true;
}

function showWaiting() {
  hideLoadingOverlay();
  errAuth.classList.remove("visible");
  authWaiting.hidden = false;
  signInBtn.hidden   = true;
}

// Shown when this frame must start sign-in itself: no session and no popup open (e.g. the token
// expired). The popup needs a click inside this frame.
function showSignInPrompt(errorMessage) {
  hideLoadingOverlay();
  authWaiting.hidden = true;
  signInBtn.hidden   = false;
  if (errorMessage) {
    errAuth.textContent = errorMessage;
    errAuth.classList.add("visible");
  } else {
    errAuth.classList.remove("visible");
  }
}

function startSignInFromHere(prompt) {
  const opened = auth.startSignIn({ merchantSlug, lang: currentLang, prompt });
  if (opened) {
    showWaiting();
  } else {
    // Popup blocked: hand over to the dashboard's /add page.
    auth.redirectToAdd(merchantSlug, itemId);
  }
}

signInBtn.addEventListener("click", () => startSignInFromHere());

// "Not you?": forget this person on every button of the page and sign in someone else.
notYouBtn.addEventListener("click", () => {
  auth.clear();
  added = false;
  slider.classList.remove("at-success");
  startSignInFromHere("login");
});

// ── Adding the item ───────────────────────────────────────────────────────
function errorMessageFor(status, data) {
  if (data && data.code === "Wishlist.LimitReached") return t("errLimitReached");
  if (status === 404) return t("errNotFound");
  if (status === 429) return t("errTooMany");
  return t("errGeneric");
}

async function addItem(session) {
  if (adding || added) return;
  adding = true;
  showWaiting();

  try {
    const res = await fetch(apiBaseUrl + "/api/v1/wishlists/items", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": "Bearer " + session.accessToken,
      },
      body: JSON.stringify({ merchantSlug, itemId }),
    });
    const data = await res.json().catch(() => null);

    if (res.status === 401) {
      // The token expired or was revoked: sign in again on the next click.
      auth.clear();
      showSignInPrompt();
      return;
    }
    if (!res.ok) {
      const message = errorMessageFor(res.status, data);
      parent.postMessage({ type: "ADD_FAILED", version: "1", error: message, code: (data && data.code) || String(res.status) }, "*");
      showSignInPrompt(message);
      return;
    }

    added = true;
    const items = sortedItems(data);
    const addedItem = items.find((item) => item.externalProductId === itemId);
    parent.postMessage({ type: "PRODUCT_ADDED", version: "1", userId: session.userId }, "*");
    showSuccess(addedItem ? addedItem.id : null, items);
  } catch {
    showSignInPrompt(t("errGeneric"));
  } finally {
    adding = false;
  }
}

// ── Success screen ────────────────────────────────────────────────────────
function sortedItems(wishlist) {
  if (!wishlist || !Array.isArray(wishlist.items)) return [];
  return wishlist.items.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function renderRecentItems(items) {
  recentItemsList.innerHTML = "";

  if (!items.length) {
    recentItems.hidden = true;
    return;
  }

  items.slice(0, 10).forEach((item) => {
    // A just-added item starts "pending_import": the backend fills in the product snapshot and
    // funding target asynchronously, so there's no title or price to show yet.
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

function showSuccess(wishlistItemId, items) {
  // A plain link: the dashboard signs the member in through its own session, so no token is
  // ever put in the URL.
  if (dashboardUrl) {
    viewWishlistLink.href = wishlistItemId
      ? dashboardUrl + "/wishlists/" + encodeURIComponent(merchantSlug) + "/" + encodeURIComponent(wishlistItemId)
      : dashboardUrl + "/";
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

  renderRecentItems(items);
  hideLoadingOverlay();
  slider.classList.add("at-success");

  // The success screen holds more (item preview, recently-added list) than the sign-in screen;
  // ask the parent page to grow the iframe just for this.
  parent.postMessage({ type: "RESIZE_MODAL", version: "1", height: 600 }, "*");
}

// ── Sign-in outcomes from any of our frames ───────────────────────────────
auth.onSession((session) => {
  if (session && !added) addItem(session);
});

auth.onSignInEnded((outcome) => {
  if (added || auth.getSession()) return;
  if (outcome === "cancelled") {
    // The member closed the popup: close the modal and show the button again, no error.
    parent.postMessage({ type: "MODAL_CLOSED", version: "1" }, "*");
  } else if (outcome === "error") {
    showSignInPrompt(t("errSignIn"));
  }
});

async function start() {
  const session = auth.getSession();
  if (session) {
    addItem(session);
    return;
  }
  const state = await auth.query(300);
  if (state === "session") {
    addItem(auth.getSession());
  } else if (state === "pending") {
    showWaiting();
  } else {
    showSignInPrompt();
  }
}

// ── Close button ──────────────────────────────────────────────────────────
closeBtn.addEventListener("click", () => {
  parent.postMessage({ type: "MODAL_CLOSED", version: "1" }, "*");
});

// ── INIT message from parent ──────────────────────────────────────────────
// merchantSlug/itemId read from the URL above are a dev-only fallback; the authoritative values
// arrive here, from component.ts, shortly after load.
let initHandled = false;

function handleInit(msg) {
  if (initHandled) return;
  initHandled = true;

  if (msg) {
    if (msg.lang)         currentLang  = msg.lang;
    if (msg.merchantSlug) merchantSlug = msg.merchantSlug;
    if (msg.itemId)       itemId       = msg.itemId;
    if (msg.itemTitle)    itemTitle    = msg.itemTitle;
    if (msg.itemImage)    itemImage    = msg.itemImage;
    if (msg.itemPrice)    itemPrice    = msg.itemPrice;
    if (msg.itemCurrency) itemCurrency = msg.itemCurrency;
    applyLang();
  }

  start();
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
applyLang();
// Fallback for standalone/dev use where no parent ever sends INIT (proceeds with whatever the
// URL query string provided).
setTimeout(() => handleInit(null), 1500);
