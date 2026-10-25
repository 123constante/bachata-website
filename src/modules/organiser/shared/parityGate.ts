// Parity wave 1 (SW1): the series programme, line-up and event organisers need the
// admin migrations 20261129100000 / 20261129110000 (AW1), applied on prod (2026-10-20).
// This stays as the rollback switch: while false, every control that would send
// series.set_program or series.set_organisers is shown OFF with PARITY_GATE_REASON.
export const AW1_APPLIED = true;

/** The plain-words reason a gated control is off (no jargon). */
export const PARITY_GATE_REASON = 'Needs the next platform update';
