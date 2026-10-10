import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildSignInHref, stashPendingReturnTo } from '@/lib/authRouting';

type LevelRatingSignInSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label of the tapped answer, e.g. "Strong"; null when none. */
  tappedLabel: string | null;
  returnTo: string;
};

// Split from LevelRatingPrompt on purpose: it is the only part that needs the
// Dialog and the auth routing, and it only matters after a signed-out tap, so
// it stays out of the event page's first-load chunks (chunk ratchet in
// perf-budgets.json).
// Keep its imports to shared leaf modules: importing anything that lives in the
// event route chunk (levelRatingModel, the prompt) makes the bundler split a
// facade stub off that chunk, +1 first-load request (measured 2026-10-09).
const LevelRatingSignInSheet = ({ open, onOpenChange, tappedLabel, returnTo }: LevelRatingSignInSheetProps) => {
  // The email-link round trip loses the page, so remember where to come back to.
  // Only on the click (as AuthPromptModal does): a dismissed sheet leaves nothing behind.
  const rememberPage = () => {
    try {
      stashPendingReturnTo(returnTo);
    } catch {
      /* storage blocked: sign-in just lands on the default page */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="level-rating-signin-sheet">
        <DialogHeader>
          <DialogTitle>Sign in to save it</DialogTitle>
          <DialogDescription>
            {tappedLabel ? `Your answer, ${tappedLabel}, is kept while you sign in.` : 'Your answer is kept while you sign in.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to={buildSignInHref(returnTo, 'signin')}
            data-testid="level-rating-login"
            onClick={rememberPage}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#f5a60a] px-4 text-sm font-extrabold text-[#1a1200]"
          >
            Log in
          </Link>
          <Link
            to={buildSignInHref(returnTo, 'signup')}
            data-testid="level-rating-signup"
            onClick={rememberPage}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/30 px-4 text-sm font-bold text-foreground"
          >
            Sign up
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LevelRatingSignInSheet;
