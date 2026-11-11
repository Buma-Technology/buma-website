/* BuMa Lead Form — site-wide contact form (native Buma CRM form "Website Lead Intake").
 * Single shared asset on every page: <script src="/leadform.js" defer></script>
 *
 * Renders an on-brand HTML form and posts it to Buma CRM's public form endpoint
 * (submitPublicCRMForm on vbuma2-0.base44.app). Buma CRM creates/matches the contact and
 * company, tags the contact "website", and emails the owner notification.
 * The CRM-hosted form page sends X-Frame-Options: DENY, so it cannot be iframed; this native
 * form posts the same JSON payload the CRM's own public form page sends.
 *
 * Replaces the JotForm iframe (form 261695091611054). ROLLBACK: revert the commit that
 * introduced this file; the previous leadform.js restores the JotForm embed unchanged.
 *
 * Appears in:
 *   (a) a global modal opened by the floating "Let's Talk" button and any /contact CTA, and
 *   (b) any <div data-buma-form></div> placed inline on a page (the form sections).
 * Accessible modal: overlay, ESC, click-out, focus trap, scroll lock, focus restore.
 * Attribution: landing URL, referrer, UTM and gclid are captured on first page view of the
 * session (sessionStorage) and sent as hidden fields + submission metadata.
 */
(function () {
  "use strict";

  /* ---------- configuration ---------- */
  // Buma CRM form "Website Lead Intake" (id 6af3bc26b504b7a25ac32b99).
  // CRM_FORM_TOKEN is the public token from Buma CRM -> Forms -> Website Lead Intake -> Copy link
  // (the part after /f/). It is a public, non-secret identifier (it appears in the share URL).
  var CRM_APP_ID = "6a5165a4bad7da9aadf2b7ca";
  var CRM_ENDPOINT = "https://vbuma2-0.base44.app/api/apps/" + CRM_APP_ID + "/functions/submitPublicCRMForm";
  var CRM_FORM_TOKEN = ""; // REQUIRED before release — see PR cutover checklist.
  var FALLBACK_EMAIL = "support@bumatechnology.com";
  var ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"];
  var ATTR_STORE = "buma_lf_attr";

  var CTA_SELECTOR = [
    'a[href="/contact"]',
    'a[href$="bumatechnology.com/contact"]',
    "[data-leadform]"
  ].join(",");

  var injected = false, overlay, dialog, lastFocus, uid = 0;

  /* ---------- attribution ---------- */

  function readAttr() {
    var stored = null;
    try { stored = JSON.parse(sessionStorage.getItem(ATTR_STORE) || "null"); } catch (e) {}
    var q = new URLSearchParams(window.location.search), fresh = {}, hasUtm = false;
    ATTR_KEYS.forEach(function (k) { var v = q.get(k); if (v) { fresh[k] = v.slice(0, 200); hasUtm = true; } });
    if (!stored || hasUtm) {
      stored = fresh;
      stored.landing_url = window.location.href.split("#")[0].slice(0, 500);
      stored.referrer = (document.referrer || "").slice(0, 500);
      try { sessionStorage.setItem(ATTR_STORE, JSON.stringify(stored)); } catch (e) {}
    }
    return stored;
  }

  /* ---------- the form (native, posts to Buma CRM) ---------- */

  function field(id, name, label, type, auto, extra) {
    var input = type === "textarea"
      ? '<textarea class="bf-input bf-ta" id="' + id + '" name="' + name + '" rows="5" required aria-required="true"' + (extra || "") + "></textarea>"
      : '<input class="bf-input" id="' + id + '" name="' + name + '" type="' + type + '" autocomplete="' + auto + '" required aria-required="true"' + (extra || "") + " />";
    return '<div class="bf-field" data-f="' + name + '"><label class="bf-label" for="' + id + '">' + label +
      '<span class="bf-req" aria-hidden="true">*</span></label>' + input +
      '<p class="bf-err" id="' + id + '-err" hidden></p></div>';
  }

  function renderInto(el) {
    var p = "bf" + (++uid) + "-";
    el.innerHTML =
      '<form class="bf-form" novalidate data-provider="buma_crm">' +
        '<fieldset class="bf-row"><legend class="bf-label">Full Name<span class="bf-req" aria-hidden="true">*</span></legend>' +
          field(p + "first", "first_name", "First Name", "text", "given-name") +
          field(p + "last", "last_name", "Last Name", "text", "family-name") +
        "</fieldset>" +
        field(p + "email", "email", "Email Address", "email", "email", ' placeholder="example@example.com"') +
        field(p + "phone", "phone", "Phone Number", "tel", "tel", ' placeholder="(000) 000-0000"') +
        field(p + "company", "company", "Company Name", "text", "organization") +
        field(p + "details", "project_details", "Tell us about your project", "textarea", "off") +
        // honeypot: hidden from people and assistive tech; bots that fill it are rejected server-side
        '<div class="bf-hp-wrap" aria-hidden="true"><label>Website<input class="bf-hp" type="text" name="website" tabindex="-1" autocomplete="off" /></label></div>' +
        '<p class="bf-status" role="alert" aria-live="assertive" hidden></p>' +
        '<button type="submit" class="bf-submit">Submit</button>' +
      "</form>" +
      '<div class="bf-thanks" tabindex="-1" hidden><div class="bf-thanks-title">Thank you</div>' +
        '<p>Thanks — we received your project details. We respond within one business day.</p></div>';
    var form = el.querySelector("form");
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(form, el); });
    form.addEventListener("input", function (e) { if (e.target.classList.contains("bf-input")) setErr(e.target, ""); });
  }

  function setErr(input, msg) {
    var err = document.getElementById(input.id + "-err");
    if (!err) return;
    err.textContent = msg; err.hidden = !msg;
    if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", err.id); }
    else { input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); }
  }

  function validate(form) {
    var first = null;
    Array.prototype.forEach.call(form.querySelectorAll(".bf-input"), function (i) {
      var v = i.value.trim(), msg = "";
      if (!v) msg = "This field is required.";
      else if (i.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = "Enter a valid email address.";
      else if (i.type === "tel" && v.replace(/\D/g, "").length < 7) msg = "Please enter a valid phone number.";
      setErr(i, msg);
      if (msg && !first) first = i;
    });
    if (first) first.focus();
    return !first;
  }

  function status(form, msg) {
    var s = form.querySelector(".bf-status");
    s.innerHTML = msg; s.hidden = !msg;
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "lf-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function submit(form, root) {
    status(form, "");
    if (!validate(form)) return;
    var btn = form.querySelector(".bf-submit");
    var fail = 'Something went wrong sending your details. Please try again, or email <a href="mailto:' +
      FALLBACK_EMAIL + '">' + FALLBACK_EMAIL + "</a>.";
    if (!CRM_FORM_TOKEN) { status(form, fail); return; }
    var val = function (n) { return (form.elements[n].value || "").trim(); };
    var attr = readAttr();
    var data = {
      first_name: val("first_name"), last_name: val("last_name"), email: val("email"),
      phone: val("phone"), company: val("company"), project_details: val("project_details"),
      source: "website", form_provider: "buma_crm",
      landing_url: attr.landing_url || "", referrer: attr.referrer || ""
    };
    ATTR_KEYS.forEach(function (k) { data[k] = attr[k] || ""; });
    var meta = {
      started_at: form.getAttribute("data-started") || new Date().toISOString(),
      completed_at: new Date().toISOString(),
      user_agent: navigator.userAgent,
      referrer: attr.referrer || "",
      page_url: window.location.href.split("#")[0]
    };
    ATTR_KEYS.forEach(function (k) { if (attr[k]) meta[k] = attr[k]; });
    var key = form.getAttribute("data-key") || uuid(); // idempotency: same key on retry
    form.setAttribute("data-key", key);
    btn.disabled = true; btn.textContent = "Sending…";
    fetch(CRM_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-App-Id": CRM_APP_ID },
      body: JSON.stringify({ token: CRM_FORM_TOKEN, submission_key: key, data: data, hp: form.elements.website.value || "", metadata: meta })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.success) throw new Error(j.error || "submit failed");
      });
    }).then(function () {
      form.hidden = true;
      var t = root.querySelector(".bf-thanks"); t.hidden = false; t.focus();
      if (window.dataLayer) window.dataLayer.push({ event: "generate_lead", form_provider: "buma_crm" });
    }).catch(function () {
      status(form, fail);
    }).then(function () { btn.disabled = false; btn.textContent = "Submit"; });
  }

  /* ---------- styles ---------- */

  function injectStyles() {
    if (document.getElementById("lf-styles")) return;
    var css =
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
      ".lf-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--surface,#fff);padding:20px;}" +
      "body.lf-lock{overflow:hidden;}" +
      // native form
      "[data-buma-form]{max-width:680px;margin:0 auto;}" +
      ".bf-form{display:grid;gap:14px;font-family:'Inter',system-ui,sans-serif;color:var(--ink,#09090b);}" +
      ".bf-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;border:0;margin:0;padding:0;min-width:0;}" +
      ".bf-row>legend{grid-column:1/-1;margin-bottom:6px;padding:0;}" +
      ".bf-row .bf-label{font-weight:500;font-size:12.5px;color:var(--ink-3,#3f3f46);}" +
      ".bf-row .bf-field .bf-req{display:none;}" +
      ".bf-form[hidden],.bf-thanks[hidden],.bf-err[hidden],.bf-status[hidden]{display:none!important;}" +
      "@media (max-width:540px){.bf-row{grid-template-columns:1fr;}}" +
      ".bf-field{display:grid;gap:6px;min-width:0;}" +
      ".bf-label{font-size:13.5px;font-weight:600;letter-spacing:-0.01em;color:var(--ink,#09090b);}" +
      ".bf-req{color:#dc2626;margin-left:3px;}" +
      ".bf-input{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:11px 12px;color:var(--ink,#09090b);" +
      "background:var(--surface,#fff);border:1px solid var(--line,#e4e4e7);border-radius:var(--r,6px);transition:border-color .2s ease,box-shadow .2s ease;}" +
      ".bf-input:focus{outline:none;border-color:var(--ink,#09090b);box-shadow:0 0 0 3px rgba(9,9,11,0.10);}" +
      ".bf-input[aria-invalid=true]{border-color:#dc2626;}" +
      ".bf-ta{resize:vertical;min-height:120px;}" +
      ".bf-err{margin:0;font-size:12.5px;color:#b91c1c;}" +
      ".bf-status{margin:0;font-size:13.5px;color:#b91c1c;}.bf-status a{color:inherit;}" +
      ".bf-hp-wrap{position:absolute!important;left:-10000px;width:1px;height:1px;overflow:hidden;}" +
      ".bf-submit{justify-self:start;font:inherit;font-weight:600;font-size:15px;padding:12px 22px;border:0;border-radius:var(--r,6px);" +
      "color:#fff;background:var(--ink,#09090b);cursor:pointer;transition:background .2s ease;}" +
      ".bf-submit:hover{background:var(--ink-2,#18181b);}.bf-submit:disabled{opacity:.6;cursor:progress;}" +
      ".bf-submit:focus-visible{outline:2px solid var(--ink,#09090b);outline-offset:3px;}" +
      ".bf-thanks{font-family:'Inter',system-ui,sans-serif;padding:24px 4px;color:var(--ink-3,#3f3f46);}" +
      ".bf-thanks:focus{outline:none;}.bf-thanks-title{font-weight:700;font-size:20px;color:var(--ink,#09090b);margin-bottom:6px;}" +
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
    var f = overlay.querySelector(".bf-form");
    if (f && !f.getAttribute("data-started")) f.setAttribute("data-started", new Date().toISOString());
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add("lf-open");
        document.body.classList.add("lf-lock");
        focusFirst();
        // the overlay is still visibility:hidden on this frame; retry once the fade-in has started
        setTimeout(focusFirst, 60);
        setTimeout(focusFirst, 380);
      });
    });
  }

  function focusFirst() {
    if (!overlay.classList.contains("lf-open") || overlay.contains(document.activeElement)) return;
    var first = overlay.querySelector(".bf-input:not([hidden])") || overlay.querySelector(".bf-thanks:not([hidden])");
    if (first) try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
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
      var f = el.querySelector(".bf-form");
      f.addEventListener("focusin", function () { if (!f.getAttribute("data-started")) f.setAttribute("data-started", new Date().toISOString()); });
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    readAttr(); // capture landing URL / UTM on first view of the session
    injectStyles();
    document.addEventListener("click", onClick);
    buildFab();
    mountInline();
    window.BumaLeadForm = { open: function () { open(); }, close: close };
  });
})();
