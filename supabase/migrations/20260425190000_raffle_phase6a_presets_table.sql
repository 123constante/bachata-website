-- ============================================================================
-- Raffle Phase 6A — raffle_presets table + events.raffle_preset_id FK
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 19:00:00 so it orders
-- after Phase 5E (20260425180000).
--
-- Creates the preset library that Phase 6 builds on. Two seeded presets at
-- launch per Ricky's locked decision (2026-04-24): "Class + party entry" and
-- "One class entry", both with a 120-minute (2-hour) cutoff offset.
--
-- Also extends the existing trg_sync_raffle_flag so events.has_raffle reflects
-- either a preset OR a legacy meta_data.raffle config. Preset-first read
-- logic lands in Phase 6B; this migration is schema-only for the server and
-- invisible to every existing caller except via the trigger side-effect.
--
-- One data fix bundled in: auto-link event 0b38cc32-2aff-408c-ac13-301c15a99208
-- (Monthly Latin Fridays) to the class-party preset, per Ricky's choice. This
-- also cleans up the pre-existing has_raffle=false anomaly — the trigger will
-- flip it to true on the UPDATE.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. raffle_presets table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.raffle_presets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text NOT NULL UNIQUE,
  name                    text NOT NULL,
  prize_text              text NOT NULL,
  cutoff_offset_minutes   int  NOT NULL CHECK (cutoff_offset_minutes >= 0 AND cutoff_offset_minutes <= 1440),
  show_winner_publicly    boolean NOT NULL DEFAULT false,
  consent_version         text NOT NULL DEFAULT 'v1',
  is_archived             boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              uuid REFERENCES auth.users(id),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.raffle_presets IS
  'Reusable raffle configurations. Events link to presets via events.raffle_preset_id. When linked, preset drives prize_text + cutoff derivation; when NULL, legacy meta_data.raffle (if present) is the fallback. See Phase 6 plan in workspace.';

COMMENT ON COLUMN public.raffle_presets.cutoff_offset_minutes IS
  'Minutes before event.start_at at which raffle entries close. cutoff_time = (event.start_at - offset). 0-1440 range (max 24h before).';

-- Index on slug is implicit via UNIQUE.
-- Index on is_archived for the default list filter.
CREATE INDEX IF NOT EXISTS idx_raffle_presets_active
  ON public.raffle_presets (is_archived, slug)
  WHERE is_archived = false;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Seed presets (idempotent via ON CONFLICT slug)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.raffle_presets (slug, name, prize_text, cutoff_offset_minutes, show_winner_publicly, consent_version)
VALUES
  ('class-party', 'Class + party entry', '1× free entry to next class and party', 120, false, 'v1'),
  ('class-only',  'One class entry',     '1× free class',                          120, false, 'v1')
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. events.raffle_preset_id FK column
-- ─────────────────────────────────────────────────────────────────────────────
-- RESTRICT on delete — if any events reference a preset, admin must unlink
-- before archiving. admin_archive_raffle_preset_v1 (Phase 6C) enforces this
-- at the RPC layer before the FK gets a chance.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS raffle_preset_id uuid REFERENCES public.raffle_presets(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_events_raffle_preset_id
  ON public.events (raffle_preset_id)
  WHERE raffle_preset_id IS NOT NULL;

COMMENT ON COLUMN public.events.raffle_preset_id IS
  'Optional FK to raffle_presets. When set, the preset drives prize_text and cutoff_time. Mutually exclusive with a populated meta_data.raffle (admin RPCs enforce the XOR; manual SQL writers should pick one).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update trg_sync_raffle_flag to OR preset + meta_data
-- ─────────────────────────────────────────────────────────────────────────────
-- Read live body: pg_get_functiondef on 2026-04-24 before editing. Original
-- rule was presence of meta_data.raffle only. New rule adds preset_id as an
-- additional trigger for has_raffle=true. Semantics:
--
--   has_raffle =
--     (raffle_preset_id IS NOT NULL)
--     OR (meta_data.raffle exists and is not JSON null)
--
-- An event can have both (temporarily — admin RPCs clean this up). Either
-- alone is enough to mark the event as raffle-enabled for picker visibility.

CREATE OR REPLACE FUNCTION public.sync_raffle_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.has_raffle := (
    NEW.raffle_preset_id IS NOT NULL
    OR (
      NEW.meta_data IS NOT NULL
      AND NEW.meta_data ? 'raffle'
      AND NEW.meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
    )
  );
  RETURN NEW;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Auto-link Monthly Latin Fridays to the class-party preset
-- ─────────────────────────────────────────────────────────────────────────────
-- Per Ricky's 2026-04-24 decision. Fixes the pre-existing has_raffle=false
-- anomaly by routing MLF through the new preset path. The sync_raffle_flag
-- trigger (BEFORE UPDATE) will flip has_raffle to true as a side-effect.
-- Leaves meta_data.raffle intact as historical fallback — harmless under the
-- new preset-first read path (Phase 6B).

UPDATE public.events
   SET raffle_preset_id = (SELECT id FROM public.raffle_presets WHERE slug = 'class-party'),
       updated_at = now()
 WHERE id = '0b38cc32-2aff-408c-ac13-301c15a99208'::uuid
   AND raffle_preset_id IS NULL;  -- idempotent — no-op on replay

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants — anon can SELECT presets (they're visible on the public site via
--    get_event_raffle's preset resolution in Phase 6B). authenticated has the
--    same read access. Writes are locked behind admin RPCs only.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.raffle_presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS raffle_presets_public_read ON public.raffle_presets;
CREATE POLICY raffle_presets_public_read
  ON public.raffle_presets
  FOR SELECT
  TO anon, authenticated
  USING (is_archived = false);

-- No INSERT / UPDATE / DELETE policies — all mutations go through SECURITY
-- DEFINER admin RPCs shipping in Phases 6C / 6D.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Schema reload
-- ─────────────────────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
