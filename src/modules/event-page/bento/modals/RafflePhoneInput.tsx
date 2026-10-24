// =============================================================================
// RafflePhoneInput -- the raffle's phone field: a thin wrapper around the ONE
// phone field (src/components/forms/PhoneInput.tsx, extracted from this file
// for the invite journey W2). Raffle look, raffle feedback test id; the value
// is always one the raffle itself emitted, so there is no legacy row.
// Outputs an E.164 string on every change (e.g. "+447700900123").
// =============================================================================

import React from 'react';
import { PhoneInput, isValidE164 } from '@/components/forms/PhoneInput';

export interface RafflePhoneInputProps {
  value: string;
  onChange: (e164: string, isValid: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  inputId?: string;
}

export const RafflePhoneInput: React.FC<RafflePhoneInputProps> = (props) => (
  <PhoneInput {...props} tone="raffle" feedbackTestId="raffle-phone-feedback" allowLegacy={false} showConfirm={false} />
);

export { isValidE164 };
