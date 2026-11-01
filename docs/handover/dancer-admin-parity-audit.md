# Audit: admin people profile vs Website dancer pages (read-only)

Ticket dt_1fdd89f40825. Website source read at `origin/claude/dancer-app-r1b` (PR #821). Admin source: `bachata-admin` `components/admin/people/` (PersonView, PersonViewRoleTabs, dancer/DancerExtrasSection). Prod counts: Supabase prod, SELECT counts only, 172 dancer profiles (83 active, 15 archived), 172 sidecar rows (`dancing_role_details`).

## Verdict (plain words)
**Safe to merge #821 as is.** Every field a dancer can truly enter or an admin can set appears on the public page or in /app, with two exceptions that affect very few real people: the admin "Description" box (9 dancers) is not shown anywhere on the new pages, and a dancer cannot add or remove gallery photos in /app (1 dancer has a gallery). Neither blocks the merge; both should be queued as follow-ups. Public page and /app were read from code and tests only, nothing was run on a phone.

## Field table
Legend: Public = /dancers/<slug>; App = /app edit (E = editable, V = view only).

| Field | Admin | Prod rows populated (of 172) | Public | /app | Note |
|---|---|---|---|---|---|
| first_name | edit | 124 | shown (name) | E | |
| surname | edit | 56 | shown unless hidden | E | |
| display_name | edit | 92 | shown (name) | E | |
| hide_surname_publicly | toggle | 0 on | honoured | E (switch) | privacy flag, correct |
| avatar_url | upload | 108 | shown | E (Change photo) | |
| cover_url | edit | 0 | not shown | no | nobody uses it; (C) |
| gallery_urls | edit | 1 | shown (max by GALLERY_MAX) | **MISSING** | see gap B1 |
| bio | edit | 0 | shown ("About") | E ("About me") | |
| description (admin "About > Description") | edit | 9 | **MISSING** (public reads bio only) | **MISSING** | gap A1 |
| dance_role | edit | 23 | shown | E | |
| nationality | edit | 18 | shown + flag | E | |
| based_city_id | edit | 102 | shown | E | |
| languages | edit | 12 | shown ("Speaks") | E | |
| instagram | edit | 16 | shown | E | |
| facebook | edit | 2 | shown | E | |
| website_url | edit | 58 | shown | E | |
| whatsapp | edit | 1 | shown only if flag on | E | |
| show_whatsapp_publicly | toggle | 171 on (but only 1 has a number) | honoured | E | privacy flag, correct |
| email | edit | 5 | not read by public columns | not editable | contact is private by design; show_contact_publicly is on for 0; (C) |
| phone | edit | 39 | not shown | not editable | private by design; (C) |
| show_contact_publicly | flag | 0 on | no control shown | no | nothing to expose today |
| dance_started_year | edit | 11 | shown ("N years dancing") | E ("Dancing since") | |
| favorite_styles | edit | 10 | shown | E | |
| favorite_songs | edit | 1 | shown ("My sound") | E | |
| achievements | edit | 1 | shown (highlights) | E | |
| looking_for_partner | toggle | 1 | shown ("Up for practice") | no edit (Home PartnerTile registers interest only) | gap B2 |
| partner_search_role / level / practice_goals / details | edit | 1 / 1 / 1 / 0 | shown in partner block | no edit | gap B2 |
| is_active / archived_at | admin | 83 active / 15 archived | gates page | not editable | admin-only (C) |
| claimed_by / invite | admin | 5 claimed | n/a | n/a | admin-only (C) |
| profile_source, person_entity_id, created_by, meta_data (0 rows) | internal | - | no | no | admin-only (C) |
| slug | auto | 172 | the URL | n/a | |

## Ranked gaps
**(A) Data the public page drops**
- A1. `description` (admin "Description", 9 dancers) never reaches the public page or /app, while `bio` (0 dancers) does. Likely the two fields are meant to be one; those 9 dancers' text is invisible on the new page. Needs an owner decision: map description into bio or show both.

**(B) Missing /app control for something the dancer owns**
- B1. Gallery photos: shown publicly, no add/remove in /app (1 dancer affected).
- B2. Partner search (looking-for-partner, role, levels, goals, details): shown publicly but only editable by admin; /app has only an interest button (1 dancer affected). Fine if partner search is deliberately admin-only for now.

**(C) Admin-only / private by design**: email, phone, show_contact_publicly (0 on), cover_url (0 rows), is_active, archived_at, claim/invite, profile_source and other internal columns.

## Not verified
Nothing was run in a browser or on a phone. The public RPC bodies (`get_public_dancer_extras_v1`, names RPC) were not read; their output was inferred from the client code and tests. Counts treat empty strings as empty. No personal data recorded.
