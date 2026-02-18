
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

// Load env
const envConfig = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '.env')))
const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRpc() {
  const rangeStart = new Date('2026-01-01').toISOString()
  const rangeEnd = new Date('2026-02-01').toISOString()

  console.log(`Querying range: ${rangeStart} to ${rangeEnd}`)

  const { data, error } = await supabase.rpc('get_calendar_events', {
    range_start: rangeStart,
    range_end: rangeEnd,
  })

  if (error) {
    console.error('RPC Error:', error)
  } else {
    console.log(`Found ${data.length} events`)
    if (data.length > 0) {
      console.log('Sample event:', JSON.stringify(data[0], null, 2))
    } else {
        // If no events found via RPC, let's query the events table directly to see if any exist
        const { data: rawEvents, error: rawError } = await supabase
            .from('events')
            .select('*')
            .limit(1)
        
        if (rawError) {
             console.log("Raw query error:", rawError);
        } else {
             console.log("Raw event sample (to update logic):", JSON.stringify(rawEvents[0], null, 2));
        }
    }
  }
}

testRpc()
