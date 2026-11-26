// Face guide + checker preview for the raffle photo step (flag: raffleCutout).
const CHECKER = 'repeating-conic-gradient(#e9e4da 0% 25%, #fbf8f2 0% 50%) 50% / 24px 24px';

export function FaceGuide() {
  return (
    <div className="flex flex-col items-center gap-[10px]" data-testid="photo-face-guide">
      <div
        aria-hidden="true"
        className="h-[210px] w-[160px] rounded-[50%] border-[3px] border-dashed border-[rgba(247,236,217,.55)]"
      />
      <p className="text-center text-[14px] font-semibold">Fit your face and shoulders in the oval</p>
    </div>
  );
}

export function CutoutPreview({ url, busy, onUse, onRetry }: { url: string; busy: boolean; onUse: () => void; onRetry: () => void }) {
  const btn = 'min-h-[52px] flex-1 rounded-[16px] border-[1.5px] border-[rgba(247,236,217,.16)] text-[15px] font-bold disabled:opacity-50';
  return (
    <div className="flex flex-col gap-[12px]" data-testid="photo-cutout-preview">
      <div className="mx-auto h-[220px] w-[220px] overflow-hidden rounded-[20px]" style={{ background: CHECKER }}>
        <img src={url} alt="Your photo with the background removed" className="h-full w-full object-contain" />
      </div>
      <div className="flex gap-[10px]">
        <button type="button" className={btn} disabled={busy} onClick={onRetry}>Try again</button>
        <button type="button" className={btn} disabled={busy} onClick={onUse}>Use this photo</button>
      </div>
    </div>
  );
}
