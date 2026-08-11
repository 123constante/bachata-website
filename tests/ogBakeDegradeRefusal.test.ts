// @vitest-environment node
/**
 * /api/og/bake must never PERSIST a card it did not build from a real cover.
 *
 * The defect this closes (queued finding 1f): bake rendered the branded
 * fallback whenever the cover would not fetch, uploaded it to R2 under a
 * cover-keyed immutable name and recorded set_og_image_v1 status 'ready'.
 * get_og_image_v1 then served it to every crawler, /api/og/card was never
 * fetched for that entity, and an R2 object carries no X-OG-Fallback header --
 * so finding 1a's marker rule was unreachable BY CONSTRUCTION, and nothing
 * re-baked the object while its cover URL stood.
 *
 * WHY THIS FILE EXISTS ALONGSIDE THE CANARY. check-og-images.mjs --self-test
 * proves the pure key-shape rule in both directions, and ogBakePolicy.ts is
 * pure enough to prove on its own -- but neither can fail if the ROUTE stops
 * calling the policy, or starts uploading before consulting it. That half is
 * here: the real action runs and the upload/record calls are observed.
 *
 * The mocks are the I/O, never the subject.
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { decideBakePersist, type BakeRefusalReason } from '../app/lib/ogBakePolicy';

const COVER = 'https://cdn.example.com/flyer.jpg';
const EVENT_ID = '0000e780-3fa7-40b2-bbb8-59b66feb8324';
const OCC_ID = 'ca6f93da-765f-4f82-842d-67a6b05c4480';
const R2_HOST = 'https://pub-07f606224cac4f2596903c44df723644.r2.dev';

// Read at module scope by the route, so they must exist before its import.
const io = vi.hoisted(() => {
  process.env.OG_BAKE_SECRET = 'test-secret';
  process.env.SUPABASE_URL = 'https://db.example.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.SUPABASE_ANON_KEY = 'anon-key';
  return {
    cardData: null as null | Record<string, unknown>,
    imageBytes: null as null | Buffer,
  };
});

vi.mock('../app/lib/ogCardRender', () => ({
  // buildFallbackCard is deliberately ABSENT. If the route ever imports it
  // again -- the whole defect -- this mock throws on the missing export
  // instead of quietly rendering a card nobody asked for.
  buildImageCard: async () => Buffer.from('cover-jpeg'),
  fetchImageBytes: async () => io.imageBytes,
  fetchEventCardData: async () => io.cardData,
  fetchFestivalCardData: async () => io.cardData,
  resolveOgEventId: async (param: string) => param,
}));

import { action } from '../app/routes/api.og.bake';

interface Recorded { status: string; error: string | null; image_url: string | null; cover: string | null }
let uploadedPaths: string[] = [];
let recorded: Recorded[] = [];
const refusedReasons = new Set<string>();

vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
  const u = String(url);
  // Lazily, and only where the body IS json. Parsing every call ate the
  // binary PUT of the jpeg, and the throw landed in the route's own catch --
  // which dutifully recorded it as an error, so the harness bug arrived
  // wearing the costume of the behaviour under test.
  const json = () => (init?.body ? JSON.parse(String(init.body)) : {});
  if (u.includes('storage-sign-upload')) {
    const body = json();
    uploadedPaths.push(body.path);
    return new Response(JSON.stringify({
      ok: true, uploadUrl: 'https://upload.example/put', publicUrl: `${R2_HOST}/events/${body.path}`,
    }), { status: 200 });
  }
  if (u === 'https://upload.example/put') return new Response(null, { status: 200 });
  if (u.includes('set_og_image_v1')) {
    const body = json();
    recorded.push({
      status: body.p_status, error: body.p_error, image_url: body.p_image_url, cover: body.p_cover_source_url,
    });
    // Every refusal reason this file watched the REAL route record. Collected
    // from calls, never from the BakeRefusalReason union: a union is erased at
    // runtime, so reading it would certify a reason whose only emitting branch
    // had been deleted. The cross-file case at the bottom consumes this.
    if (body.p_status === 'error' && body.p_error) refusedReasons.add(body.p_error);
    return new Response('{}', { status: 200 });
  }
  throw new Error(`unexpected fetch: ${u}`);
});

async function bake(extra: Record<string, unknown> = {}): Promise<Response> {
  const request = new Request('https://www.bachatacalendar.co.uk/api/og/bake', {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' },
    body: JSON.stringify({ entity_type: 'event', entity_id: EVENT_ID, ...extra }),
  });
  return action({ request } as unknown as Parameters<typeof action>[0]);
}

beforeEach(() => {
  uploadedPaths = [];
  recorded = [];
  io.cardData = { title: 'Bachata Night', dateLine: 'Friday 7 August 2026', venueLine: 'at Pulse', coverUrl: COVER };
  io.imageBytes = Buffer.from('flyer-bytes');
});

describe('a real cover still bakes, and that is the only path that persists', () => {
  // The discriminator for the file. Without it every assertion below would
  // also pass against a route that refused EVERYTHING, which would empty the
  // bake pipeline while looking like a fix.
  it('uploads once and records ready with the cover-keyed object name', async () => {
    const res = await bake({ occurrence_id: OCC_ID });
    expect(res.status).toBe(200);
    expect(uploadedPaths).toHaveLength(1);
    expect(uploadedPaths[0]).toMatch(new RegExp(`^og/event/${EVENT_ID}-${OCC_ID}-[0-9a-f]{16}[.]jpg$`));
    expect(recorded).toEqual([
      expect.objectContaining({ status: 'ready', error: null, cover: COVER }),
    ]);
  });

  it('an entity with no occurrence keys on "default", not on null', async () => {
    await bake();
    expect(uploadedPaths[0]).toContain(`${EVENT_ID}-default-`);
  });
});

describe('THE 1f CASES: a degrade is refused, never persisted', () => {
  it.each([
    ['cover-unfetchable', () => { io.imageBytes = null; }, COVER],
    ['cover-absent', () => { io.cardData = { title: 'X', dateLine: null, venueLine: null, coverUrl: null }; }, null],
    ['card-data-unavailable', () => { io.cardData = null; }, null],
  ])('%s uploads NOTHING and records error', async (reason, arrange, cover) => {
    arrange();
    const res = await bake({ occurrence_id: OCC_ID });
    // No R2 object at all -- the poison in 1f was an immutable object that
    // outlived every retry, so "wrote it but marked it" is not good enough.
    expect(uploadedPaths).toEqual([]);
    expect(recorded).toEqual([
      expect.objectContaining({ status: 'error', error: reason, image_url: null, cover }),
    ]);
    // status 'error' is what puts the row in _og_sweep's retry window
    // (status <> 'ready', attempts < 5) AND what makes get_og_image_v1 stop
    // serving it, so the page falls back to the live marked card.
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, refused: reason, reason });
  });

  // The festival arm is a DIFFERENT fetcher (fetchFestivalCardData, posterUrl
  // ?? venue.imageUrl) and a different object prefix, and every other case in
  // this file drives entity_type 'event'. Without this the guard's festival
  // fixtures are invented shapes with nothing tying them to what bake writes.
  it('a festival refuses on the same rule and keys under og/festival', async () => {
    io.imageBytes = null;
    const dead = await bake({ entity_type: 'festival' });
    expect(dead.status).toBe(422);
    expect(uploadedPaths).toEqual([]);

    io.imageBytes = Buffer.from('flyer-bytes');
    const live = await bake({ entity_type: 'festival' });
    expect(live.status).toBe(200);
    expect(uploadedPaths[0]).toMatch(new RegExp(`^og/festival/${EVENT_ID}-default-[0-9a-f]{16}[.]jpg$`));
  });

  // A `the retired "fallback" tag is never written` case stood here and was
  // removed as VACUOUS: both its arrangements refuse, so it asserted
  // `expect('').not.toContain('fallback')` over an empty array -- weaker than
  // the `expect(uploadedPaths).toEqual([])` two lines above, which the same
  // two arrangements already prove. No mutant exists that it catches and the
  // it.each does not catch first.

  it('a zero-byte cover body is a dead cover, not bytes to render', async () => {
    // Buffer.from(emptyArrayBuffer) is a truthy object, so a CDN answering
    // 200 Content-Length: 0 for a deleted cover passed a Boolean() check,
    // reached sharp, and surfaced as a 500 naming the RENDERER for what is a
    // storage problem.
    io.imageBytes = Buffer.alloc(0);
    const res = await bake();
    expect(uploadedPaths).toEqual([]);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ ok: false, refused: 'cover-unfetchable', reason: 'cover-unfetchable' });
  });
});

describe('the policy itself, where the ORDER of the checks is the logic', () => {
  const decide = (h: [boolean, boolean, boolean]) =>
    decideBakePersist({ hasCardData: h[0], hasCoverUrl: h[1], hasCoverBytes: h[2] });

  it('persists only when all three hold', () => {
    expect(decide([true, true, true])).toEqual({ persist: true, reason: null });
  });

  // Reversing the two cover checks would label an entity that never HAD a
  // cover URL "unfetchable", sending an operator to storage for a resolver
  // bug. Asserted because both orderings pass a test that only checks
  // persist/refuse.
  it('names cover-absent for a missing URL and cover-unfetchable for a dead one', () => {
    expect(decide([true, false, false])).toEqual({ persist: false, reason: 'cover-absent' });
    expect(decide([true, true, false])).toEqual({ persist: false, reason: 'cover-unfetchable' });
  });

  it('no card data outranks both cover reasons', () => {
    expect(decide([false, true, true])).toEqual({ persist: false, reason: 'card-data-unavailable' });
  });

  // Unreachable from the route today. It refuses rather than persisting
  // because inclusion-shaped means an unanticipated combination must fail,
  // and a future edit that made this reachable must not inherit a pass.
  it('bytes without a cover URL refuses rather than falling through to persist', () => {
    expect(decide([true, false, true])).toEqual({ persist: false, reason: 'cover-absent' });
  });
});

/**
 * The wires between three files, none of which can prove the join alone.
 *
 * Its limit, stated rather than papered over: the second case below is a real
 * behavioural check (the guard's own pattern text, run against the key the
 * real route produced), but the first is a structural read of a type union's
 * source and proves only that the words agree -- the same residual as finding
 * 1g. Both turn a silent divergence into a loud failure, which is worth having
 * even where one of them cannot prove execution.
 */
describe('bake, the card route and the guard still agree', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const guard = read('../scripts/check-og-images.mjs');
  const cardRoute = read('../app/routes/api.og.card.tsx');

  // Self-contained: drive the three refusals HERE rather than relying on the
  // describe above having run. The runtime-collected property is what matters
  // (a union is erased, so parsing one would certify a reason whose emitting
  // branch was deleted) -- but collecting it as a side effect of other tests
  // made the case red under -t or .only on a perfectly clean tree.
  // Arranges io EXPLICITLY for each of the three, including the first. A
  // beforeAll runs before the file's top-level beforeEach, so the defaults it
  // would otherwise inherit are the module-level ones (cardData null), and an
  // earlier draft of this block silently drove card-data-unavailable twice and
  // cover-unfetchable never -- caught only by running the case under -t, which
  // is the very isolation this block exists to provide.
  beforeAll(async () => {
    io.cardData = { title: 'X', dateLine: null, venueLine: null, coverUrl: COVER };
    io.imageBytes = null;
    await bake(); // cover-unfetchable
    io.cardData = { title: 'X', dateLine: null, venueLine: null, coverUrl: null };
    await bake(); // cover-absent
    io.cardData = null;
    await bake(); // card-data-unavailable
  });

  it('every reason bake records is one the card endpoint can also name', () => {
    // Anchored to the FallbackReason DECLARATION, not to every string-literal
    // union in the file. The unanchored form counted members of any unrelated
    // union (a `type Kind = "event" | "festival" | "image"` would do it), so
    // the >= 8 floor could stay satisfied while a real reason was deleted.
    const block = cardRoute.match(/type FallbackReason =([\s\S]*?);/);
    expect(block, 'FallbackReason declaration not found in the card route').not.toBeNull();
    const union = [...(block as RegExpMatchArray)[1].matchAll(/[|] "([a-z-]+)"/g)].map((m) => m[1]);
    expect(union.length).toBeGreaterThanOrEqual(8);
    // Guards this case against passing vacuously if the refusal cases above
    // stopped driving the route. A >= floor, not an equality: refusedReasons
    // is a side effect of earlier cases, so an exact count reds under -t or
    // .only while nothing has actually drifted.
    expect(refusedReasons.size).toBeGreaterThanOrEqual(3);
    for (const r of refusedReasons) expect(union).toContain(r as BakeRefusalReason);
  });

  /**
   * The one that would have caught 1f from outside. The guard fails any baked
   * og:image whose object key is not the real-cover shape; if bake's naming
   * and the guard's pattern ever drift, the guard reds every healthy page
   * (loud) or -- far worse -- silently widens to accept a degrade. So the
   * guard's OWN pattern text is extracted and run against the key the real
   * route just wrote, rather than a key this file made up.
   */
  it("the guard's healthy-key pattern accepts exactly what bake writes", async () => {
    await bake({ occurrence_id: OCC_ID });
    const key = uploadedPaths[0].split('/').pop() as string;

    const seg = guard.match(/const UUID_SEG = '([^']+)'/);
    const pat = guard.match(/HEALTHY_BAKED_KEY_RE = new RegExp[(]`([^`]+)`/);
    expect(seg, 'UUID_SEG not found in the guard').not.toBeNull();
    expect(pat, 'HEALTHY_BAKED_KEY_RE not found in the guard').not.toBeNull();

    const source = (pat as RegExpMatchArray)[1].split('${UUID_SEG}').join((seg as RegExpMatchArray)[1]);
    const healthy = new RegExp(source, 'i');
    expect(healthy.test(key), `guard rejects a key bake writes: ${key}`).toBe(true);
    // Both directions. An extraction that produced something permissive -- or
    // a pattern widened until it matched everything -- passes the line above
    // and fails this one.
    expect(healthy.test(`${EVENT_ID}-default-fallback.jpg`)).toBe(false);
  });

  /**
   * Structural, and its limit is the same one finding 1g names for the
   * marker rule: it proves checkPage CONTAINS the read and the push, not that
   * main() reaches them. Without it the guard could compute the verdict and
   * drop it -- the exact `if (false && degradedCard)` mutation that passed a
   * 16-case canary and a 13-case spec during 1a, because a canary that builds
   * its own inputs can never see the wire.
   */
  /**
   * Deleting a measurement floor must be a test failure, not a quieter run --
   * PR #233's lesson, in the lighter form this file can afford (check-seo
   * declares its floors as a table; this guard has two call sites).
   * bakedDegradedFailure returns null for every live card URL, so without the
   * floor a run that sampled nothing baked is green having never exercised the
   * rule at all.
   */
  it('main floors the number of baked objects actually inspected', () => {
    expect(guard).toMatch(/assertMeasured\(bakedSeen, MIN_BAKED_PAGES, 'baked og:image objects'\);/);
    // The VALUE, parsed and compared -- not a /[1-9]/ shape match, which
    // passed for `= 1` (half the floor) and for the leading digit of `= 10`.
    // Deletion is not the likely drift; quietly lowering it to settle a flaky
    // run is.
    const declared = guard.match(/const MIN_BAKED_PAGES = (\d+);/);
    expect(declared, 'MIN_BAKED_PAGES not declared').not.toBeNull();
    expect(Number((declared as RegExpMatchArray)[1])).toBeGreaterThanOrEqual(2);
  });

  it('checkPage pushes the baked verdict into failures', () => {
    expect(guard).toMatch(/const bakedDegrade = bakedDegradedFailure\(ogImage\);\s*\r?\n\s*if \(bakedDegrade\) failures\.push\(bakedDegrade\);/);
  });
});
