-- Migration: 20260207150000_add_dancers_is_public.sql
-- Description: Add is_public column to dancers.

ALTER TABLE public.dancers
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

COMMENT ON COLUMN public.dancers.is_public IS 'Whether a dancer profile is publicly visible.';
