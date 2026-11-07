# Handover: ambassador badge

Done: AmbassadorBadge component + tests; wired into PersonHub and the tabbed PersonPage header; design record with INVENTORY.
Key finding: the public snapshot has no `user_id`. `person.id` is dancer_profiles.id; only 49 of 206 dancer profile ids equal an auth user id (prod, read-only count). The badge passes `person.id`, so it shows only for people whose profile id is their user id. 0 ambassadors exist on prod today. A correct fix needs a public id->user_id mapping (admin RPC), owner call.
Left: role pages (DJ/Teacher), 390x844 browser walk, city name (RPC returns boolean only), phone QA.
Not verified: browser walk, full CI chain, real ambassador (none on prod).
