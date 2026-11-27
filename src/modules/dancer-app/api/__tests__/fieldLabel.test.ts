import { describe, expect, it } from 'vitest';
import { FIELD_LABEL } from '../errors';
import { SAVE_KEYS } from '../types';

describe('FIELD_LABEL', () => {
  it.each(SAVE_KEYS.map((k) => [k]))('%s has plain words, so an error never reads "Your undefined"', (key) => {
    const label = FIELD_LABEL[key];
    expect(typeof label).toBe('string');
    expect(label.trim().length).toBeGreaterThan(0);
  });
});
