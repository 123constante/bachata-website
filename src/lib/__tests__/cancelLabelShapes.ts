// The ONE table of cancellation-reason shapes the public-surface tests run over.
// `shown` is the reason text a dancer should see, or null for none.
export const CANCEL_REASON_SHAPES: { name: string; input: string | null; shown: string | null }[] = [
  { name: "reason 'Other'", input: 'Other', shown: null },
  { name: "'other' in another case with padding", input: '  other ', shown: null },
  { name: 'blank string', input: '', shown: null },
  { name: 'whitespace only', input: '   ', shown: null },
  { name: 'null', input: null, shown: null },
  { name: 'a real reason', input: 'Teacher unavailable', shown: 'Teacher unavailable' },
  { name: 'a real reason with padding', input: ' Venue closed ', shown: 'Venue closed' },
  {
    name: 'a long reason',
    input: 'Venue closed for refurbishment until further notice from the landlord',
    shown: 'Venue closed for refurbishment until further notice from the landlord',
  },
];
