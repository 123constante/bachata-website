import { ORG_PATHS } from '../../shell/paths';
import type { OrgPaths } from '../../shell/surface';

export type HelpRow = { id: string; label: string; to: string };

/** C41: each row is a job name linking into its flow. No paragraphs (D28). `paths` = the surface's (R1 or P3). */
export const helpRows = (paths: OrgPaths): ReadonlyArray<HelpRow> => [
  { id: 'change', label: 'Change a date', to: paths.change },
  { id: 'add', label: 'Add a date', to: paths.add },
  { id: 'cancel', label: 'Cancel a date', to: paths.cancel },
  { id: 'new', label: 'New event', to: paths.newWhat },
  { id: 'page', label: 'Edit your page', to: paths.page },
  { id: 'team', label: 'Team', to: paths.team },
  { id: 'handover', label: 'Hand over', to: paths.handover },
];

/** R1's rows. */
export const HELP_ROWS: ReadonlyArray<HelpRow> = helpRows(ORG_PATHS);
