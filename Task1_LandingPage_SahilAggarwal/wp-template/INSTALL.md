# Florida MMJ Landing — Install

## File map

```
your-theme/                          (or your child theme)
├── page-florida-mmj-card.php        ← drop in theme root
├── inc/
│   ├── section-hero.php
│   ├── section-how-it-works.php
│   ├── section-conditions.php
│   ├── section-doctors.php
│   ├── section-pricing.php
│   └── section-faq.php
├── assets/
│   ├── florida-mmj.css
│   └── florida-mmj.js
└── functions.php                    ← append contents of functions-additions.php
```

## Steps

1. Copy `page-florida-mmj-card.php` to your active theme (or child theme) root.
2. Copy `inc/` and `assets/` directories alongside it.
3. Append the contents of `functions-additions.php` to your theme's `functions.php`.
   - Or `require_once __DIR__ . '/inc/florida-mmj-functions.php';` if you prefer a separate file.
4. WP Admin → **Pages** → **Add New** → title "Florida Medical Marijuana Card — Get Yours in 24 Hours" → set slug to `florida-medical-marijuana-card`.
5. **Page Attributes** → Template → select **Florida MMJ Card Landing** → Publish.
6. (Optional but recommended) Install **ACF Pro**. The field group auto-registers and lets marketing edit hero copy, FAQs, prices, and CTAs without touching code. Without ACF, the literal defaults in each section partial render.

## Tracking

The page is pre-wired with three GTM-ready dataLayer events:

| Event           | Pushed when                                             |
| --------------- | ------------------------------------------------------- |
| `cta_click`     | Any `[data-cta]` link/button is clicked                 |
| `faq_open`      | A FAQ row is expanded                                   |
| `scroll_depth`  | First time the user crosses 25 / 50 / 75 / 100% scroll  |

A page-load push also seeds `page_type`, `page_state`, `product_type`, and `consent_state`. **No PII is pushed at the landing-page layer** — patient identifiers fire only from the server-rendered thank-you page (see Task 2 GA4 spec).

## Validation checklist

- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95
- [ ] GTM Preview mode shows `cta_click`, `faq_open`, `scroll_depth` firing
- [ ] FAQ JSON-LD validates in Rich Results Test
- [ ] Page renders correctly with **and** without ACF Pro (graceful fallback)
- [ ] All `[data-cta]` selectors stable for GTM trigger config
