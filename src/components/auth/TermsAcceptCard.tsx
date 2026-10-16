import { Button } from '@/components/ui/button';
import { ConsentLine } from './ConsentLine';

/** D8: the one-tap accept for an existing account with no acceptance on file. One button, no scroll wall. */
export const TermsAcceptCard = ({ busy, onAccept }: { busy: boolean; onAccept: () => void }) => (
  <div className="space-y-3 text-center" data-testid="terms-accept-card">
    <h1 className="text-lg font-bold">One quick thing</h1>
    <p className="text-sm text-muted-foreground">We have updated how we ask. Please confirm to carry on.</p>
    <ConsentLine />
    <Button className="w-full min-h-[44px] rounded-full" disabled={busy} onClick={onAccept}>
      {busy ? 'Saving...' : 'Accept and continue'}
    </Button>
  </div>
);
