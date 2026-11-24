import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { OpenNight } from '../model';
import {
  canvasToPng, downloadPng, posterFileName, posterText, renderPoster, sharePosterFile,
} from '../sharePoster';

// Raffle winner journey, Share step (prototype v6). Controlled, unrouted (W4b wires it).
// Share is unconditional: no raffleSharePoster flag check here. Reuses sharePoster.ts untouched.

export type ShareStepProps = {
  night: OpenNight;
  dancersInDraw: number | null;
  /** Poster/share link, shown on the poster and in the share text. */
  link: string;
  /** Winner first name for the poster; falls back to "A dancer". */
  firstName?: string | null;
  /** Share completed, or "Skip, show my QR". */
  onDone: () => void;
};

const btn = 'flex min-h-[56px] w-full items-center justify-center rounded-[18px] px-[16px] text-[17px] font-bold';

export function ShareStep({ night, dancersInDraw, link, firstName = null, onDone }: ShareStepProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const text = useMemo(() => {
    const t = posterText({ firstName, night, poolCount: dancersInDraw, origin: '' });
    return { ...t, link };
  }, [firstName, night, dancersInDraw, link]);
  const [readyFor, setReadyFor] = useState<typeof text | null>(null);
  const ready = readyFor === text;

  useEffect(() => {
    let live = true;
    if (ref.current) void renderPoster(ref.current, text).then(() => { if (live) setReadyFor(text); });
    return () => { live = false; };
  }, [text]);

  const png = async () => (ref.current ? canvasToPng(ref.current) : null);
  const save = async () => {
    const b = await png();
    if (b) downloadPng(b, posterFileName(text.title));
  };
  const share = async () => {
    const b = await png();
    if (!b) return;
    const r = await sharePosterFile(b, text);
    if (r === 'shared') onDone(); // cancelled / failed / downloaded: stay on this step
  };

  return (
    <div className="flex min-h-full flex-col bg-[#150a1c] text-[#f7ecd9]">
      <main className="flex flex-1 flex-col gap-[14px] px-[20px] pb-[12px] pt-[16px]">
        <span className="flex items-center gap-[6px] text-[11.5px] font-semibold uppercase tracking-[.14em] text-[#3ddbb4]">
          <Check aria-hidden="true" className="h-[14px] w-[14px]" /> Night confirmed
        </span>
        <h1 className="text-[34px] font-extrabold leading-[1.02] tracking-tight">Share your win</h1>
        <p className="text-[16px] text-[rgba(247,236,217,.68)]">Tell your friends you are going. Your QR code is one tap back.</p>
        <canvas
          ref={ref}
          role="img"
          aria-label={`Share poster: won a free night at ${text.title}`}
          className={`mx-auto aspect-[4/5] w-[232px] rounded-[16px] shadow-lg transition-opacity ${ready ? '' : 'opacity-35'}`}
        />
        {ready ? null : <p role="status" className="text-center text-[13.5px] text-[rgba(247,236,217,.68)]">Drawing your poster&hellip;</p>}
      </main>
      <footer className="flex flex-col gap-[10px] px-[20px] pb-[22px] pt-[12px]">
        <button type="button" disabled={!ready} onClick={() => void share()}
          className={`${btn} bg-[#ec3458] text-white disabled:opacity-40`}>Share</button>
        <button type="button" disabled={!ready} onClick={() => void save()}
          className={`${btn} border-[1.5px] border-[rgba(247,236,217,.16)] disabled:opacity-40`}>Save image</button>
        <button type="button" onClick={onDone}
          className="min-h-[44px] text-[15px] font-semibold text-[rgba(247,236,217,.68)] underline underline-offset-4">Skip, show my QR</button>
      </footer>
    </div>
  );
}
