import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(l => !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; })
);

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  // ── 1. Get all published events ──────────────────────────────────────────
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, name, is_published')
    .eq('is_published', true)
    .limit(10);
  if (evErr) throw evErr;
  console.log(`Found ${events.length} published events`);

  // ── 2. For each event, call the RPC and check occurrence_effective ────────
  for (const ev of events) {
    const { data: snap, error: rpcErr } = await sb.rpc('get_event_page_snapshot', { p_event_id: ev.id });
    if (rpcErr) { console.log(`  ⚠️  ${ev.name}: RPC error – ${rpcErr.message}`); continue; }
    const occ = snap?.occurrence_effective;
    if (!occ) { console.log(`  –  ${ev.name}: no occurrence_effective`); continue; }
    console.log(`  ${occ.is_cancelled ? '🔴' : '🟢'} ${ev.name} | occ ${occ.occurrence_id} | is_cancelled=${occ.is_cancelled}`);
    if (occ.is_cancelled) {
      console.log(`\n✅ FOUND CANCELLED OCCURRENCE`);
      console.log(`   Event ID:       ${ev.id}`);
      console.log(`   Occurrence ID:  ${occ.occurrence_id}`);
      console.log(`   URL: http://localhost:8082/events/${ev.id}?occurrenceId=${occ.occurrence_id}`);
      process.exit(0);
    }
  }

  // ── 3. None found – create one on the first event that has an occurrence ──
  console.log('\nNo cancelled occurrences found. Will create one via direct insert.\n');

  // Find first event with any occurrence
  for (const ev of events) {
    const { data: snap } = await sb.rpc('get_event_page_snapshot', { p_event_id: ev.id });
    const occ = snap?.occurrence_effective;
    if (!occ?.occurrence_id) continue;

    console.log(`Using event: ${ev.name} (${ev.id})`);
    console.log(`Occurrence to cancel: ${occ.occurrence_id}`);

    // Try to flip is_cancelled on the existing occurrence row
    const { data: updated, error: upErr } = await sb
      .from('event_occurrences')
      .update({ is_cancelled: true })
      .eq('id', occ.occurrence_id)
      .select('id, is_cancelled')
      .single();

    if (upErr) {
      console.log(`❌ Could not update occurrence: ${upErr.message}`);
      console.log('   (RLS may restrict anon writes – need service-role or a seeded row)');
      process.exit(2);
    }

    console.log(`✅ Marked occurrence ${updated.id} as cancelled`);

    // Verify round-trip through RPC
    const { data: snap2 } = await sb.rpc('get_event_page_snapshot', {
      p_event_id: ev.id,
      p_occurrence_id: occ.occurrence_id,
    });
    const occ2 = snap2?.occurrence_effective;
    console.log(`\nRPC re-check: occurrence_effective.is_cancelled = ${occ2?.is_cancelled}`);

    if (occ2?.is_cancelled !== true) {
      console.log('❌ RPC still reports cancelled=false after update. Possible caching or view lag.');
      process.exit(3);
    }

    console.log(`\n✅ READY FOR BROWSER PROOF`);
    console.log(`   URL: http://localhost:8082/events/${ev.id}?occurrenceId=${occ.occurrence_id}`);
    process.exit(0);
  }

  console.log('\n❌ Could not find or create a cancelled occurrence with anon key.');
  console.log('   Need to seed a cancelled occurrence row via service-role or Supabase Studio.');
  process.exit(4);
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
