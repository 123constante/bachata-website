import { cn } from '@/lib/utils';

/** One shimmer block (#1d1a15 -> #2a251d). Static under reduced motion. */
export function Skeleton({ className, testId }: { className?: string; testId?: string }) {
  return <div aria-hidden="true" data-testid={testId} className={cn('org-skeleton', className)} />;
}

export interface SkeletonRowsProps {
  count?: number;
  /** What is loading, for screen readers. */
  label?: string;
  testId?: string;
}

/** Loading list: N shimmer rows of 48px. Use this in lists instead of a spinner. */
export function SkeletonRows({ count = 3, label = 'Loading', testId }: SkeletonRowsProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} data-testid={testId} className="space-y-[8px]">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-[48px] w-full" />
      ))}
    </div>
  );
}
