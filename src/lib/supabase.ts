// Single Supabase client for the app. This module previously created its own
// client, producing a second GoTrueClient on the same auth storage key (the
// "Multiple GoTrueClient instances" warning + a token-refresh race). It now
// re-exports the canonical typed client so exactly one client exists (audit #2).
export { supabase } from '@/integrations/supabase/client';
