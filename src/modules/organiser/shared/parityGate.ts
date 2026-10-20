// Parity wave 1 (SW1): the series programme, line-up and event organisers need the
// admin migrations 20261126220000 / 20261126230000 (AW1) on prod. Until the merge
// train applies them and flips this to true, every control that would send
// series.set_program or series.set_organisers is shown OFF with PARITY_GATE_REASON.
export const AW1_APPLIED = false;

/** The plain-words reason a gated control is off (no jargon). */
export const PARITY_GATE_REASON = 'Needs the next platform update';
