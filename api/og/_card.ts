// Branded Open Graph card builder for /api/og/card.
//
// Pipeline (per the OG-preview plan): sharp decodes the cover (handles WebP,
// which @vercel/og/Satori cannot) -> @vercel/og composes the branded 1200x630
// card with real brand fonts -> sharp re-encodes to JPEG q80 so the result
// stays well under WhatsApp's ~300KB preview budget.
import { ImageResponse } from '@vercel/og';
import sharp from 'sharp';
import { FONT_INTER_REGULAR, FONT_INTER_SEMIBOLD, FONT_FRAUNCES_SEMIBOLD } from './_fonts';

export const CARD_W = 1200;
export const CARD_H = 630;

const BRAND_DARK = '#141519';
const ORANGE = '#f97316';
const FLYER_W = 720;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- plain element trees (not JSX); Satori accepts this shape.
type El = any;

const FONTS = [
  { name: 'Inter', data: FONT_INTER_REGULAR, weight: 400 as const, style: 'normal' as const },
  { name: 'Inter', data: FONT_INTER_SEMIBOLD, weight: 600 as const, style: 'normal' as const },
  { name: 'Fraunces', data: FONT_FRAUNCES_SEMIBOLD, weight: 600 as const, style: 'normal' as const },
];

function truncate(text: string, max: number): string {
  const t = (text ?? '').trim();
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + '…';
}

// Render a Satori element tree to a size-bounded JPEG buffer.
async function renderToJpeg(element: El): Promise<Buffer> {
  const resp = new ImageResponse(element, { width: CARD_W, height: CARD_H, fonts: FONTS });
  const png = Buffer.from(await resp.arrayBuffer());
  return sharp(png).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
}

async function coverToDataUri(coverBuf: Buffer): Promise<string> {
  // Decode (incl. WebP) + downscale so the embedded data URI stays small.
  const png = await sharp(coverBuf)
    .resize(FLYER_W + 40, CARD_H + 30, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

// The right-hand brand panel (wordmark + title + accent + date + venue).
function brandPanel(title: string, dateLine: string | null, venueLine: string | null): El {
  const fontSize = title.length > 30 ? 40 : title.length > 20 ? 46 : 54;
  const children: El[] = [
    { type: 'div', props: { style: { display: 'flex', fontFamily: 'Inter', fontSize: 22, fontWeight: 600, color: '#e7e3da', letterSpacing: 2 }, children: 'BACHATA CALENDAR' } },
    { type: 'div', props: { style: { display: 'flex', marginTop: 26, fontFamily: 'Fraunces', fontSize, fontWeight: 600, color: '#ffffff', lineHeight: 1.06 }, children: title } },
    { type: 'div', props: { style: { display: 'flex', width: 64, height: 6, marginTop: 26, backgroundColor: ORANGE } } },
  ];
  if (dateLine) children.push({ type: 'div', props: { style: { display: 'flex', marginTop: 24, fontFamily: 'Inter', fontSize: 26, color: '#c9cbd1' }, children: dateLine } });
  if (venueLine) children.push({ type: 'div', props: { style: { display: 'flex', marginTop: 10, fontFamily: 'Inter', fontSize: 22, color: '#9398a3' }, children: venueLine } });
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex', flexDirection: 'column', width: CARD_W - FLYER_W, height: CARD_H,
        padding: 56, justifyContent: 'center', backgroundColor: BRAND_DARK, borderLeft: '1px solid #2a2c33',
      },
      children,
    },
  };
}

// Full branded card with the flyer letterboxed (never cropped) on the left.
export async function buildEventCard(opts: {
  title: string;
  dateLine?: string | null;
  venueLine?: string | null;
  coverBuf: Buffer;
}): Promise<Buffer> {
  const title = truncate(opts.title || 'Bachata Calendar', 72);
  const dataUri = await coverToDataUri(opts.coverBuf);
  const element: El = {
    type: 'div',
    props: {
      style: { display: 'flex', width: CARD_W, height: CARD_H, backgroundColor: BRAND_DARK, fontFamily: 'Inter' },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', width: FLYER_W, height: CARD_H, alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND_DARK },
            children: { type: 'img', props: { src: dataUri, width: FLYER_W, height: CARD_H, style: { objectFit: 'contain' } } },
          },
        },
        brandPanel(title, opts.dateLine ?? null, opts.venueLine ?? null),
      ],
    },
  };
  return renderToJpeg(element);
}

// No-cover branded fallback: centered wordmark + title + date on brand-dark.
export async function buildFallbackCard(opts: {
  title?: string | null;
  dateLine?: string | null;
  venueLine?: string | null;
}): Promise<Buffer> {
  const title = truncate(opts.title || 'Bachata Calendar', 64);
  const children: El[] = [
    { type: 'div', props: { style: { display: 'flex', fontFamily: 'Inter', fontSize: 28, fontWeight: 600, color: '#e7e3da', letterSpacing: 3 }, children: 'BACHATA CALENDAR' } },
    { type: 'div', props: { style: { display: 'flex', width: 80, height: 6, marginTop: 28, backgroundColor: ORANGE } } },
    { type: 'div', props: { style: { display: 'flex', marginTop: 28, fontFamily: 'Fraunces', fontSize: 64, fontWeight: 600, color: '#ffffff', lineHeight: 1.05, textAlign: 'center', maxWidth: 1000 }, children: title } },
  ];
  if (opts.dateLine) children.push({ type: 'div', props: { style: { display: 'flex', marginTop: 24, fontFamily: 'Inter', fontSize: 30, color: '#c9cbd1' }, children: opts.dateLine } });
  if (opts.venueLine) children.push({ type: 'div', props: { style: { display: 'flex', marginTop: 10, fontFamily: 'Inter', fontSize: 24, color: '#9398a3' }, children: opts.venueLine } });
  const element: El = {
    type: 'div',
    props: {
      style: {
        display: 'flex', flexDirection: 'column', width: CARD_W, height: CARD_H,
        alignItems: 'center', justifyContent: 'center', backgroundColor: BRAND_DARK,
      },
      children,
    },
  };
  return renderToJpeg(element);
}

// Plain letterbox normalize (no text) for non-event entities (people, cities,
// venues) whose avatar/hero may be WebP. Pure sharp — no Satori needed.
export async function buildImageCard(coverBuf: Buffer): Promise<Buffer> {
  return sharp({
    create: { width: CARD_W, height: CARD_H, channels: 4, background: { r: 20, g: 21, b: 25, alpha: 1 } },
  })
    .composite([
      {
        input: await sharp(coverBuf)
          .resize(CARD_W, CARD_H, { fit: 'inside', withoutEnlargement: false })
          .png()
          .toBuffer(),
        gravity: 'centre',
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
