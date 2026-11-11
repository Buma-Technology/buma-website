# Website V7 — Pre-Launch Checklist

**Hosting decision:** Cloudflare Pages (free, unlimited bandwidth, global edge, serves the static files as-is).
**Current live site:** WordPress 7.0 + Elementor at bumatechnology.com (the OLD site V7 replaces).

**Go-live sequence:** deploy V7 to a Cloudflare Pages `*.pages.dev` staging URL now → clear the list below → point `bumatechnology.com` DNS at Cloudflare to go live (no downtime to the current site until cutover).

---

## Must-fix before the domain cutover

- [x] **Lead form — RESOLVED (V8).** Replaced the blank login-gated `vbuma.io/LeadForm` with a native, on-brand contact form wired to JotForm (form `261695091611054`). It matches the site's design (Inter, light surface, ink button — not JotForm's theme) and appears site-wide: a floating "Let's Talk" button + accessible modal on every page, plus the 7 inline form sections — all driven by the shared `/leadform.js`. Submissions post to JotForm's backend; a honeypot + JotForm Smart CAPTCHA guard against spam. **Final check before/at go-live:** submit the form once from a real browser and confirm the lead lands in the JotForm inbox.
- [ ] **Lead form → Buma CRM (PR `buma-crm-lead-form`, not released).** `/leadform.js` now renders a native form that posts to the Buma CRM form "Website Lead Intake" (CRM id `6af3bc26b504b7a25ac32b99`) instead of the JotForm iframe. Before merge: publish the form in Buma CRM, paste its public token into `CRM_FORM_TOKEN`, run one synthetic test, confirm the contact lands tagged `website` and the owner email arrives. Rollback: revert the commit (restores the JotForm embed).

- [ ] **Real GA4 Measurement ID** — currently a placeholder `G-XXXXXXXXXX` (tracking nothing). Create a GA4 property for bumatechnology.com → paste the real `G-...` ID → swap into all pages.

- [ ] **301 redirect map** — old WordPress URLs change in V7. Build into V7's `_redirects`. Known changes:
  - `/contact-us/` → `/contact`
  - `/portfolio/`, `/works/` → `/work`
  - old `/services/` + service pages → new service pages (`/netsuite-integration`, `/celigo-ipaas`, `/ai-automation`, `/dashboards`)
  - WordPress junk (`/sample-page/`, `/item-5/`, `/portfolio-item-1..4/`, `/coming-soon/`, `/category/*`, `/author/*`, Elementor template pages) → home or drop

- [ ] **5 live blog posts not in V7** — currently indexable integration content; will 404 if dropped. Either recreate in V7 or 301 to the closest page:
  - Breaking Free from Legacy EDI…
  - EDI Without the Headaches…
  - From Quoting to Cash Flow…
  - The Returns Avalanche…
  - When the Orders Don't Stop…

## Nice-to-have (can ship after launch)

- [ ] Image optimization — convert PNGs to WebP/AVIF (Cloudflare Polish can auto-do this for free)
- [ ] Sitemap `<lastmod>` dates (currently missing)
- [ ] `llms.txt` for AI-search visibility (ChatGPT / Perplexity / AI Overviews)
- [ ] Add `BreadcrumbList` + `Article`/`BlogPosting` + `WebSite` schema (Organization/FAQPage/Service already present)
- [ ] `_headers` file for long-cache `Cache-Control` on static assets

## Strategic (post-launch, for SEO dominance)

- [ ] Rebuild as Next.js (SSG + ISR) to unlock programmatic SEO + AI content pipeline (the path to scaling integration pages — Zapier-style). Static V7 is great for launch but can't scale content by hand.
