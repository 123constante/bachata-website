import { LEVEL_LABEL, type LevelKey } from '@/modules/organiser/shared/programmeModel';

/**
 * ONE way a level reads on every organiser screen (series programme rows, its sheet,
 * the per-date session sheet): the word only (S-FEEDBACK 3). The stored code never shows.
 */
export function LevelText({ level }: { level: string }) {
  return <span data-testid="level-text">{LEVEL_LABEL[level as LevelKey] ?? level}</span>;
}
