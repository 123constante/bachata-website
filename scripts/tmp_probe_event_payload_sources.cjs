const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).filter(line => !line.trim().startsWith('#')).map(line => { const idx = line.indexOf('='); return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')]; }));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const eventId = 'e2ac79c6-7a9c-4b9f-a7d9-5f7d9e454a99';
  const eventRes = await supabase.from('events').select('*').eq('id', eventId).maybeSingle();
  if (eventRes.error) throw eventRes.error;
  const venueRes = await supabase.from('venues').select('*').eq('id', eventRes.data.venue_id).maybeSingle();
  if (venueRes.error) throw venueRes.error;
  const occRes = await supabase.from('calendar_occurrences').select('*').eq('event_id', eventId).limit(3);
  if (occRes.error) throw occRes.error;
  const interestedRes = await supabase.from('event_participants').select('event_id,status', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'interested');
  if (interestedRes.error) throw interestedRes.error;
  const entityRes = await supabase.from('event_entities').select('*').eq('event_id', eventId);
  if (entityRes.error) throw entityRes.error;
  console.log(JSON.stringify({ event: eventRes.data, venue: venueRes.data, occurrences: occRes.data, interestedCount: interestedRes.count, eventEntities: entityRes.data }, null, 2));
})().catch(err => { console.error(JSON.stringify({ fatal: String(err), stack: err?.stack || null }, null, 2)); process.exit(1); });
