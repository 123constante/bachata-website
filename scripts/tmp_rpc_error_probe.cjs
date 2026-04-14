const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  const eventRow = await supabase.from('events').select('id').limit(1).maybeSingle();
  if (eventRow.error) throw eventRow.error;

  const rpcResult = await supabase.rpc('get_event_page_detail', { p_event_id: eventRow.data.id });
  console.log(JSON.stringify({ eventId: eventRow.data.id, error: rpcResult.error, hasData: Array.isArray(rpcResult.data) ? rpcResult.data.length : rpcResult.data }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({ fatal: String(error), stack: error && error.stack ? error.stack : null }, null, 2));
  process.exit(1);
});
