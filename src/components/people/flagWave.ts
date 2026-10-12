/**
 * The waving-flag maths, ported from the owner's reference ("Waving Flags", style
 * "L Waving flag", artifact LoS9BPPcXFHGCAysrQKrf6) with the Silk preset fixed:
 * ripple height 45, speed 30, ripple length 25, cloth shading 70, gusts 10 (0-100).
 *
 * The cloth is sliced into 1-device-pixel columns; each column is shifted vertically by
 * a travelling sine whose envelope is pinned at the pole (env = .18 + .82u), and shaded
 * light on the rising slope and dark on the falling one. Gusts modulate amplitude and
 * speed with two slow sines. Pole: a grey-silver gradient with a gold cap.
 *
 * Only deviation from the reference: the cloth's minimum width (22px there, sized for
 * photos of 40px and up) shrinks for smaller photos, to 62% of the photo, so a 24-32px
 * chip is not covered by its own flag.
 */

export const SILK = Object.freeze({ amp: 45, spd: 30, len: 25, shd: 70, gst: 10 });
export type WaveConfig = typeof SILK;

/** The time a reduced-motion flag is frozen at (the reference's "still" frame). */
export const STILL_T = 2000;

export interface FlagGeometry {
  /** Cloth width and height, CSS px. */
  fw: number;
  fh: number;
  pad: number;
  /** Canvas size, CSS px. */
  cw: number;
  ch: number;
  /** Canvas offset from the photo's top-left, CSS px (corner placement). */
  left: number;
  top: number;
}

/** Where the canvas sits for a round photo of `size` px: pole just inside the top-right. */
export function flagGeometry(size: number): FlagGeometry {
  const s = Math.max(1, size);
  const fw = Math.max(Math.min(22, Math.round(s * 0.62)), Math.round(s * 0.46));
  const fh = Math.round((fw * 2) / 3);
  const pad = Math.round(fw * 0.2);
  return {
    fw,
    fh,
    pad,
    cw: fw + pad + 4,
    ch: fh + pad * 2 + 4,
    left: Math.round(s * 0.62),
    top: Math.round(-s * 0.14 - pad),
  };
}

export interface FlagSeed {
  /** Wave phase offset. */
  ph: number;
  /** Gust phase offset. */
  g: number;
}

/** A per-flag random phase, so a row of flags never moves in step. */
export const randomSeed = (rnd: () => number = Math.random): FlagSeed => {
  const seed = 1 + rnd() * 12;
  return { ph: seed * 1.7 + 0.3, g: seed * 2.9 };
};

/** The wave's state at time t (ms) for one flag; pure, so it is unit-tested. */
export function waveAt(t: number, fh: number, seed: FlagSeed, cfg: WaveConfig = SILK) {
  const ampPx = fh * (cfg.amp / 100) * 0.28;
  const waves = 1 + (cfg.len / 100) * 2.2;
  const speed = 0.6 + (cfg.spd / 100) * 3.4;
  const gust = (cfg.gst / 100) * (0.5 + 0.5 * Math.sin(t * 0.0009 + seed.g)) * (0.5 + 0.5 * Math.sin(t * 0.0023 + seed.g * 1.7));
  const A = ampPx * (1 + gust * 1.1);
  const sp = speed * (1 + gust * 0.8);
  return { A, waves, phase: seed.ph + t * 0.0012 * sp };
}

/** Vertical offset (device px) and shade (-1 dark .. +1 light, signed alpha) of the column at u in [0,1). */
export function column(u: number, A: number, waves: number, phase: number, ph: number, dpr: number, cfg: WaveConfig = SILK) {
  const env = 0.18 + 0.82 * u; // cloth is pinned at the pole
  const arg = u * waves * Math.PI * 2 - phase;
  const y = Math.sin(arg) * A * dpr * env + Math.sin(arg * 0.5 + ph) * A * dpr * 0.25 * env;
  const shade = Math.cos(arg) * (cfg.shd / 100) * 0.42 * env;
  return { y, shade };
}

/**
 * Draws one frame. `art` is the flag already rasterised at the cloth's device size
 * (W x H), so each column is a cheap bitmap copy.
 */
export function drawFlag(
  ctx: CanvasRenderingContext2D,
  art: CanvasImageSource & { width: number; height: number },
  g: FlagGeometry,
  seed: FlagSeed,
  t: number,
  dpr: number,
  cfg: WaveConfig = SILK,
) {
  const s = dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, Math.round(g.cw * s), Math.round(g.ch * s));
  const { A, waves, phase } = waveAt(t, g.fh, seed, cfg);
  const ox = g.pad * s;
  const oy = (g.pad + 2) * s;
  const colW = Math.max(1, Math.round(s));
  const W = Math.round(g.fw * s);
  const H = Math.round(g.fh * s);
  const sw = art.width / W;
  for (let x = 0; x < W; x += colW) {
    const { y, shade } = column(x / W, A, waves, phase, seed.ph, s, cfg);
    ctx.drawImage(art, x * sw, 0, colW * sw, art.height, ox + x, oy + y, colW, H);
    ctx.fillStyle = shade > 0 ? `rgba(255,255,255,${(shade * 0.8).toFixed(3)})` : `rgba(0,0,0,${(-shade).toFixed(3)})`;
    ctx.fillRect(ox + x, oy + y, colW, H);
  }
  // Pole, then the gold cap.
  const pw = Math.max(2, Math.round(1.6 * s));
  const grad = ctx.createLinearGradient(ox - pw * 1.5, 0, ox, 0);
  grad.addColorStop(0, '#8a8173');
  grad.addColorStop(0.5, '#e6dfd0');
  grad.addColorStop(1, '#9b927f');
  ctx.fillStyle = grad;
  ctx.fillRect(ox - pw, oy - 3 * s, pw, H + Math.round(g.fh * 0.55 * s));
  ctx.fillStyle = '#e2b862';
  ctx.beginPath();
  ctx.arc(ox - pw / 2, oy - 3 * s, pw * 0.9, 0, 6.283);
  ctx.fill();
}
