import type { AreaStatusKind } from './areaStatus';

/**
 * The status dot beside an area's words. Drawn in currentColor so it fits the
 * organiser theme, the dancer surface and the site sheet alike. Decorative: the
 * words next to it carry the meaning.
 */
export function StatusDot({ kind }: { kind: AreaStatusKind }) {
  const style =
    kind === 'complete'
      ? { background: 'currentColor', border: '2px solid currentColor' }
      : kind === 'to-finish'
        ? { background: 'linear-gradient(90deg, currentColor 50%, transparent 50%)', border: '2px solid currentColor' }
        : { background: 'transparent', border: '2px solid currentColor', opacity: 0.6 };
  return <span aria-hidden="true" data-testid="status-dot" data-kind={kind} className="inline-block h-[10px] w-[10px] shrink-0 rounded-full" style={style} />;
}
