/**
 * A gate must not lag its migration: while admin's A1 / AW1 versions are listed
 * as applied on prod (appliedMigrations.json), the gate constants must be true.
 * (2026-10-20: both sat false for days after prod had the migrations.)
 */
import { describe, expect, it } from 'vitest';
import applied from '../shared/appliedMigrations.json';
import { A1_APPLIED } from '../shared/a1Gate';
import { AW1_APPLIED } from '../shared/parityGate';

const GATES: Record<string, boolean> = { A1_APPLIED, AW1_APPLIED };

describe('gate constants follow the prod ledger snapshot', () => {
  it('lists the four applied versions', () => {
    expect(Object.values(applied.gates).flat().sort()).toEqual(['20261129060000', '20261129070000', '20261129100000', '20261129110000']);
  });
  it.each(Object.entries(applied.gates))('%s is true while %j are applied', (gate, versions) => {
    expect(versions.length).toBeGreaterThan(0);
    expect(GATES[gate]).toBe(true);
  });
});
