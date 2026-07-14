/* BuMa Lead Form — site-wide, on-brand contact form (submits to JotForm 261695091611054).
 * Single shared asset on every page: <script src="/leadform.js" defer></script>
 *
 * Why native (not the JotForm iframe): the iframe renders JotForm's own theme, which clashes
 * with the site. This builds the form from the site's design tokens (Inter, --ink, --line,
 * radii, --ease) so it matches exactly, then submits to JotForm via a hidden iframe target
 * (no page navigation, no CORS issue) and shows a branded thank-you. Fast: no third-party
 * CSS/JS, nothing loads until submit.
 *
 * MERGE GATE: the field names below (q2_q2_fullname0[first], q3_q3_email1, …) must match the
 * live JotForm config or submissions vanish silently. Any change to this file ships only after
 * a real browser test submission is confirmed in the JotForm inbox.
 *
 * Success detection: JotForm's response page is cross-origin, so the sink iframe's `load` event
 * alone can't prove acceptance. If the JotForm form's Thank You action is set to redirect to
 * https://bumatechnology.com/form-thanks.html, the sink lands same-origin and acceptance is
 * VERIFIED; otherwise we fall back to the load-event heuristic, and the thank-you includes a
 * "didn't hear from us? email support@" safety line either way. A 12s watchdog surfaces a retry
 * + mailto path if the POST never completes (network failure), so no visitor dead-ends.
 *
 * Appears in:
 *   (a) a global modal opened by the floating "Let's Talk" button and any /contact CTA, and
 *   (b) any <div data-buma-form></div> placed inline on a page (e.g. /contact).
 * Accessible modal: overlay, ESC, click-out, focus trap, scroll lock, focus restore.
 */
(function () {
  "use strict";

  var SUBMIT_URL = "https://submit.jotform.com/submit/261695091611054";
  var FORM_ID = "261695091611054";
  // Any CTA whose destination is the contact page is treated as a lead-capture trigger.
  var CTA_SELECTOR = [
    'a[href="/contact"]',
    'a[href$="bumatechnology.com/contact"]',
    "[data-leadform]"
  ].join(",");

  var injected = false, overlay, dialog, lastFocus, seq = 0;

  /* ---------- the form ---------- */

  function formInner() {
    var n = ++seq, sink = "bf-sink-" + n;
    return (
      '<form class="bf-form" action="' + SUBMIT_URL + '" method="post" target="' + sink + '" novalidate>' +
        '<div class="bf-row">' +
          '<div class="bf-field"><label class="bf-label" for="bf-fn-' + n + '">First name <span>*</span></label>' +
            '<input class="bf-input" id="bf-fn-' + n + '" name="q2_q2_fullname0[first]" type="text" autocomplete="given-name" required></div>' +
          '<div class="bf-field"><label class="bf-label" for="bf-ln-' + n + '">Last name <span>*</span></label>' +
            '<input class="bf-input" id="bf-ln-' + n + '" name="q2_q2_fullname0[last]" type="text" autocomplete="family-name" required></div>' +
        '</div>' +
        '<div class="bf-row">' +
          '<div class="bf-field"><label class="bf-label" for="bf-em-' + n + '">Work email <span>*</span></label>' +
            '<input class="bf-input" id="bf-em-' + n + '" name="q3_q3_email1" type="email" autocomplete="email" required></div>' +
          '<div class="bf-field"><label class="bf-label" for="bf-ph-' + n + '">Phone <span>*</span></label>' +
            '<input class="bf-input" id="bf-ph-' + n + '" name="q4_q4_phone2[full]" type="tel" autocomplete="tel" placeholder="(000) 000-0000" required></div>' +
        '</div>' +
        '<div class="bf-field"><label class="bf-label" for="bf-co-' + n + '">Company <span>*</span></label>' +
          '<input class="bf-input" id="bf-co-' + n + '" name="q5_q5_textbox3" type="text" autocomplete="organization" required></div>' +
        '<div class="bf-field"><label class="bf-label" for="bf-msg-' + n + '">Tell us about your project <span>*</span></label>' +
          '<textarea class="bf-input bf-textarea" id="bf-msg-' + n + '" name="q6_q6_textarea4" rows="4" required></textarea></div>' +
        // honeypot (bots fill it; humans never see it) + JotForm anti-spam fields
        '<input class="bf-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<input type="hidden" name="formID" value="' + FORM_ID + '">' +
        '<input type="hidden" name="simple_spc" value="' + FORM_ID + '">' +
        '<div class="bf-actions">' +
          '<button type="submit" class="bf-submit">' +
            '<span class="bf-submit-label">Send message</span>' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' +
          '</button>' +
          '<span class="bf-note">Response within one business day</span>' +
        '</div>' +
        '<div class="bf-status" role="status" aria-live="polite"></div>' +
        '<iframe name="' + sink + '" class="bf-sink" title="Form submission" aria-hidden="true" tabindex="-1"></iframe>' +
      '</form>' +
      '<div class="bf-thanks" hidden tabindex="-1">' +
        '<div class="bf-thanks-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div>' +
        "<h3>Thanks — we've got it.</h3>" +
        "<p>A BuMa integration specialist will get back to you within one business day.</p>" +
        '<p class="bf-safety">Don\'t hear from us? Email <a href="mailto:support@bumatechnology.com">support@bumatechnology.com</a> directly.</p>' +
      '</div>'
    );
  }

  function wireForm(wrap) {
    var form = wrap.querySelector(".bf-form");
    var thanks = wrap.querySelector(".bf-thanks");
    var status = wrap.querySelector(".bf-status");
    var sink = wrap.querySelector(".bf-sink");
    var btn = wrap.querySelector(".bf-submit");
    var submitting = false;

    var watchdog = null;

    function showThanks(verified) {
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      submitting = false;
      status.textContent = "";
      form.hidden = true;
      thanks.hidden = false;
      if (verified) thanks.setAttribute("data-verified", "1");
      try { thanks.focus(); } catch (e) {}
    }

    function showRetry() {
      // POST never completed (network failure) — give the visitor a way out, never a dead end.
      watchdog = null;
      submitting = false;
      btn.disabled = false;
      btn.classList.remove("bf-loading");
      wrap.querySelector(".bf-submit-label").textContent = "Try again";
      status.innerHTML = 'That didn\'t go through. Please try again, or email us at <a href="mailto:support@bumatechnology.com">support@bumatechnology.com</a>.';
    }

    form.addEventListener("submit", function (e) {
      if (form.querySelector(".bf-hp") && form.querySelector(".bf-hp").value) { e.preventDefault(); return; } // bot
      if (!form.checkValidity()) { e.preventDefault(); form.reportValidity(); return; }
      // Valid: let the native POST proceed into the hidden iframe (no preventDefault).
      submitting = true;
      btn.disabled = true;
      btn.classList.add("bf-loading");
      wrap.querySelector(".bf-submit-label").textContent = "Sending…";
      status.textContent = "Sending your message…";
      watchdog = setTimeout(showRetry, 12000);
    });

    sink.addEventListener("load", function () {
      if (!submitting) return; // ignore the initial blank load
      var verified = false;
      try {
        // Readable only if JotForm redirected same-origin (Thank You action set to
        // https://bumatechnology.com/form-thanks.html) — that's a VERIFIED acceptance.
        verified = sink.contentWindow.location.host === location.host;
      } catch (err) {
        // Cross-origin: JotForm rendered its own response page. Treat the load as success
        // (heuristic) — the thank-you carries the support@ safety line for the rare miss.
      }
      showThanks(verified);
    });
  }

  function renderInto(el) {
    el.innerHTML = '<div class="bf-wrap">' + formInner() + "</div>";
    wireForm(el.querySelector(".bf-wrap"));
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
      // form
      ".bf-wrap{padding:20px 22px 24px;}" +
      "[data-buma-form]{max-width:680px;margin:0 auto;}" +
      "[data-buma-form] .bf-wrap{background:var(--surface,#fff);border:1px solid var(--line,#e4e4e7);border-radius:var(--r-lg,10px);" +
      "box-shadow:var(--shadow-sm,0 1px 2px rgba(9,9,11,0.04));padding:clamp(22px,3vw,34px);}" +
      ".bf-form{display:flex;flex-direction:column;gap:16px;}" +
      ".bf-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}" +
      "@media (max-width:520px){.bf-row{grid-template-columns:1fr;}}" +
      ".bf-field{display:flex;flex-direction:column;gap:6px;min-width:0;}" +
      ".bf-label{font-family:'Inter',system-ui,sans-serif;font-size:13px;font-weight:500;color:var(--ink-2,#18181b);letter-spacing:-0.01em;}" +
      ".bf-label span{color:#c0473f;}" +
      ".bf-input{font-family:'Inter',system-ui,sans-serif;font-size:14.5px;color:var(--ink,#09090b);background:var(--surface,#fff);" +
      "border:1px solid var(--line,#e4e4e7);border-radius:var(--r,6px);padding:11px 13px;width:100%;line-height:1.4;" +
      "transition:border-color .18s var(--ease,ease),box-shadow .18s var(--ease,ease);-webkit-appearance:none;appearance:none;}" +
      ".bf-input::placeholder{color:var(--ink-4,#a1a1aa);}" +
      ".bf-input:focus{outline:none;border-color:var(--ink,#09090b);box-shadow:0 0 0 3px rgba(9,9,11,0.08);}" +
      ".bf-textarea{resize:vertical;min-height:108px;line-height:1.55;font-family:'Inter',system-ui,sans-serif;}" +
      ".bf-hp{position:absolute !important;left:-9999px !important;width:1px;height:1px;opacity:0;}" +
      ".bf-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:2px;}" +
      ".bf-submit{display:inline-flex;align-items:center;gap:8px;font-family:'Inter',system-ui,sans-serif;font-weight:600;font-size:14.5px;" +
      "color:#fff;background:var(--ink,#09090b);border:0;border-radius:999px;padding:12px 22px;cursor:pointer;" +
      "transition:transform .2s var(--ease,cubic-bezier(.22,1,.36,1)),background .2s ease,opacity .2s ease;}" +
      ".bf-submit:hover{transform:translateY(-2px);background:var(--ink-2,#18181b);}" +
      ".bf-submit:focus-visible{outline:2px solid var(--ink,#09090b);outline-offset:3px;}" +
      ".bf-submit:disabled{opacity:.6;cursor:default;transform:none;}" +
      ".bf-note{font-family:'JetBrains Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-4,#71717a);}" +
      ".bf-status{font-size:13px;color:var(--ink-3,#3f3f46);min-height:0;}" +
      ".bf-status:empty{display:none;}" +
      ".bf-sink{display:none;}" +
      ".bf-thanks{text-align:center;padding:34px 20px 30px;}" +
      ".bf-thanks:focus{outline:none;}" +
      ".bf-thanks-icon{width:46px;height:46px;border-radius:50%;background:var(--good,#16a34a);color:#fff;display:grid;place-items:center;margin:0 auto 16px;}" +
      ".bf-thanks h3{font-family:'Inter',system-ui,sans-serif;font-weight:700;font-size:19px;letter-spacing:-0.02em;color:var(--ink,#09090b);margin:0 0 6px;}" +
      ".bf-thanks p{color:var(--ink-3,#3f3f46);font-size:14.5px;line-height:1.6;max-width:38ch;margin:0 auto;}" +
      ".bf-thanks .bf-safety{margin-top:14px;font-size:12.5px;color:var(--ink-4,#71717a);}" +
      ".bf-thanks .bf-safety a{color:var(--ink-2,#18181b);text-decoration:underline;text-underline-offset:2px;}" +
      ".bf-status a{color:var(--ink,#09090b);font-weight:600;text-decoration:underline;text-underline-offset:2px;}" +
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
      "@media (prefers-reduced-motion:reduce){.lf-fab,.bf-submit{transition:opacity .2s ease;}.lf-fab:hover,.bf-submit:hover{transform:none;}}";
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
