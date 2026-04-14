const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).filter(line => !line.trim().startsWith('#')).map(line => { const idx = line.indexOf('='); return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')]; }));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const eventRow = await supabase.from('events').select('id,name').limit(1).maybeSingle();
  if (eventRow.error) throw eventRow.error;
  const rpcResult = await supabase.rpc('get_event_page_detail', { p_event_id: eventRow.data.id });
  if (rpcResult.error) throw rpcResult.error;
  const payload = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  const output = {
    eventId: eventRow.data.id,
    eventName: eventRow.data.name,
    payload,
  };
  fs.writeFileSync('tmp_event_page_detail_payload.json', JSON.stringify(output, null, 2));
  console.log(JSON.stringify({ eventId: output.eventId, eventName: output.eventName, file: 'tmp_event_page_detail_payload.json' }, null, 2));
})().catch(err => { console.error(JSON.stringify({ fatal: String(err), stack: err?.stack || null }, null, 2)); process.exit(1); });
