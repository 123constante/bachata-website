import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { meta as djMeta } from '../app/routes/djs';
import { meta as dancerMeta } from '../app/routes/dancers';
import { meta as teacherMeta } from '../app/routes/teachers';

/**
 * People arc S5: ONE expected mapping (EXPECT below) for every person card, asserted against
 * BOTH paths a bot can be served: the SSR route's meta() and middleware.ts's bot card for
 * /teachers (on the matcher whatever the flags say). Shapes are the prod ones surveyed
 * 2026-10-24 (docs/people-arc/s5/HANDOVER.md): with / without a city, without a photo, a
 * text[] photo, nameless. The DJ card has no DJ-only photo to show today (get_public_dj_v1's
 * photo_url is the avatar), so the image row checks "the role's photo, then the avatar".
 */

const ORIGIN = 'https://www.bachatacalendar.co.uk';
const SUFFIX = ' | Bachata Calendar';
type Role = 'teacher' | 'dj' | 'dancer';
const BASE: Record<Role, string> = { teacher: '/teachers', dj: '/djs', dancer: '/dancers' };
const WORD: Record<Role, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };

type Shape = { label: string; name: string | null; city: string | null; photo: string | string[] | null };
const SHAPES: Shape[] = [
  { label: 'named, in London', name: 'Bisket', city: 'London', photo: 'https://media.example/a.webp' },
  { label: 'named, elsewhere (was "London")', name: 'Enoch Lopez', city: 'Madrid', photo: 'https://media.example/b.jpg' },
  { label: 'no city (was "London")', name: 'Florian', city: null, photo: 'https://media.example/c.png' },
  { label: 'no photo', name: 'Bobby Blanco', city: 'London', photo: null },
  { label: 'photo as text[] with a blank first', name: 'Brito', city: 'London', photo: ['', 'https://media.example/d.webp'] },
];

/** THE mapping. Every row of both paths is checked against this and nothing else. */
function EXPECT(role: Role, s: Shape, slug: string) {
  const name = s.name ?? WORD[role];
  const title = `${name} - Bachata ${WORD[role]}${s.city ? `, ${s.city}` : ''}${SUFFIX}`;
  const where = s.city ? ` in ${s.city}` : '';
  const who = s.name ?? `This ${role === 'dj' ? 'DJ' : role}`;
  const description = {
    teacher: `${who} teaches bachata${where}. Classes, schedule and styles.`,
    dj: `${who} plays bachata${where}. Upcoming sets and where to hear them.`,
    dancer: `${who} - profile on Bachata Calendar${s.city ? ` ${s.city}` : ''}.`,
  }[role];
  const raw = Array.isArray(s.photo) ? s.photo.find((p) => p) ?? null : s.photo;
  return {
    title,
    description,
    imageSrc: raw, // the raw photo the /api/og/card src wraps; null = the default card
    url: `${ORIGIN}${BASE[role]}/${slug}`,
    canonical: `${ORIGIN}${BASE[role]}/${slug}`,
    robots: null as string | null,
    twitterCard: 'summary_large_image',
    ogType: 'profile',
  };
}

const srcOf = (image: string | null | undefined): string | null => {
  if (!image || image.endsWith('/og-image.jpg')) return null;
  return new URL(image).searchParams.get('src');
};

// ---- SSR: the route's own meta() over the loader data the loader builds --------------------
type Tag = Record<string, string>;
const pick = (tags: Tag[]) => {
  const prop = (p: string) => tags.find((t) => t.property === p)?.content ?? null;
  const named = (n: string) => tags.find((t) => t.name === n)?.content ?? null;
  return {
    title: tags.find((t) => 'title' in t)?.title ?? null,
    description: named('description'),
    imageSrc: srcOf(prop('og:image')),
    url: prop('og:url'),
    canonical: tags.find((t) => t.rel === 'canonical')?.href ?? null,
    robots: named('robots'),
    twitterCard: named('twitter:card'),
    ogType: prop('og:type'),
  };
};
// What the three loaders hand meta(): the same personCardPhoto + normalizeOgImage they call.
const loaderData = async (s: Shape, slug: string) => {
  const { personCardPhoto } = await import('../src/lib/seo/personCard');
  const raw = personCardPhoto(null, s.photo);
  return {
    entityName: s.name ?? undefined,
    entitySlug: slug,
    entityCity: s.city,
    ogImage: raw ? `${ORIGIN}/api/og/card?kind=image&src=${encodeURIComponent(raw)}` : `${ORIGIN}/og-image.jpg`,
  };
};
const ssr = async (role: Role, s: Shape, slug: string) => {
  const data = await loaderData(s, slug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = (d: unknown) => ({ data: d } as any);
  const tags = role === 'dj' ? djMeta(args(data)) : role === 'dancer' ? dancerMeta(args(data)) : teacherMeta(args({ locked: false, ...data }));
  return pick(tags as Tag[]);
};

describe.each(['teacher', 'dj', 'dancer'] as const)('SSR %s card', (role) => {
  it.each(SHAPES)('$label', async (s) => {
    expect(await ssr(role, s, 'p-slug')).toEqual(EXPECT(role, s, 'p-slug'));
  });
  it('nameless: the role word, and noindex', async () => {
    const s = { label: 'nameless', name: null, city: null, photo: null };
    expect(await ssr(role, s, 'p-slug')).toEqual({ ...EXPECT(role, s, 'p-slug'), robots: 'noindex,nofollow' });
  });
});

describe('SSR /teachers with the teacher pages closed (flag OFF): unchanged coming-soon head', () => {
  it('locked', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(teacherMeta({ data: { locked: true } } as any)).toEqual([
      { title: 'Coming soon - Teacher - Bachata Calendar' },
      { name: 'robots', content: 'noindex,nofollow' },
    ]);
  });
});

// ---- middleware: the bot card for /teachers (served whatever the flags) ---------------------
type Mw = (request: Request) => Promise<Response>;
let middleware: Mw;
beforeAll(async () => {
  process.env.SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'stub-anon-key';
  process.env.SITE_URL = ORIGIN;
  middleware = (await import('../middleware')).default as Mw;
}, 60_000);
afterEach(() => vi.unstubAllGlobals());

const mwCard = async (s: Shape, path: string, ua: string) => {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    if (String(u).includes('/rest/v1/dancer_profiles')) return new Response(JSON.stringify([{ id: '0a0a0a0a-0000-4000-8000-000000000001', slug: 'p-slug' }]), { status: 200 });
    const [first_name, ...rest] = (s.name ?? '').split(' ');
    return new Response(JSON.stringify([{ first_name: first_name || null, surname: rest.join(' ') || null, city: s.city, photo_url: s.photo, teaching_styles: [], years_teaching: null }]), { status: 200 });
  }));
  const res = await middleware(new Request(`${ORIGIN}${path}`, { headers: { 'user-agent': ua } }));
  const html = await res.text();
  const attr = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') : null;
  };
  return {
    title: attr(/<title>([^<]*)<\/title>/),
    description: attr(/<meta name="description" content="([^"]*)"/),
    imageSrc: srcOf(attr(/<meta property="og:image" content="([^"]*)"/)),
    url: attr(/<meta property="og:url" content="([^"]*)"/),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/),
    robots: attr(/<meta name="robots" content="([^"]*)"/),
    twitterCard: attr(/<meta name="twitter:card" content="([^"]*)"/),
    ogType: attr(/<meta property="og:type" content="([^"]*)"/),
  };
};

describe.each(['facebookexternalhit/1.1', 'WhatsApp/2.23', 'Twitterbot/1.0'])('middleware /teachers card for %s', (ua) => {
  // The middleware teacher RPC only returns rows with a first name (survey), so no nameless row.
  it.each(SHAPES)('$label', async (s) => {
    expect(await mwCard(s, '/teachers/p-slug', ua)).toEqual(EXPECT('teacher', s, 'p-slug'));
  });
  it('a shared link with ?utm_source / ?fbclid: og:url is still the canonical', async () => {
    const s = SHAPES[0];
    expect((await mwCard(s, '/teachers/p-slug?utm_source=whatsapp&fbclid=x', ua)).url).toBe(`${ORIGIN}/teachers/p-slug`);
  });
});

describe('SSR and middleware agree on every /teachers shape (the two paths, field by field)', () => {
  it.each(SHAPES)('$label', async (s) => {
    expect(await mwCard(s, '/teachers/p-slug', 'facebookexternalhit/1.1')).toEqual(await ssr('teacher', s, 'p-slug'));
  });
});

describe('image choice: the role’s own photo, then the avatar, then the default card', () => {
  it.each<[unknown, unknown, string | null]>([
    ['https://m/dj.jpg', 'https://m/avatar.jpg', 'https://m/dj.jpg'],
    [null, 'https://m/avatar.jpg', 'https://m/avatar.jpg'],
    ['  ', ['', 'https://m/avatar.jpg'], 'https://m/avatar.jpg'],
    [null, null, null],
  ])('role %j, avatar %j -> %j', async (rolePhoto, avatar, want) => {
    const { personCardPhoto } = await import('../src/lib/seo/personCard');
    expect(personCardPhoto(rolePhoto, avatar)).toBe(want);
  });
});
