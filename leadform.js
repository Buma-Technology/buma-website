/* BuMa Lead Form — site-wide contact form (embeds JotForm form 261695091611054).
 * Single shared asset on every page: <script src="/leadform.js" defer></script>
 *
 * Embeds the live JotForm (https://form.jotform.com/261695091611054) so submissions are
 * handled entirely by JotForm — no field-mapping to keep in sync, no silent POST failures.
 * We use the iframe embed rather than JotForm's jsform <script> tag because jsform relies on
 * document.write, which blanks the page when injected into the JS-built modal after load; the
 * iframe renders the identical form and is safe to mount dynamically. The iframe auto-resizes
 * via JotForm's postMessage "setHeight" events (handled below — no third-party JS required).
 *
 * Appears in:
 *   (a) a global modal opened by the floating "Let's Talk" button and any /contact CTA, and
 *   (b) any <div data-buma-form></div> placed inline on a page (the form sections).
 * Accessible modal: overlay, ESC, click-out, focus trap, scroll lock, focus restore.
 */
(function () {
  "use strict";

  var FORM_ID = "261695091611054";
  var FORM_SRC = "https://form.jotform.com/" + FORM_ID;
  // Any CTA whose destination is the contact page is treated as a lead-capture trigger.
  var CTA_SELECTOR = [
    'a[href="/contact"]',
    'a[href$="bumatechnology.com/contact"]',
    "[data-leadform]"
  ].join(",");

  var injected = false, overlay, dialog, lastFocus, resizeWired = false;

  /* ---------- the form (live JotForm iframe) ---------- */

  function renderInto(el) {
    var iframe = document.createElement("iframe");
    iframe.className = "bf-jf";
    iframe.id = "JotFormIFrame-" + FORM_ID;
    iframe.title = "Contact BuMa Technology";
    iframe.src = FORM_SRC;
    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("allow", "geolocation; microphone; camera; fullscreen; payment");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("scrolling", "no");
    el.innerHTML = "";
    el.appendChild(iframe);
    wireResize();
  }

  // JotForm posts a height message so the embed can fit its content. Older builds send the
  // string "setHeight:<px>:<formID>"; newer ones may send {type:"setHeight",height:<px>}.
  // One listener resizes every embedded BuMa form iframe (modal + any inline mounts).
  function wireResize() {
    if (resizeWired) return;
    resizeWired = true;
    window.addEventListener("message", function (e) {
      var h = 0, d = e.data;
      if (typeof d === "string") {
        if (d.indexOf("setHeight") !== 0) return;
        h = parseInt(d.split(":")[1], 10);
      } else if (d && d.type === "setHeight") {
        h = parseInt(d.height, 10);
      } else {
        return;
      }
      if (!h) return;
      var frames = document.querySelectorAll(".bf-jf");
      Array.prototype.forEach.call(frames, function (f) { f.style.height = h + "px"; });
    });
  }

  /* ---------- styles ---------- */

  function injectStyles() {
    if (document.getElementById("lf-styles")) return;
    var css =
      // modal shell
      ".lf-overlay{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;" +
      "padding:clamp(12px,4vw,40px);background:rgba(9,9,11,0.62);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);" +
      "opacity:0;visibility:hidden;transition:opacity .3s var(--ease,ease),visibility .3s var(--ease,ease);}" +
      ".lf-overlay.lf-open{opacity:1;visibility:visible;}" +
      ".lf-dialog{position:relative;width:100%;max-width:600px;max-height:92vh;display:flex;flex-direction:column;" +
      "background:var(--surface,#fff);border:1px solid var(--line,#e4e4e7);border-radius:var(--r-lg,10px);" +
      "box-shadow:var(--shadow-lg,0 20px 48px -12px rgba(9,9,11,0.28));overflow:hidden;" +
      "transform:translateY(16px) scale(.98);opacity:0;transition:transform .35s var(--ease,cubic-bezier(.22,1,.36,1)),opacity .35s var(--ease,ease);}" +
      ".lf-overlay.lf-open .lf-dialog{transform:translateY(0) scale(1);opacity:1;}" +
      ".lf-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px;" +
      "border-bottom:1px solid var(--line,#e4e4e7);background:var(--surface,#fff);}" +
      ".lf-title{font-family:'Inter',system-ui,sans-serif;font-weight:700;font-size:16px;letter-spacing:-0.02em;color:var(--ink,#09090b);}" +
      ".lf-sub{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-4,#71717a);margin-top:3px;}" +
      ".lf-close{flex:none;width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:var(--r,6px);color:var(--ink-3,#3f3f46);cursor:pointer;" +
      "background:var(--bg-alt,#f4f4f5);transition:background .2s var(--ease,ease),color .2s var(--ease,ease);}" +
      ".lf-close:hover{background:var(--line,#e4e4e7);color:var(--ink,#09090b);}" +
      ".lf-close:focus-visible{outline:2px solid var(--ink,#09090b);outline-offset:2px;}" +
      ".lf-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--surface,#fff);}" +
      "body.lf-lock{overflow:hidden;}" +
      // embedded JotForm iframe (modal + inline mounts)
      "[data-buma-form]{max-width:680px;margin:0 auto;}" +
      ".bf-jf{display:block;width:1px;min-width:100%;max-width:100%;border:none;background:transparent;" +
      "height:720px;}" +
      ".lf-body .bf-jf{height:680px;}" +
      // floating action button
      ".lf-fab{position:fixed;right:clamp(16px,4vw,28px);bottom:clamp(16px,4vw,28px);z-index:9990;" +
      "display:inline-flex;align-items:center;gap:9px;padding:13px 20px;border:0;cursor:pointer;" +
      "font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:14.5px;letter-spacing:-0.01em;" +
      "color:#fff;background:var(--ink,#09090b);border-radius:999px;" +
      "box-shadow:0 8px 24px -6px rgba(9,9,11,0.45),0 2px 6px rgba(9,9,11,0.18);" +
      "transition:transform .25s var(--ease,cubic-bezier(.22,1,.36,1)),box-shadow .25s var(--ease,ease),background .2s ease,opacity .2s ease;}" +
      ".lf-fab:hover{transform:translateY(-3px);background:var(--ink-2,#18181b);box-shadow:0 14px 32px -6px rgba(9,9,11,0.5),0 4px 10px rgba(9,9,11,0.22);}" +
      ".lf-fab:active{transform:translateY(-1px);}" +
      ".lf-fab:focus-visible{outline:2px solid var(--ink,#09090b);outline-offset:3px;}" +
      ".lf-fab .lf-fab-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,0.20);}" +
      ".lf-fab svg{flex:none;}" +
      "@media (max-width:540px){.lf-fab{padding:12px 16px;font-size:13.5px;}}" +
      "body.lf-lock .lf-fab{opacity:0;pointer-events:none;}" +
      "@media (prefers-reduced-motion:reduce){.lf-fab{transition:opacity .2s ease;}.lf-fab:hover{transform:none;}}";
    var s = document.createElement("style");
    s.id = "lf-styles";
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- modal ---------- */

  function build() {
    if (injected) return;
    injectStyles();
    overlay = document.createElement("div");
    overlay.className = "lf-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Contact BuMa Technology");
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="lf-dialog">' +
        '<div class="lf-head">' +
          '<div><div class="lf-title">Let’s talk integrations</div><div class="lf-sub">Response within one business day</div></div>' +
          '<button type="button" class="lf-close" aria-label="Close">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
          "</button>" +
        "</div>" +
        '<div class="lf-body"></div>' +
      "</div>";
    document.body.appendChild(overlay);
    dialog = overlay.querySelector(".lf-dialog");
    renderInto(overlay.querySelector(".lf-body"));
    overlay.querySelector(".lf-close").addEventListener("click", close);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay.classList.contains("lf-open")) close();
      if (e.key === "Tab" && overlay.classList.contains("lf-open")) trapFocus(e);
    });
    injected = true;
  }

  function open(trigger) {
    build();
    lastFocus = trigger || document.activeElement;
    overlay.hidden = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add("lf-open");
        document.body.classList.add("lf-lock");
        var first = overlay.querySelector(".bf-input");
        if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
      });
    });
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("lf-open");
    document.body.classList.remove("lf-lock");
    var done = function () {
      overlay.hidden = true;
      overlay.removeEventListener("transitionend", done);
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
    };
    overlay.addEventListener("transitionend", done);
  }

  function trapFocus(e) {
    var f = overlay.querySelectorAll('button, [href], input:not([type="hidden"]):not(.bf-hp), select, textarea, [tabindex]:not([tabindex="-1"])');
    f = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null || el === document.activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- triggers ---------- */

  function onClick(e) {
    var el = e.target.closest(CTA_SELECTOR);
    if (!el) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // allow new-tab
    e.preventDefault();
    open(el);
  }

  function buildFab() {
    if (document.querySelector(".lf-fab")) return;
    injectStyles();
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lf-fab";
    btn.setAttribute("data-leadform", "");
    btn.setAttribute("aria-haspopup", "dialog");
    btn.setAttribute("aria-label", "Contact BuMa — open the contact form");
    btn.innerHTML =
      '<span class="lf-fab-dot" aria-hidden="true"></span>' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>' +
      "Let’s Talk";
    document.body.appendChild(btn);
  }

  function mountInline() {
    var mounts = document.querySelectorAll("[data-buma-form]");
    Array.prototype.forEach.call(mounts, function (el) {
      if (el.getAttribute("data-bf-ready")) return;
      el.setAttribute("data-bf-ready", "1");
      renderInto(el);
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    injectStyles();
    document.addEventListener("click", onClick);
    buildFab();
    mountInline();
    window.BumaLeadForm = { open: function () { open(); }, close: close };
  });
})();
