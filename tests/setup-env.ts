/**
 * Vitest pre-test environment loader.
 *
 * Loads .env into process.env so contract tests that hit the live database
 * can read VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY without each test
 * calling dotenv itself.
 *
 * Naming alias:
 *   The repo's .env uses Supabase's newer VITE_SUPABASE_PUBLISHABLE_KEY name.
 *   The Supabase JS client + many tests expect VITE_SUPABASE_ANON_KEY (the
 *   older name for the same public key). Mirror it here so both names work.
 */
import { config } from 'dotenv';

config({ path: '.env' });

if (!process.env.VITE_SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  process.env.VITE_SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}
