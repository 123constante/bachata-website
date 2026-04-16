-- ═══════════════════════════════════════════════════════════════════
-- Fix: Propagate event-level venue changes to calendar_occurrences
--
-- Root cause: admin_save_event_v2_impl updates events.venue_id but
-- does NOT update calendar_occurrences.venue_id. The public RPC
-- get_event_page_snapshot_v2 uses:
--   COALESCE(occurrence.venue_id, event.venue_id)
-- so stale occurrence venue_ids take priority over the corrected
-- event-level venue_id, showing the wrong venue on public pages.
--
-- Fix: After the events UPDATE in admin_save_event_v2_impl, propagate
-- the new venue_id (plus derived city_id and city_slug) to all
-- occurrences that were inheriting the old event-level venue.
-- Occurrences deliberately overridden to a different venue are left
-- untouched.
--
-- Also includes a one-time data fix for any events already affected.
-- ═══════════════════════════════════════════════════════════════════

-- ── Step 1: Patch admin_save_event_v2_impl ──────────────────────
-- We replace the function in its entirety because there's no way to
-- surgically insert lines into a PL/pgSQL body. The ONLY change is
-- a 15-line venue-propagation block inserted after the events UPDATE
-- (search for "VENUE PROPAGATION" below). Everything else is verbatim
-- from the production function captured in the baseline migration.
--
-- Because admin_save_event_v2_impl is large (~250 lines), and a copy
-- error here would be catastrophic, we take a safer approach: a small
-- trigger on the events table that fires AFTER UPDATE and propagates
-- the venue change. This is decoupled from the RPC body, works for
-- ANY code path that updates events.venue_id, and requires no
-- modification to admin_save_event_v2_impl at all.

-- ── Trigger function: propagate venue change to occurrences ──────
CREATE OR REPLACE FUNCTION public.propagate_event_venue_to_occurrences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_city_id  uuid;
  v_new_slug     text;
BEGIN
  -- Only act when venue_id actually changed
  IF NEW.venue_id IS NOT DISTINCT FROM OLD.venue_id THEN
    RETURN NEW;
  END IF;

  -- Resolve the new venue's city_id and city_slug for consistency
  IF NEW.venue_id IS NOT NULL THEN
    SELECT en.city_id, c.slug
    INTO v_new_city_id, v_new_slug
    FROM public.venues vv
    JOIN public.entities en ON en.id = vv.entity_id
    LEFT JOIN public.cities c ON c.id = en.city_id
    WHERE vv.id = NEW.venue_id
    LIMIT 1;
  END IF;

  -- Update occurrences that were inheriting the OLD event-level venue.
  -- Occurrences deliberately set to a different venue are left alone.
  UPDATE public.calendar_occurrences
  SET venue_id   = NEW.venue_id,
      city_id    = COALESCE(v_new_city_id, city_id),
      city_slug  = COALESCE(v_new_slug, city_slug),
      updated_at = now()
  WHERE event_id = NEW.id
    AND (venue_id = OLD.venue_id OR venue_id IS NULL);

  RETURN NEW;
END;
$$;

-- ── Attach trigger ───────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_propagate_event_venue ON public.events;
CREATE TRIGGER trg_propagate_event_venue
  AFTER UPDATE OF venue_id ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.propagate_event_venue_to_occurrences();

-- ── Step 2: One-time data fix ────────────────────────────────────
-- Sync all occurrences that are out of sync with their event's
-- current venue_id. This catches Wild Bachata and any other events
-- where the venue was changed but occurrences weren't updated.

UPDATE public.calendar_occurrences co
SET venue_id   = e.venue_id,
    city_id    = COALESCE(
      (SELECT en.city_id
       FROM public.venues vv
       JOIN public.entities en ON en.id = vv.entity_id
       WHERE vv.id = e.venue_id
       LIMIT 1),
      co.city_id
    ),
    city_slug  = COALESCE(
      (SELECT c.slug
       FROM public.venues vv
       JOIN public.entities en ON en.id = vv.entity_id
       LEFT JOIN public.cities c ON c.id = en.city_id
       WHERE vv.id = e.venue_id
       LIMIT 1),
      co.city_slug
    ),
    updated_at = now()
FROM public.events e
WHERE co.event_id = e.id
  AND e.venue_id IS NOT NULL
  AND co.venue_id IS DISTINCT FROM e.venue_id;

NOTIFY pgrst, 'reload schema';
