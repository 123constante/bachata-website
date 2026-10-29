# Brief: Bristol ambassador audit (read-only, careful lane, Opus)

Branch `claude/bristol-ambassador-audit` (Website repo). Output ONLY `docs/audits/bristol-ambassador-audit-2026-10-29.md`. No code, no migration, no prod write. Supabase read-only (counts and catalog reads, project stsdtacfauprzrdebmzg; no personal data).

Owner decisions to design against (source: ~/.claude/plans/PLAN-bristol-launch.md is local, so they are repeated here):
- Ambassador = recruiter + moderator, NOT gatekeeper. Organisers join freely; their page and events are held for review; the ambassador approves or rejects in one tap for their own city (pages AND events); the owner/admin can override everything.
- Ambassador's own events skip review. Rejection = a short reason chosen from a list; the organiser can fix and resubmit. Removal/suspension goes through the owner only.
- Items held 3 days with no review escalate to the owner.
- One permanent personal invite link per ambassador (owner or ambassador can switch it off). Anyone joining through it gets that city as their city. Audience: organisers only for now.
- Tracker (invited / joined / has set the city) visible to the ambassador and the owner only.
- Badge "<City> ambassador" on their profile and next to their name on events they approve.
- One city per ambassador. City stays inactive (hidden from picker/sitemap/search) until the owner activates it.

Answer, with file:line and live-DB evidence:
1. What already exists: the `ambassador` member_role (entity_members, city-only), `admin_list_pending_review_v1`, the A0a moderation and A0b review-gate functions and their tests. Which of the decisions above does it already satisfy? Which are missing (own-events-skip, reason list, 3-day escalation, link, tracker, badge)?
2. Invite plumbing: the organiser-invite tables/RPCs, `prefill_city_id`, expiry, one-live-link rule, admin-only gate. What is the smallest change that gives a revocable permanent per-ambassador link with `invited_by` tracking?
3. How a person who joins by link ends up with city = Bristol while Bristol is inactive (search_cities `is_active` filter is the known blocker). Smallest safe fix; confirm no other RPC fails for an inactive city.
4. Live data shapes (counts only): ambassadors, pending items by status, invites by state, organisers per city.
5. Proposed slice list (admin DB slices vs Website slices), each with lane (normal/careful), model per the routing table, and what needs a Design Gate mockup (tracker, badge, held state, reason list).
6. Risks and questions that are a genuine owner product choice (max 3), written as click-question options.

Stop after pushing the audit. Last commit subject ends with the done marker you are given.
