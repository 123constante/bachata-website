const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).filter(line => !line.trim().startsWith('#')).map(line => { const idx = line.indexOf('='); return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')]; }));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const probes = {};
  probes.hide_surname = await supabase.from('dancers').select('id,first_name,surname,hide_surname').limit(1);
  probes.hide_last_name = await supabase.from('dancers').select('id,first_name,surname,hide_last_name').limit(1);
  probes.sample = await supabase.from('dancers').select('*').limit(1);
  console.log(JSON.stringify(probes, null, 2));
})().catch(err => { console.error(JSON.stringify({ fatal: String(err), stack: err?.stack || null }, null, 2)); process.exit(1); });
