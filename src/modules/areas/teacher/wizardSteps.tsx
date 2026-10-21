import type { WizardStepDef } from '../wizardStep';
import { makeDoYouStep, makeRoleWizardSteps } from '../shared/roleWizard';

export const teacherWizardSteps: WizardStepDef[] = makeRoleWizardSteps('teacher');

export const doYouTeachStep: WizardStepDef = makeDoYouStep(
  'teacher',
  'Do you teach bachata?',
  'Yes lets you add your teaching details next. Every one is optional.',
);
