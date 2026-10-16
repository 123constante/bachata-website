import { test } from '@playwright/test';

test('a plain walk title', async () => {});
test('it\'s an escaped title', async () => {});

for (const [shape, what] of [
  ['two-orgs', 'lists organisers first'],
  ['one-org', 'lists one organiser'],
] as const) {
  test(`${shape}: ${what}`, async () => {});
}
