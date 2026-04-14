const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const env = Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(Boolean).filter(line => !line.trim().startsWith('#')).map(line => { const idx = line.indexOf('='); return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')]; }));
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
(async () => {
  const sample = await supabase.from('venues').select('id,name,floor_type').limit(10);
  if (sample.error) throw sample.error;
  const nonNull = await supabase.from('venues').select('id,name,floor_type').not('floor_type','is',null).limit(20);
  if (nonNull.error) throw nonNull.error;
  console.log(JSON.stringify({ sample: sample.data, nonNull: nonNull.data }, null, 2));
})().catch(err => { console.error(JSON.stringify({ fatal: String(err), stack: err?.stack || null }, null, 2)); process.exit(1); });
