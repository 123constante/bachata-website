import type { StrengthStep } from '../../api/types';

/** What the strength tile says to add next (INTERFACE vocabulary -> words). */
export const NEXT_STEP_COPY: Record<StrengthStep, string> = {
  first_name: 'Add your first name',
  city: 'Add your city',
  role: 'Pick how you dance',
  photo: 'Add your photo to reach 70%',
  started_year: 'Add the year you started dancing',
  styles: 'Pick your favourite styles',
  bio_social: 'Add a bio and a link',
};

export const greeting = (hour: number): string => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
