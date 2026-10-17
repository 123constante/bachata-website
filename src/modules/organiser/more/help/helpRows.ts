import { ORG_PATHS } from '../../shell/paths';

/** C41: each row is a job name linking into its flow. No paragraphs (D28). */
export const HELP_ROWS: ReadonlyArray<{ id: string; label: string; to: string }> = [
  { id: 'change', label: 'Change a date', to: ORG_PATHS.change },
  { id: 'add', label: 'Add a date', to: ORG_PATHS.add },
  { id: 'cancel', label: 'Cancel a date', to: ORG_PATHS.cancel },
  { id: 'new', label: 'New event', to: ORG_PATHS.newWhat },
  { id: 'page', label: 'Edit your page', to: ORG_PATHS.page },
  { id: 'team', label: 'Team', to: ORG_PATHS.team },
  { id: 'handover', label: 'Hand over', to: ORG_PATHS.handover },
];
