import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';

config({ path: '.env.e2e' });

const required = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'E2E_SUPABASE_TEST_EMAIL',
  'E2E_SUPABASE_TEST_PASSWORD',
];

const missing = required.filter((key) => !process.env[key] || String(process.env[key]).trim().length === 0);

if (missing.length > 0) {
  console.error(`Missing required env vars in .env.e2e: ${missing.join(', ')}`);
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['playwright', 'test', 'tests/e2e/vendor-city-real-supabase.spec.ts', '--project=chromium'],
  {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  },
);

process.exit(result.status ?? 1);
