type CancelledRedStripProps = {
  reasonLabel?: string | null;
  size?: 'sm' | 'md';
};

// Reusable cancelled-event red strip. Same visual language as the inline
// strip in CoverBlock.tsx (centre-of-image red band, white borders, shadow)
// extracted so the Tonight feed cards and calendar grid can use it too.
// Consumer wraps it in a relative-positioned image container.
export const CancelledRedStrip = ({ reasonLabel, size = 'md' }: CancelledRedStripProps) => {
  const labelSize = size === 'sm' ? 'text-[14px]' : 'text-[18px]';
  const subSize = size === 'sm' ? 'text-[8px]' : 'text-[9px]';
  const padding = size === 'sm' ? 'py-1' : 'py-1.5';
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-1/2 z-30 -translate-y-1/2 px-1"
      data-testid="cancelled-red-strip"
      aria-hidden="true"
    >
      <div
        className={`mx-auto flex flex-col items-center justify-center border-y-2 border-white ${padding} text-center text-white shadow-2xl`}
        style={{
          background: 'rgba(220, 38, 38, 0.94)',
          textShadow: '0 2px 6px rgba(0,0,0,0.5)',
        }}
      >
        <div className={`${labelSize} font-black uppercase tracking-[0.16em] leading-none`}>
          Cancelled
        </div>
        <div className={`mt-1 ${subSize} font-semibold uppercase tracking-[0.06em] opacity-90`}>
          {reasonLabel || 'Event cancelled by organiser'}
        </div>
      </div>
    </div>
  );
};
