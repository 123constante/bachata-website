const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).filter(line => !line.trim().startsWith('#')).map(line => { const idx = line.indexOf('='); return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')]; }));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const eventId = 'e2ac79c6-7a9c-4b9f-a7d9-5f7d9e454a99';
  const rpcResult = await supabase.rpc('get_event_page_detail', { p_event_id: eventId });
  if (rpcResult.error) throw rpcResult.error;
  const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  console.log(JSON.stringify({ eventId, venueFloorType: row?.venue?.floor_type, venue: row?.venue }, null, 2));
})().catch(err => { console.error(JSON.stringify({ fatal: String(err), stack: err?.stack || null }, null, 2)); process.exit(1); });
