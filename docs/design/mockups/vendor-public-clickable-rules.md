# Vendor Public Page — Fully Clickable Rules

This rule set makes every meaningful UI element actionable and tied to an internal route.

## 1) Identity Layer
- Vendor name/logo/status pill -> vendor home
  - `/vendors/:slug`
- City/location chip -> directory filtered by city
  - `/discover?tag=:city`
- Shipping chip -> shipping-ready directory
  - `/discover?tag=shipsinternationally`

## 2) Categories as Hashtags
- Every category chip is a hashtag link
  - `#Dancewear` -> `/discover?tag=dancewear`
  - `#Heels` -> `/discover?tag=heels`
  - `#Accessories` -> `/discover?tag=accessories`
- Same hashtag behavior should be reused in:
  - Vendor cards
  - Product cards
  - Event vendor tags
  - Search suggestions

## 3) Contact & Conversion
- Primary CTA always routes through internal contact intent (not raw number text)
  - `/contact/vendor/:slug?channel=whatsapp&intent=order`
- Secondary CTA
  - `/vendors/:slug/store` or `/vendors/:slug/checkout`
- Remove duplicate phone-number display if WhatsApp CTA already exists.

## 4) Events
- Every event row/card links to event detail
  - `/events/:eventSlug`
- Event metadata chips (city/date/type) should also be clickable filters
  - `/events?city=:city`
  - `/events?date=:date`
  - `/events?tag=:tag`

## 5) Products
- Entire product card clickable
  - `/vendors/:slug/products/:productSlug`
- Price can link to direct checkout variant
  - `/vendors/:slug/checkout?product=:productSlug`
- Product tag hashtags clickable
  - `/discover?tag=:tag`

## 6) FAQ
- Each FAQ question clickable to anchored answer
  - `/vendors/:slug/faq#shipping`
- FAQ section title clickable to full FAQ page
  - `/vendors/:slug/faq`

## 7) Analytics / Trust Signals
- Ratings -> reviews page
  - `/vendors/:slug/reviews`
- KPI stats -> insights sub-pages
  - `/vendors/:slug/insights?metric=promo_ctr`

## 8) UX Guardrails
- Keep one primary CTA per viewport section.
- Keep link destinations semantic and predictable.
- Avoid dead-end clicks; each click must produce useful context.
- Use consistent URL grammar across modules.
