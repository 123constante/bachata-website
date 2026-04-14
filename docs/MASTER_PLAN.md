# Bachata Calendar Platform — Master Plan

## Current State (as of 2026-04-15)

### What's done
- Admin dashboard: event-people linking rebuilt with single authority (event_program_people)
- 8 Phase B migrations applied + 2 pre-B2 fixes
- Legacy dual-authority eliminated (replace_or_patch_lineup removed, event_profile_links frozen)
- Session identity stabilised (upsert by legacy_id)
- People tab (SessionPeopleLinkPanel) fully built with UX polish
- Festival schedule tab rewired to read from event_program_people
- Organiser save standardised (Phase A)
- Type definitions added (Phase C)
- Promo code alias created (Phase D)

### What's broken / incomplete
- Public website reads from event_profile_links (frozen) — lineup invisible for People-tab links
- 4 cleanup items not completed from rebuild audit (see Phase 0 below)
- Session identity stability not verified via SQL check
- Public site not tested on mobile
- Website repo potentially needs full rebuild

---

## PHASE 0 — Cleanup + Verification (0.5 day)

Complete the outstanding items from the rebuild audit:

| Task | File | Action |
|------|------|--------|
| Delete dead tab | components/events/studio/StandardLineupTab.tsx | Delete file |
| Clean dashboard | components/dashboard/EventDashboard.tsx:30-35 | Remove canonicalXxxIds mapping |
| Clean inheritance | lib/standardRecurringInstanceInheritance.ts:168-176 | Remove 5 canonical keys from TRACKED_FIELDS |
| Clean guest dancer | lib/guestDancerContract.ts:117 | Remove canonicalGuestDancerIds reference |
| Clean audit script | scripts/audit_festival_creation.ts:341-342 | Remove instructor_ids/dj_ids usage |

Verify session identity:
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'replace_event_program';
-- Must contain: ON CONFLICT (event_id, legacy_id) WHERE legacy_id IS NOT NULL DO UPDATE
```

Apply all pending migrations via supabase db push.

---

## PHASE 1 — Public Website (1-2 weeks)

### 1a. Update public RPCs to read from event_program_people
- Modify get_event_page_snapshot (v2 or v3) to read lineup from event_program_people
- Modify get_public_festival_detail to read lineup from event_program_people
- Festival schedule RPCs return per-session teacher/DJ names
- Remove all reads from event_profile_links in public RPCs

### 1b. Venue geocoding
- Add lat/lng columns to venues table
- One-time geocode all existing venue addresses (Google Geocoding API or OpenStreetMap Nominatim)
- Add geocoding to venue save flow (geocode on address change)

### 1c. Location-based discovery
- "Events near me" on public site — browser geolocation (on-demand, not stored)
- Sort/filter events by distance from user's position
- No user location stored in database — browser position used in query only

### 1d. SEO pages
- /[city] landing pages (e.g. /london, /manchester)
- /[city]/[area] pages (e.g. /london/south, /london/east)
- Target searches: "bachata classes near me", "bachata [city]", "Latin dance [area]"
- Open Graph tags for WhatsApp/social link previews

### 1e. Mobile-first public site
- All pages responsive at 375px
- Event cards, calendar grid, event detail pages tested on mobile
- "Events near me" works on mobile browsers

---

## PHASE 2 — User Accounts + Attendance (1-2 weeks)

### 2a. User signup/login
- Supabase Auth (email + social logins)
- Required city selection at signup (based_city_id from cities table)
- Auto-create dancer_profiles row on signup (trigger may already exist)

### 2b. "I'm attending"
- event_attendance table:
  - user_id FK → auth.users
  - event_id FK → events
  - program_item_id FK → event_program_items (optional — session-level)
  - status: 'attending' | 'interested' | 'cancelled'
  - created_at, updated_at
- "I'm attending" / "Interested" buttons on event pages
- Attendance count visible on event cards and detail pages
- "My events" page for logged-in users

### 2c. Organiser attendee visibility
- Organisers can see who's attending their events
- Basic list with count — premium analytics comes later (Phase 4)

---

## PHASE 3 — Ticketing (2-3 weeks) ← REVENUE STARTS HERE

### 3a. Stripe Connect
- Multi-organiser payouts via Stripe Connect
- Each organiser connects their Stripe account
- Platform takes 5% commission (configurable per subscription tier)

### 3b. Ticket types
- Per-event tickets (early bird, standard, VIP, door)
- Per-session tickets (workshop, bootcamp, masterclass)
- Festival passes (full pass, day pass, party-only)
- Free events remain free (no Stripe involved)

### 3c. Purchase flow
- Ticket selection → Stripe Checkout → confirmation + QR code
- ticket_purchases table:
  - user_id FK → auth.users
  - event_id FK → events
  - program_item_id FK → event_program_items (for session tickets)
  - ticket_type, amount, currency, stripe_payment_id
  - qr_code_data, checked_in, checked_in_at

### 3d. Organiser dashboard
- Revenue summary (total sales, commission deducted, payout amount)
- Ticket sales by type
- Refund handling
- Payout history

---

## PHASE 4 — Organiser Subscriptions (1-2 weeks)

### Tiers
| Feature | Free | Premium (£29/mo) | Pro (£79/mo) |
|---------|------|-----------------|-------------|
| List events | ✓ | ✓ | ✓ |
| Ticketing commission | 5% | 3% | 1.5% |
| Attendee list | Count only | Full list + city | Full + demographics |
| Analytics | Basic views | Trends + comparisons | Full + export |
| Featured placement | — | 2/month | Unlimited |
| Email attendees | — | ✓ | ✓ |
| API access | — | — | ✓ |
| Team accounts | — | — | Up to 5 |

### Implementation
- subscriptions table (organiser_entity_id, tier, stripe_subscription_id, billing_cycle)
- Entitlement check as RPC wrapper (clean insertion point per Claude Code audit)
- Billing management page
- Tier-based commission rates in ticketing flow

---

## PHASE 5 — Geographic Expansion (month 3+)

Per city:
- Partner with 3-5 local organisers
- Seed calendar with existing events
- City landing page + local SEO
- WhatsApp community integration

Target sequence:
1. London (current)
2. Manchester, Birmingham (month 3)
3. Bristol, Leeds, Edinburgh (month 4-5)
4. Barcelona, Berlin, Paris (month 6-9 — major bachata markets)

---

## PHASE 6 — AI + Automation (month 6-12)

- Analytics dashboards (attendance trends, revenue, demographics by city)
- AI lineup suggestions (based on event_program_people history)
- Auto-notifications (teacher linked to session → email)
- Auto-social posts (event + lineup → Instagram/WhatsApp formatted post)
- Inactive member detection (attendance patterns)
- AI-powered event recommendations for dancers

---

## Data Model Additions Summary

### Phase 0 (rebuild cleanup)
- No schema changes — code cleanup only

### Phase 1 (public site)
- venues: ADD lat numeric, lng numeric

### Phase 2 (attendance)
- NEW TABLE: event_attendance (user_id, event_id, program_item_id, status, timestamps)

### Phase 3 (ticketing)
- NEW TABLE: ticket_purchases (user_id, event_id, program_item_id, ticket_type, amount, currency, stripe_payment_id, qr_code_data, checked_in)
- event_program_items: ADD capacity integer (for session-level caps)

### Phase 4 (subscriptions)
- NEW TABLE: subscriptions (organiser_entity_id, tier, stripe_subscription_id, billing_cycle, status)
- NEW TABLE: entitlements (subscription_id, feature_key, limit_value)

### Phase 6 (AI/analytics)
- NEW TABLE: user_interactions (user_id, event_id, action_type, timestamp)
- NEW TABLE: analytics_snapshots (entity_id, entity_type, period, metrics_jsonb)
- NEW TABLE: notifications (recipient_id, type, payload, read_at, created_at)

---

## Revenue Timeline

| Month | Milestone | Estimated monthly revenue |
|-------|-----------|--------------------------|
| 1 | Public site live, users signing up | £0 |
| 2 | Ticketing live in London | £2,000-4,000 |
| 3 | 3 UK cities, organiser subscriptions | £5,000-8,000 |
| 6 | 8-10 cities, premium features | £15,000-30,000 |
| 9 | EU expansion, marketplace features | £40,000-70,000 |
| 12 | 20+ cities, AI tools, API | £80,000-150,000 |
| 18 | 40+ cities, brand partnerships | £150,000-300,000 |
| 24 | Market leader, 60+ cities | £300,000-500,000 |

---

## Priority Rules

1. Revenue features (ticketing, subscriptions) always come before polish
2. Public site always comes before admin improvements
3. Fix broken things before building new things
4. Launch early, iterate on live product — don't wait for perfection
5. Every feature must answer: "does this help acquire users or generate revenue?"
