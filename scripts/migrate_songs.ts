import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { MOCK_TRACKS } from '../src/constants/mockSongs.ts';

// Ensure env vars are loaded (e.g. via Bun or --env-file)
const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').replace(/"/g, '').trim();
const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').replace(/"/g, '').trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.');
  console.error('Please ensure they are set in your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  console.log(`Starting migration of ${MOCK_TRACKS.length} songs...`);
  
  const BATCH_SIZE = 50;
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < MOCK_TRACKS.length; i += BATCH_SIZE) {
    const batch = MOCK_TRACKS.slice(i, i + BATCH_SIZE).map(track => ({
      title: track.title,
      artist: track.artist,
      genre: track.genre || 'bachata', // Default to bachata if missing
    }));

    const { error } = await supabase
      .from('songs')
      .upsert(batch, { onConflict: 'title,artist', ignoreDuplicates: true });

    if (error) {
      console.error(`Error migrating batch ${i} - ${i + BATCH_SIZE}:`, error.message);
      errorCount += batch.length;
    } else {
      successCount += batch.length;
      process.stdout.write(`\rProcessed ${successCount}/${MOCK_TRACKS.length} songs...`);
    }
  }

  console.log('\nMigration complete.');
  console.log(`Successfully added: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
}

migrate().catch(console.error);
