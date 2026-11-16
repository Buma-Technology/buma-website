/* BuMa consent — analytics choice for every page.
 * <script src="/consent.js"></script> in <head>, where the gtag snippet used to be.
 *
 * The banner stays up until the visitor chooses. The choice is stored in
 * localStorage as buma_consent = "granted" or "denied", and the banner is not
 * shown again. The footer "Cookie settings" link reopens it.
 *
 * gtag.js and gtag('config', 'G-6YXQK31JES') run only when buma_consent is
 * "granted" — on Accept, or immediately on a later visit. Declining loads nothing.
 * The config call uses this document's full URL so GA4 can read utm_* from it.
 */
(function () {
  "use strict";

  var GA_ID = "G-6YXQK31JES";
  var STORAGE_KEY = "buma_consent";
  var gaStarted = false;
  var banner = null;

  function readConsent() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeConsent(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
  }

  function loadGA() {
    if (readConsent() !== "granted") return;
    try { window["ga-disable-" + GA_ID] = false; } catch (e) {}
    if (gaStarted) return;
    gaStarted = true;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { page_location: window.location.href });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(script);
  }

  function injectStyles() {
    if (document.getElementById("buma-consent-styles")) return;
    var css =
      ".buma-consent{position:fixed;z-index:10050;left:16px;right:16px;bottom:16px;margin:0 auto;max-width:680px;" +
      "display:flex;align-items:center;gap:16px;box-sizing:border-box;padding:12px 12px 12px 16px;" +
      "background:#fff;color:#09090b;border:1px solid #e4e4e7;border-radius:10px;" +
      "box-shadow:0 1px 2px rgba(9,9,11,0.04),0 12px 32px -16px rgba(9,9,11,0.28);" +
      "font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:13.5px;font-weight:400;line-height:1.45;letter-spacing:-0.011em;}" +
      ".buma-consent[hidden]{display:none !important;}" +
      ".buma-consent p{margin:0;flex:1;min-width:0;color:#3f3f46;}" +
      ".buma-consent-actions{display:flex;flex:none;gap:8px;}" +
      ".buma-consent button{box-sizing:border-box;margin:0;min-width:104px;padding:8px 14px;" +
      "font-family:inherit;font-size:13px;font-weight:600;letter-spacing:-0.01em;line-height:1.2;text-align:center;" +
      "color:#09090b;background:#fff;border:1px solid #d4d4d8;border-radius:6px;cursor:pointer;" +
      "box-shadow:none;appearance:none;-webkit-appearance:none;}" +
      ".buma-consent button:hover{border-color:#09090b;background:#fafafa;}" +
      ".buma-consent button:focus-visible{outline:2px solid #09090b;outline-offset:2px;}" +
      ".buma-consent button:active{background:#f4f4f5;}" +
      "footer .buma-cookie-settings{font-family:'Inter',system-ui,sans-serif;font-size:12.5px;font-weight:500;" +
      "letter-spacing:-0.01em;text-transform:none;color:rgba(255,255,255,0.55);text-decoration:none;white-space:nowrap;}" +
      "footer .buma-cookie-settings:hover{color:#fff;}" +
      "footer .buma-cookie-settings:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:2px;}" +
      "body.buma-consent-open .lf-fab,body.buma-consent-open .sticky-cta{bottom:var(--buma-consent-shift,120px);}" +
      "@media (max-width:640px){.buma-consent{flex-direction:column;align-items:stretch;gap:12px;padding:14px;}" +
      ".buma-consent-actions{display:grid;grid-template-columns:1fr 1fr;}" +
      ".buma-consent button{min-width:0;width:100%;}}" +
      "@media (prefers-reduced-motion:reduce){.buma-consent,.buma-consent button{transition:none;}}";
    var style = document.createElement("style");
    style.id = "buma-consent-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function shiftFloatingButtons() {
    if (!document.body) return;
    if (!banner || banner.hidden) {
      document.body.classList.remove("buma-consent-open");
      document.body.style.removeProperty("--buma-consent-shift");
      return;
    }
    document.body.classList.add("buma-consent-open");
    var lift = banner.offsetHeight + 28;
    document.body.style.setProperty("--buma-consent-shift", lift + "px");
  }

  function setBannerOpen(open, focus) {
    if (!banner) return;
    banner.hidden = !open;
    if (open) {
      requestAnimationFrame(shiftFloatingButtons);
    } else {
      shiftFloatingButtons();
    }
    if (open && focus) {
      var first = banner.querySelector("button");
      if (first) first.focus();
    }
  }

  function choose(value) {
    if (value !== "granted" && value !== "denied") return;
    writeConsent(value);
    if (value === "granted") {
      loadGA();
    } else {
      try { window["ga-disable-" + GA_ID] = true; } catch (e) {}
    }
    setBannerOpen(false, false);
  }

  function buildBanner() {
    if (banner) return;
    injectStyles();
    banner = document.createElement("div");
    banner.className = "buma-consent";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie settings");
    banner.hidden = true;
    banner.innerHTML =
      "<p>Analytics cookies help Buma understand site use.</p>" +
      '<div class="buma-consent-actions">' +
        '<button type="button" data-consent="denied">Decline</button>' +
        '<button type="button" data-consent="granted">Accept</button>' +
      "</div>";
    banner.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("button[data-consent]") : null;
      if (!btn) return;
      choose(btn.getAttribute("data-consent"));
    });
    document.body.appendChild(banner);
  }

  function openBanner(focus) {
    buildBanner();
    setBannerOpen(true, !!focus);
  }

  function ensureFooterLink() {
    if (document.querySelector("[data-buma-consent-open]")) return;
    var link = document.createElement("a");
    link.className = "buma-cookie-settings";
    link.href = "#cookie-settings";
    link.setAttribute("data-buma-consent-open", "");
    link.textContent = "Cookie settings";
    var bottom = document.querySelector("footer .foot-bottom");
    if (bottom) {
      var status = bottom.querySelector(".foot-status");
      if (status) bottom.insertBefore(link, status);
      else bottom.appendChild(link);
      return;
    }
    var footer = document.querySelector("footer");
    if (footer) footer.appendChild(link);
  }

  function mount() {
    injectStyles();
    ensureFooterLink();
    var choice = readConsent();
    if (choice !== "granted" && choice !== "denied") openBanner(false);
  }

  document.addEventListener("click", function (e) {
    var link = e.target && e.target.closest ? e.target.closest("[data-buma-consent-open]") : null;
    if (!link) return;
    e.preventDefault();
    openBanner(true);
  });

  window.addEventListener("resize", function () {
    if (banner && !banner.hidden) shiftFloatingButtons();
  });

  if (readConsent() === "granted") loadGA();

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
