import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// localStorage key used to remember that the user has dismissed the
// "every card opens something" hint. Bump the trailing version when the
// copy changes meaningfully — that way old dismissals don't suppress a
// fresh hint that the user hasn't actually seen yet.
const DISMISS_KEY = 'bento-tap-hint-dismissed-v1';

/**
 * Hand-written-looking yellow Post-it that hints to first-time visitors
 * that every tile in the bento grid is tappable. Sits on the right edge
 * of the page so it doesn't dominate; tilts slightly so it reads as a
 * real note someone left, not part of the page chrome. Self-dismisses
 * on tap of the X and remembers the dismiss via localStorage so repeat
 * visits aren't pestered.
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
    // Right-aligned so the velvet/brass page decorations on the left stay
    // visible. Positive tilt (+2.5deg) reads more natural for a note
    // attached at the right edge — mirrors how a left-aligned Post-it
    // would lean with a negative tilt.
    <div className="mb-2 flex justify-end">
      <div
        className="relative inline-flex max-w-[60%] items-center gap-1 rounded-[2px] px-1.5 py-[3px] text-[9px] font-medium leading-[1.2]"
        style={{
          background: '#F4D55A',
          color: '#3A2A08',
          transform: 'rotate(2.5deg)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        <span
          aria-hidden="true"
          className="absolute right-2.5 -top-[4px] h-[6px] w-[22px] rounded-[1px]"
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
          className="-mr-0.5 shrink-0 rounded-full p-0.5 hover:bg-black/10"
          style={{ color: '#3A2A08' }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
};
