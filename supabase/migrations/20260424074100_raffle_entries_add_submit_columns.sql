-- =============================================================================
-- Raffle Phase 1 — pre-RPC amendment: add event_raffle_entries columns
-- -----------------------------------------------------------------------------
-- Adds the three columns submit_raffle_entry (next migration) expects but
-- that the Commit 2 schema did not land:
--
--   first_name       text  — captured at public submission (1-80 chars,
--                            validated in the RPC)
--   consent_version  text  — GDPR marketing-consent version string captured
--                            at submission time
--   session_id       uuid  — optional anonymous session pointer
--
-- All three are nullable at this stage so this migration is safe against any
-- pre-existing rows. The table was created yesterday and public writes have
-- been blocked until the RPC lands, so the expected pre-existing row count
-- is 0 — but we don't gamble on that, we stay additive.
--
-- Tightening to NOT NULL (likely on first_name and consent_version once the
-- RPC is the exclusive write path) is deferred to a follow-up so this file
-- stays strictly additive and idempotent.
--
-- Also tightens chk_raffle_phone_e164 to match the RPC's public validator
-- (^\+[1-9][0-9]{7,14}$, i.e. 8-15 digits after +) instead of the previous
-- looser ^\+[1-9][0-9]{1,14}$ (2-15 digits). Symmetrises the hard-floor
-- CHECK with the public gate in submit_raffle_entry so direct admin inserts
-- cannot land a phone that the public path would reject.
-- =============================================================================

BEGIN;

ALTER TABLE public.event_raffle_entries
  ADD COLUMN IF NOT EXISTS first_name      text,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS session_id      uuid;

ALTER TABLE public.event_raffle_entries
  DROP CONSTRAINT IF EXISTS chk_raffle_phone_e164;

ALTER TABLE public.event_raffle_entries
  ADD CONSTRAINT chk_raffle_phone_e164
    CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

COMMIT;

NOTIFY pgrst, 'reload schema';
