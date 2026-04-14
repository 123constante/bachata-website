#!/usr/bin/env node

import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(line => !line.trim().startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx), line.slice(idx + 1).replace(/^"|"$/g, '')];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

(async () => {
  try {
    console.log('\n📋 CANCELLED OCCURRENCE PROOF TEST\n');

    // Step 1: Query for any published event
    console.log('Step 1: Finding a published event...');
    const { data: events, error: eventError } = await supabase
      .from('events')
      .select('id, name, is_published')
      .eq('is_published', true)
      .limit(1);

    if (eventError) throw eventError;
    if (!events || events.length === 0) {
      console.log('❌ No published events found\n');
      process.exit(1);
    }

    const testEventId = events[0].id;
    console.log(`✅ Found event: ${events[0].name} (${testEventId})\n`);

    // Step 2: Call get_event_page_snapshot RPC
    console.log('Step 2: Calling get_event_page_snapshot RPC...');
    const { data: snapshot, error: rpcError } = await supabase.rpc('get_event_page_snapshot', {
      p_event_id: testEventId,
    });

    if (rpcError) {
      console.log(`❌ RPC error: ${rpcError.message}\n`);
      process.exit(1);
    }

    console.log('✅ RPC returned successfully\n');

    // Step 3: Inspect snapshot structure
    console.log('Step 3: Validating snapshot structure...');

    if (!snapshot) {
      console.log('❌ Snapshot is null\n');
      process.exit(1);
    }

    const occEffective = snapshot.occurrence_effective;

    if (!occEffective) {
      console.log('ℹ️  No occurrence_effective (event may not have occurrences yet)\n');
      console.log('📝 Snapshot keys:', Object.keys(snapshot));
      console.log('   To test the fix, navigate to: http://localhost:8082/events/' + testEventId + '\n');
      process.exit(0);
    }

    console.log('✅ occurrence_effective present');
    console.log(`   Keys: ${Object.keys(occEffective).join(', ')}\n`);

    // Step 4: Check for is_cancelled field
    console.log('Step 4: Checking for is_cancelled field...');
    if ('is_cancelled' in occEffective) {
      console.log(`✅ is_cancelled field present: ${occEffective.is_cancelled}\n`);

      if (occEffective.is_cancelled) {
        console.log('🎯 Found a CANCELLED occurrence!\n');
        console.log(`📋 Proof test event:`);
        console.log(`   Event: ${events[0].name}`);
        console.log(`   Event ID: ${testEventId}`);
        console.log(`   Occurrence ID: ${occEffective.occurrence_id}`);
        console.log(`   Is Cancelled: true\n`);

        console.log(`🌐 Navigate to this URL in browser:`);
        console.log(`   http://localhost:8082/events/${testEventId}\n`);

        console.log('Expected to see:');
        console.log('  ✓ Red "Cancelled" badge in Schedule section');
        console.log('  ✓ Attendance section visible (not hidden)');
        console.log('  ✓ RSVP button disabled with "Event Cancelled" label');
        console.log('  ✓ Helper text below button\n');
      } else {
        console.log('ℹ️  Occurrence exists but is NOT cancelled\n');
        console.log(`📋 Event for testing (not cancelled, but ok for smoke test):`);
        console.log(`   Event: ${events[0].name}`);
        console.log(`   Event ID: ${testEventId}\n`);

        console.log('📝 Snapshot shows is_cancelled field is working in RPC response.\n');
        console.log(`🌐 Navigate to: http://localhost:8082/events/${testEventId}\n`);
        console.log('Expected to see:');
        console.log('  ✓ NO "Cancelled" badge (not cancelled)');
        console.log('  ✓ Attendance section visible');
        console.log('  ✓ RSVP button active/enabled\n');
      }
    } else {
      console.log('❌ is_cancelled field NOT present in occurrence_effective\n');
      console.log(`   Fields found: ${Object.keys(occEffective).join(', ')}\n`);
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error('\n❌ ERROR:', err.message, '\n');
    process.exit(1);
  }
})();
