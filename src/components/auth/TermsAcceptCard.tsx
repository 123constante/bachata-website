import { Button } from '@/components/ui/button';
import { ConsentLine } from './ConsentLine';

/** D8: the one-tap accept for an existing account with no acceptance on file. One button, no scroll wall. */
export const TermsAcceptCard = ({ busy, onAccept }: { busy: boolean; onAccept: () => void }) => (
  <div className="space-y-3 text-center" data-testid="terms-accept-card">
    <h1 className="text-lg font-bold">One quick thing</h1>
    {/* L6: says what is being accepted, not "we have updated how we ask". */}
    <ConsentLine lead="To carry on, please accept our" />
    <Button className="w-full min-h-[44px] rounded-full" disabled={busy} onClick={onAccept}>
      {busy ? <>Saving&hellip;</> : 'Accept and continue'}
    </Button>
  </div>
);
