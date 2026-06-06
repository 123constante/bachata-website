import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const sharp = await import('sharp');
    const version = sharp.default.versions;
    const buf = await sharp.default({
      create: { width: 10, height: 10, channels: 3, background: { r: 20, g: 20, b: 20 } },
    }).jpeg().toBuffer();
    res.status(200).json({ ok: true, sharp: version, bytes: buf.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : '';
    res.status(200).json({ ok: false, error: msg, stack: stack?.slice(0, 500) });
  }
}
