# City-First Backend AI Prompt

Use this prompt with your backend AI.

---

Implement a city-first backend for a dance events platform.

Context and goals:
- Users search by city/town, not by country.
- Country exists only as metadata for data quality/disambiguation.
- A profile has exactly one primary city.
- City is mandatory on all new writes for profiles, venues, and events.
- Existing rows without city are temporarily allowed (grandfathered).
- Canonical matching must be strict.
- Pilot cities to verify first: London, Madrid, Brighton.

Required design:
1) Canonical tables
- countries(code PK, name)
- cities(id UUID PK, name, slug UNIQUE, country_code FK, is_active)
- city_aliases(id UUID PK, city_id FK, alias, normalized_alias)

2) APIs / functions
- search_cities(query text, limit int default 20)
  - city-first search
  - returns city id, city name, city slug, country name
- is_valid_city_slug(slug text) returns boolean
- resolve_city(input text) (optional) returns canonical city

3) Rules and enforcement
- New/updated profile, venue, and event writes must resolve to a valid canonical city.
- Existing historical rows can remain during migration.
- Country should not be required in frontend UX unless needed to disambiguate duplicate city names.

4) Migration behavior
- Migrations must be idempotent and safe to rerun.
- Include backfill scripts from legacy text city fields to city_id/city_slug.
- Create unresolved_city_rows report/view for manual cleanup.

5) Security
- Respect current RLS.
- Keep city search public read.
- Restrict city catalog write operations to admins.

6) Output required
- SQL migrations (ordered)
- Verification SQL (happy path + failure path)
- Backfill progress queries
- Rollback notes

Implementation preference:
- Short slugs in URL are acceptable.
- Use city_id as source of truth internally.
- Show country only in ambiguous city matches.
