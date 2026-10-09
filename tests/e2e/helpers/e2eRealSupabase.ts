import type { Browser, Page } from '@playwright/test';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { deflateSync } from 'node:zlib';

/**
 * Shared plumbing for the specs that drive the REAL E2E Supabase project (no mocks):
 * the prod/non-E2E refusal, password sign-in from Node, a browser page carrying that session,
 * and a small valid PNG for cover uploads. Used by organiser-launch-walk.spec.ts.
 * Runbook: docs/e2e-organiser-real-rpc.md.
 */

export const PROD_REF = 'stsdtacfauprzrdebmzg';
export const E2E_REF = process.env.E2E_PROJECT_REF || 'srrpvuxldthwumzrngla';
export const SUPABASE_URL = process.env.E2E_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON = process.env.E2E_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

export const refOf = (u: string) => /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(u)?.[1] ?? null;
export const keyRef = (k: string) => {
  try {
    return JSON.parse(Buffer.from(k.split('.')[1] ?? '', 'base64url').toString()).ref ?? null;
  } catch {
    return null;
  }
};
export const REF = refOf(SUPABASE_URL);

/** Throws when the configured target is prod or not the E2E project. Call at module load under the real-RPC config. */
export function assertE2eTarget(): void {
  if (SUPABASE_URL.includes(PROD_REF) || SUPABASE_ANON.includes(PROD_REF) || REF === PROD_REF || keyRef(SUPABASE_ANON) === PROD_REF) {
    throw new Error(`REFUSED: the target resolves to PROD (${PROD_REF}). This spec writes; it runs on E2E only.`);
  }
  if (SUPABASE_URL && REF !== E2E_REF) throw new Error(`REFUSED: ${SUPABASE_URL} is not the E2E project ${E2E_REF}.`);
  if (SUPABASE_ANON && keyRef(SUPABASE_ANON) !== E2E_REF) throw new Error(`REFUSED: the anon key is for ${keyRef(SUPABASE_ANON)}, not E2E ${E2E_REF}.`);
}

export type SignedIn = { session: Session; client: SupabaseClient };

export async function signIn(email: string, password: string): Promise<SignedIn> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`password sign-in for ${email} refused: ${error?.message ?? 'no session'}`);
  return { session: data.session, client };
}

/** A page whose supabase-js finds `session` in localStorage (the site has no password form). Null session = signed out. */
export async function pageAs(browser: Browser, session: Session | null, errors: string[], viewport = { width: 390, height: 844 }): Promise<Page> {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  if (session) {
    await ctx.addInitScript(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: `sb-${REF}-auth-token`, value: JSON.stringify(session) },
    );
  }
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return page;
}

/** London's calendar date for an instant, as YYYY-MM-DD. */
export const londonDate = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(d);

/** A real w x h PNG (solid colour + a stripe), small on disk, valid for the magic-byte check and canvas decode. */
export function testPng(w = 900, h = 600): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    const stripe = y > h * 0.4 && y < h * 0.6;
    for (let x = 0; x < w; x++) {
      raw[row + 1 + x * 3] = stripe ? 255 : 180;
      raw[row + 2 + x * 3] = stripe ? 200 : 30;
      raw[row + 3 + x * 3] = stripe ? 40 : 90;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
