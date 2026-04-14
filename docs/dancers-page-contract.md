🧾 Dancers Page Product & Design Contract (MVP)
1. Core Identity

Purpose
Enable community-first discovery of Bachata dancers inside a trusted public directory.

Not a dating surface.
Not a social feed.
Not a ranking leaderboard.

Primary function:

Community visibility → Profile discovery → Login → Full profile access

2. Scope (MVP Only)
Included

Public dancer directory

Stats strip showing approved counts: total_dancers, dancers_by_city (count), dancers_by_role (breakdown)

Primary filters: Name search, City, Role

Secondary filters: Nationality, Years dancing (bracket-based)

Profile cards with limited public info

Login-gated full profile view

Logged-out teaser profile access state (page remains open, some sections softly locked)

Light "Join the directory" conversion CTA (shown to unauthenticated visitors)

Basic trust & safety controls (report/block on full profile)

Excluded (MVP)

Chat/messaging

Followers/likes

Ranking badges

Gamification

Leaderboards

Public contact info

Social graph

Dating framing

3. UX Structure (Top to Bottom)

Sticky top nav (global)

Clean hero section with community framing (no heavy side panels)

Stats strip (total dancers, cities, role breakdown)

Filter bar: name search input + city/role chips (primary), nationality + years-dancing chips (secondary, behind toggle)

Results header (count)

Dancer card grid (4 desktop / 3 tablet / 2 mobile)

"Join the directory" CTA card (shown to unauthenticated visitors)

Public profile detail page with visible identity section + locked teaser sections for anonymous visitors

Global footer

Max width: ~1200px (max-w-6xl)

4. Default Behaviour Rules
Page Load

Auto-select city (priority order):

URL param

Last selected city

Geolocation (if allowed)

Default city fallback

No role/nationality filters active by default

Nationality stays secondary in the visual hierarchy

Skeleton grid shows while loading

Sorting

Default: “Most Relevant”

Relevance order:

Same city

Recent activity

Profile completeness

Recently updated

Name A–Z (tie-breaker)

No visible ranking indicators.

5. Filter Behaviour Contract

Filters are horizontal chips (not form fields)

Desktop: dropdown

Mobile: bottom sheet

Selection applies instantly

Active filters show filled style + “x” to clear

Clear resets role/nationality but keeps city

Name search, City, and Role are primary filters

Nationality and Years dancing (bracket-based: <1 yr, 1–3 yrs, 4–7 yrs, 8+ yrs) are secondary filters, tucked behind a "More filters" toggle

Filters with zero available options are hidden

Filter values that would produce zero results are hidden (not disabled)

6. Card Structure (Public View)

Each card contains:

Profile image or neutral non-initial placeholder

For logged-out users with a photo: premium blurred / frosted image treatment so faces are not clearly visible

First name only

City

Nationality (flag + label) when available

Subtle nationality flag overlay on top of the photo surface when available

Role badge

Optional years dancing as muted supporting text

Footer helper copy inside the card surface:

Public: Sign in to see full profile

Logged-in: Open full profile

No surnames.
No initials fallback (uses neutral UserRound icon placeholder).
No styles on public cards by default.
No contact info.
No social links.
No separate View Profile button — full card is clickable.

Logged-out users can still click cards and open the profile page.

Logged-in users see the same cards with clear profile images and no blur treatment.

7. Login Gating Flow

Public click on card:

→ Opens the profile page directly
→ Keeps identity details visible
→ Soft-locks selected sections with blurred teaser treatment
→ Uses calm CTA copy such as “Join to unlock full profiles” / “Create your profile to view full member details”

After login:
→ Return to exact same state
→ Preserve filters
→ Preserve scroll position

Do not hard-block the directory behind auth.

Do not hard-block the profile route before teaser content is shown.

8. Conversion Principles

Hero primary CTA: identity-based, not desperate

Locked card appears adaptively (never aggressive)

Footer strip: subtle, not banner-heavy

Max 2 strong CTAs per view

Do not frame the page around finding a dance partner or practice partner

Use privilege framing:

“Members see full profiles”

“Visible to logged-in community members”

No urgency timers.
No manipulative scarcity.

9. Trust & Safety Contract

Public data minimal by default

Report/Block only in full profile view

Placed in “More” (three-dot) menu

Calm confirmation copy

No red alarm tones

Rate limiting on rapid profile viewing

Language tone: warm, controlled, respectful

No visible moderation drama on grid.

Directory language should stay broad and community-led rather than partner-led.

10. Brand & Visual Identity Rules

Tone:
Warm, intimate, confident. “Bachata lounge.”

Dark theme:

Near-black base (warm tint)

Charcoal surfaces

Low-contrast borders

Orange as accent only

Orange usage:

Primary CTA

Active filter

Focus ring

Key counts

Never:

Large orange backgrounds

Neon glow

Loud badges

Motion:

200–300ms transitions

Glide, not bounce

Fade, not slide

Subtle elevation on hover

11. Fairness & Visibility Philosophy

No visible ranking hierarchy.
No paid priority in MVP.
No public “top dancer” signals.

Visibility is:

Relevant

Dynamic

Non-political

Future monetisation must not distort community trust.

12. Guardrails (Non-Negotiable)

Do NOT:

Turn into dating UI

Add chat to grid

Add likes/follows

Add gamified badges

Add leaderboard sorting

Add aggressive login walls

Overuse orange

Over-animate

End of Contract
