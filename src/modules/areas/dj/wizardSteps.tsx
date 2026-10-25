import type { WizardStepDef } from '../wizardStep';
import { makeDoYouStep, makeRoleWizardSteps } from '../shared/roleWizard';

export const djWizardSteps: WizardStepDef[] = makeRoleWizardSteps('dj');

export const doYouDjStep: WizardStepDef = makeDoYouStep(
  'dj',
  'Do you DJ?',
  'Yes lets you add your DJ details next. Only your DJ name and the music you play are needed before your events can go live.',
);
