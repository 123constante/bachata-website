import { describe, expect, it } from 'vitest';
import { pageModel } from '../pageModel';
import type { MyDancerEdit } from '../../../api/types';

// Walk 2026-10-17: the role line read "It says you follower". One row per stored
// dance_role (prod: NULL, 'Leader', 'Follower', 'Lead and Follow').
const shape = (dance_role: string | null, city_name: string | null) =>
  ({ profile_id: 'p1', first_name: 'A', avatar_url: null, bio: null, is_active: true, complete: false, dance_role, city_name }) as unknown as MyDancerEdit;

describe('pageModel role line, by stored dance_role', () => {
  it.each([
    ['Leader', 'London', 'It says you lead and you dance in London.'],
    ['Follower', 'London', 'It says you follow and you dance in London.'],
    ['Lead and Follow', 'London', 'It says you lead and follow and you dance in London.'],
    ['Leader', null, 'It says you lead.'],
    ['Follower', null, 'It says you follow.'],
    [null, 'London', 'It says you dance in London.'],
    [null, null, 'It does not say your city or dance role yet.'],
  ])('%s / %s', (role, city, line) => {
    expect(pageModel(shape(role, city)).lookLines).toContain(line);
  });
});
