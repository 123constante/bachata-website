
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Simple .env parser since we might not have dotenv
const envContent = fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8')
const envConfig = envContent.split('\n').reduce((acc, line) => {
    const [key, value] = line.split('=')
    if (key && value) {
        acc[key.trim()] = value.trim().replace(/^"|"$/g, '')
    }
    return acc
}, {})

const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseKey = envConfig.VITE_SUPABASE_PUBLISHABLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRpc() {
  const rangeStart = new Date('2025-01-01').toISOString()
  const rangeEnd = new Date('2027-01-01').toISOString()

  console.log(`Querying range: ${rangeStart} to ${rangeEnd}`)

  const { data, error } = await supabase.rpc('get_calendar_events', {
    range_start: rangeStart,
    range_end: rangeEnd,
  })

  if (error) {
    console.error('RPC Error:', error)
  } else {
    console.log(`Found ${data.length} events`)
    
    // Check flags for first few events
    data.slice(0, 5).forEach(e => {
        console.log(`Event: ${e.name}`)
        console.log(`  has_party (RPC): ${e.has_party}`)
        console.log(`  has_class (RPC): ${e.has_class}`)
        // Check key_times content inside the RPC result
        if (e.key_times) {
             console.log(`  key_times (RPC):`, JSON.stringify(e.key_times).substring(0, 100))
        }
    })
  }
}

testRpc()
