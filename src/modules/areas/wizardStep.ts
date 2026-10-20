import type { ComponentType } from 'react';
export type WizardArea = 'dancer' | 'organiser' | 'teacher' | 'dj';
export interface WizardStepProps {
  field: string; value: unknown; required: boolean; saving: boolean; error: string | null;
  onAnswer(value: unknown): void; onSkip?: () => void;
}
export interface WizardStepDef {
  area: WizardArea; field: string; title: string; unlockLine?: string;
  Component: ComponentType<WizardStepProps>;
  toPatch(value: unknown): Record<string, unknown>;
}
