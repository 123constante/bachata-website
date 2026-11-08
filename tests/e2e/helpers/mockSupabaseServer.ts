import { createServer } from 'node:http';
import { FRIDAY, OrganiserFake } from './organiserFake';

// LOCAL mock Supabase for walks of SERVER-RENDERED routes (/event/:id): page.route() only patches the
// browser, never the SSR loader's fetch. Run:  MOCK_PORT=54321 npx tsx tests/e2e/helpers/mockSupabaseServer.ts
// then start the dev server with VITE_SUPABASE_URL=http://127.0.0.1:54321 and a placeholder key.
// Answers every /rest/v1/rpc/<name>. No prod calls, no real keys. The ticket shape is switched per
// request with the `x-mock-shape` header (the walk sets it) or the MOCK_SHAPE env default.
const fake = new OrganiserFake();
const s = fake.series.get(FRIDAY)!;
const date = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10); // always upcoming
const occ = fake.occId(s, date);

const type = (id: string, name: string, pence: number, status: string, remaining: number) => ({
  id, occurrence_id: null, name, price_pence: pence, status, remaining, currency: 'GBP', sales_open_at: null, sales_close_at: null,
});
export const SHAPES: Record<string, unknown[]> = {
  several: [type('t1', 'Early bird', 1000, 'on_sale', 12), type('t2', 'General', 1500, 'on_sale', 80), type('t3', 'Party + workshop', 2200, 'on_sale', 30)],
  single: [type('t1', 'General', 1200, 'on_sale', 50)],
  soldout: [type('t1', 'General', 1200, 'sold_out', 0)],
  full: [type('t1', 'Early bird', 1000, 'on_sale', 12), type('t2', 'Class + party', 1500, 'on_sale', 80), type('t3', 'VIP table', 4000, 'sold_out', 0), type('t4', 'Free ticket', 0, 'on_sale', 5)],
};

// legacy_compat programme rows (parseProgramItems reads this array shape, not the snapshot object).
const row = (id: string, title: string, type: string, start: string, end: string, levels: string[], sort: number) => ({
  id, title, type, start_time: `${date}T${start}:00`, end_time: `${date}T${end}:00`, day_event_date: date, sort_order: sort, levels, room: null,
  people: [], section_id: null, section_kind: null, section_label: null,
});
const PROGRAMME = [
  row('p1', 'Beginners class', 'class', '20:00', '21:00', ['beginner'], 1),
  row('p2', 'Social party', 'party', '21:00', '23:30', [], 2),
];

const lineup = { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] };
const occurrence = {
  occurrence_id: occ, starts_at: `${date}T20:00:00+00`, ends_at: `${date}T23:30:00+00`, local_date: date, timezone: 'Europe/London',
  is_cancelled: false, cancellation_reason_label: null, has_timed_session: true, is_live: false, is_past: false, is_upcoming: true, lineup,
};
// The snapshot_compat shape parseEventPageSnapshot reads (src/modules/event-page/useEventPageQuery.ts).
const snapshot = () => ({
  event_id: FRIDAY, occurrence_id: occ, version: 1,
  event: {
    name: s.name, description: 'Friday Bachata social with a beginners class.', date: `${date}T20:00:00`, type: 'social', format: 'recurring',
    category: 'class', timezone: 'Europe/London', city_slug: 'london', location: 'Studio One, Soho', status: 'published',
    lifecycle_status: 'live', is_published: true, music_styles: ['bachata'], key_times: { party: { start: '20:00', end: '23:30' } },
    meta_data_public: {}, actions: { ticket_url: null },
  },
  organisers: [], organiser_card: {}, occurrences: [occurrence], occurrence_effective: occurrence,
  location_default: {
    city: { id: 'c1', name: 'London', slug: 'london' },
    venue: {
      id: 'v1', name: 'The Studio', address_line: '14 Dean St, London', postcode: 'W1D 3RS', google_maps_link: null, image_url: null,
      gallery_urls: [], transport_json: null, description: null, capacity: 200, floor_type: 'Sprung wooden floor', facilities_new: [],
      parking: 'Paid street parking nearby', id_required: true, cloakroom_available: true, bar_available: true, timezone: 'Europe/London',
    },
  },
  attendance: { preview: [], going_count: 0 },
});

let shape = process.env.MOCK_SHAPE ?? 'several';
createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', '*');
  res.setHeader('access-control-allow-methods', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  if (url.pathname === '/__shape') { shape = url.searchParams.get('v') ?? shape; res.writeHead(200).end(shape); return; }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const rpc = url.pathname.split('/rest/v1/rpc/')[1];
    const send = (b: unknown) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(b));
    switch (rpc) {
      case 'resolve_public_event_ref_v1': return send({ id: FRIDAY, slug: null });
      case 'event_view_p5': return send(raw.includes('legacy_compat') ? (shape === 'full' ? PROGRAMME : []) : snapshot());
      case 'ticket_types_public_v1': return send(SHAPES[shape]);
      default: return send(rpc ? [] : null);
    }
  });
}).listen(Number(process.env.MOCK_PORT ?? 54321), '127.0.0.1', () => console.log('mock supabase up', occ));
