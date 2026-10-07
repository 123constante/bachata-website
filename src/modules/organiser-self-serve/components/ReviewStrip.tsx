import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ExternalLink, Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { fetchOrganiserHome, organiserHomeQueryKey } from '../selfServeApi';
import { submitForReviewCommand } from '../seriesCommands';
import { commandErrorMessage } from '../selfServeErrors';
import { publicEventPath } from '../editorGuards';
import { reviewStrip, type ReviewStep } from '../reviewModel';
import { instantDateLabel } from '../teamModel';
import type { HomeSeriesFull } from '../homeModel';
import type { WorkspaceSeries } from '../seriesModel';
import { useOwnerCommand } from './useOwnerCommand';

/**
 * The review status strip (Lever 2 W6, mockup 05-A) at the top of the series
 * page: draft -> in review -> live, with the admin's message when the series
 * was returned, "Send for review" where the server admits it, and "View as a
 * dancer" once the public read serves the series. The verdict and its reason
 * come from organiser_home_v1 (series[].latest_decision), the same query the
 * home already holds, so no second read is added for a live series.
 */

/** The step's state in words: the marks are pictures, so a screen reader hears this instead. */
const STATE_TEXT: Record<ReviewStep['state'], string> = { done: 'done', current: 'you are here', returned: 'returned', todo: 'not yet' };

function Step({ step, last }: { step: ReviewStep; last: boolean }) {
  const done = step.state === 'done';
  return (
    <li
      className="flex items-center gap-1 min-w-0"
      aria-current={step.state === 'current' || step.state === 'returned' ? 'step' : undefined}
      data-testid="review-step"
      data-step={step.key}
      data-state={step.state}
    >
      <span
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
          done && 'border-primary bg-primary text-primary-foreground',
          step.state === 'current' && 'border-primary text-primary',
          step.state === 'returned' && 'border-destructive text-destructive',
          step.state === 'todo' && 'border-border text-muted-foreground',
        )}
        aria-hidden="true"
      >
        {done ? <Check className="w-3 h-3" /> : step.state === 'returned' ? <Undo2 className="w-3 h-3" /> : step.state === 'current' ? <span className="h-2 w-2 rounded-full bg-primary" /> : ''}
      </span>
      <span className={cn('truncate', step.state === 'todo' ? 'text-muted-foreground' : 'font-medium', step.state === 'returned' && 'text-destructive')}>
        {step.label}
        <span className="sr-only">, {STATE_TEXT[step.state]}</span>
      </span>
      {!last && <span className="mx-1 h-px w-4 shrink-0 bg-border" aria-hidden="true" />}
    </li>
  );
}

export function ReviewStrip({ series, onSaved }: { series: WorkspaceSeries; onSaved: (text: string) => void }) {
  const { user } = useAuth();
  const home = useQuery({ queryKey: organiserHomeQueryKey(user?.id), queryFn: fetchOrganiserHome, enabled: !!user });
  const decision = home.data?.organisers
    .flatMap((o) => o.series as HomeSeriesFull[])
    .find((s) => s.id === series.id)?.latest_decision;
  const model = reviewStrip(series.lifecycle_status, decision, { hasVenue: !!series.default_venue_id });
  const command = useOwnerCommand(series.id);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await command.mutateAsync({ targetId: series.id, version: series.version, command: submitForReviewCommand() });
      onSaved('Sent for review. The Bachata Calendar team usually answers within a day.');
    } catch (err) {
      setError(commandErrorMessage(err));
    }
  };

  const returnedOn = instantDateLabel(model.returnedAt);

  return (
    <section
      className="rounded-md border border-border p-3 space-y-2"
      aria-labelledby="review-heading"
      data-testid="review-strip"
      data-status={series.lifecycle_status}
    >
      <ol className="flex items-center gap-1 text-xs" aria-label="Review progress">
        {model.steps.map((step, i) => <Step key={step.key} step={step} last={i === model.steps.length - 1} />)}
      </ol>
      <div>
        <h2 id="review-heading" className="text-sm font-semibold" data-testid="review-headline">{model.headline}</h2>
        {model.detail && <p className="text-xs text-muted-foreground">{model.detail}</p>}
      </div>
      {model.reason && (
        <blockquote className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="review-reason">
          <p>&ldquo;{model.reason}&rdquo;</p>
          <footer className="text-xs text-muted-foreground mt-1">
            {returnedOn ? `Returned on ${returnedOn}` : 'Returned'} by the Bachata Calendar team
          </footer>
        </blockquote>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {model.submit && (
          <Button
            type="button"
            size="sm"
            disabled={command.isPending || !!model.submitMissing}
            aria-describedby={model.submitMissing ? 'review-missing' : undefined}
            onClick={() => void submit()}
            data-testid="review-submit"
          >
            {command.isPending ? <><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Sending&hellip;</> : model.submit.label}
          </Button>
        )}
        {/* Why the button is off sits right under it, not after the preview note. */}
        {model.submit && model.submitMissing && (
          <p id="review-missing" className="w-full text-[11px] text-muted-foreground" data-testid="review-missing">{model.submitMissing}</p>
        )}
        {model.publicPage ? (
          <Link
            to={publicEventPath(series)}
            className="text-xs text-primary tap-link gap-1"
            data-testid="series-view-as-dancer"
          >
            View as a dancer <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </Link>
        ) : model.previewNote && (
          <p className="text-xs text-muted-foreground" data-testid="review-preview-note">{model.previewNote}</p>
        )}
      </div>
      {error && <p className="text-xs text-destructive" role="alert" data-testid="review-error">{error}</p>}
    </section>
  );
}
