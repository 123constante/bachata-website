import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Step 1: test sharp
    const sharp = await import('sharp');
    const sharpVersions = sharp.default.versions;

    // Step 2: test importing the card builder
    let cardImportErr = null;
    let cardBuf: Buffer | null = null;
    try {
      const { buildFallbackCard } = await import('./_card.js');
      cardBuf = await buildFallbackCard({ title: 'Test' });
    } catch (e2: unknown) {
      cardImportErr = e2 instanceof Error ? `${e2.message}\n${e2.stack?.slice(0, 400)}` : String(e2);
    }

    res.status(200).json({
      ok: !cardImportErr,
      sharp: sharpVersions,
      cardBytes: cardBuf?.length ?? null,
      cardError: cardImportErr,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack?.slice(0, 400) : '';
    res.status(200).json({ ok: false, error: msg, stack });
  }
}
