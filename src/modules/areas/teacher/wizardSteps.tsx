import type { WizardStepDef } from '../wizardStep';
import { makeDoYouStep, makeRoleWizardSteps } from '../shared/roleWizard';

export const teacherWizardSteps: WizardStepDef[] = makeRoleWizardSteps('teacher');

export const doYouTeachStep: WizardStepDef = makeDoYouStep(
  'teacher',
  'Do you teach bachata?',
  'Yes lets you add your teaching details next. Only the styles you teach are needed before your events can go live.',
);
