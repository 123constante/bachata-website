import { LEVEL_LABEL, LEVEL_SHORT, type LevelKey } from '@/modules/organiser/shared/programmeModel';

/**
 * ONE way a level reads on every organiser screen (series programme rows, its sheet,
 * the per-date session sheet): the short chip, then the word. The short form is
 * hidden from screen readers, which read the word once.
 */
export function LevelText({ level }: { level: string }) {
  const short = LEVEL_SHORT[level as LevelKey] ?? level;
  const word = LEVEL_LABEL[level as LevelKey] ?? level;
  return (
    <span className="inline-flex items-baseline gap-[4px]" data-testid="level-text">
      <span aria-hidden="true" className="font-semibold">{short}</span> <span>{word}</span>
    </span>
  );
}
