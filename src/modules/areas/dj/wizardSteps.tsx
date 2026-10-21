import type { WizardStepDef } from '../wizardStep';
import { makeDoYouStep, makeRoleWizardSteps } from '../shared/roleWizard';

export const djWizardSteps: WizardStepDef[] = makeRoleWizardSteps('dj');

export const doYouDjStep: WizardStepDef = makeDoYouStep(
  'dj',
  'Do you DJ?',
  'Yes lets you add your DJ details next. Every one is optional.',
);
