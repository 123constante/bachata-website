import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      const key = line.slice(0, idx);
      const value = line.slice(idx + 1).replace(/^"|"$/g, '');
      return [key, value];
    })
);

const source = fs.readFileSync('src/pages/EventDetail.tsx', 'utf8');
const match = source.match(/\.select\(\s*'([^']+)'\s*\)\s*\n\s*\.eq\('id', id\)\s*\n\s*\.single\(\)/);
if (!match) {
  throw new Error('Unable to extract EventDetail select query');
}
const select = match[1];
const id = '00000000-0000-0000-0000-000000000000';

const url = `${env.VITE_SUPABASE_URL}/rest/v1/events?select=${encodeURIComponent(select)}&id=eq.${id}`;

const response = await fetch(url, {
  headers: {
    apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  },
});

const body = await response.text();
console.log('STATUS', response.status);
console.log('URL', url);
console.log('BODY', body);
