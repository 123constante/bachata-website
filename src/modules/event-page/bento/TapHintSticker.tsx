import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// localStorage key used to remember that the user has dismissed the
// "every card opens something" hint. Bump the trailing version when the
// copy changes meaningfully — that way old dismissals don't suppress a
// fresh hint that the user hasn't actually seen yet.
const DISMISS_KEY = 'bento-tap-hint-dismissed-v1';

/**
 * Hand-written-looking yellow Post-it that hints to first-time visitors
 * that every tile in the bento grid is tappable. Sticks slightly off
 * vertical so it reads as a real note someone left, not part of the
 * page chrome. Self-dismisses on tap of the X and remembers the dismiss
 * via localStorage so repeat visits aren't pestered.
 */
export const TapHintSticker = () => {
  // Default false so SSR / first paint doesn't flash a sticker that the
  // post-mount effect is about to hide. Effect promotes to true if the
  // user hasn't dismissed before.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
      setVisible(!dismissed);
    } catch {
      // localStorage may throw in private/locked-down browsers — fall
      // back to showing the sticker (better to over-show than to crash).
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* swallow — we already hid the sticker visually */
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-3 flex justify-start">
      <div
        className="relative inline-flex max-w-[80%] items-start gap-2 rounded-[2px] px-3 py-2 text-[12px] font-medium leading-[1.35]"
        style={{
          background: '#F4D55A',
          color: '#3A2A08',
          transform: 'rotate(-2.5deg)',
          boxShadow: '0 3px 6px rgba(0,0,0,0.4)',
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-4 -top-[7px] h-[11px] w-[38px] rounded-[1px]"
          style={{
            background: 'rgba(255,255,255,0.55)',
            transform: 'rotate(-2deg)',
          }}
        />
        <span>Psst — every card opens something. Tap around!</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss hint"
          className="-mr-0.5 -mt-0.5 shrink-0 rounded-full p-0.5 hover:bg-black/10"
          style={{ color: '#3A2A08' }}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
