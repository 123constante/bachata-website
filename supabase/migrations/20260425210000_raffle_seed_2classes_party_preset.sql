-- =============================================================================
-- Seed third raffle preset: "2 classes + party entry"
--
-- Adds the third standard preset Ricky uses in practice. Idempotent — re-runs
-- are no-ops thanks to the UNIQUE(slug) constraint + ON CONFLICT.
-- =============================================================================

INSERT INTO public.raffle_presets (slug, name, prize_text, cutoff_offset_minutes)
VALUES (
  '2-classes-party',
  '2 classes + party entry',
  '2× free entries to next class and party',
  120
)
ON CONFLICT (slug) DO NOTHING;
