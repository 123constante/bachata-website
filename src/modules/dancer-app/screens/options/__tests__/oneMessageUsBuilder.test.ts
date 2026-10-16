import { describe, expect, it } from 'vitest';
import { PROFILE_HELP_MESSAGE, dancerMessageUsUrl } from '@/modules/dancer-app/api/messageUs';
import { HELP_MESSAGE, messageUsUrl, optionsRows } from '../optionsModel';

// One message-us builder for the dancer area (integration leftover b): Options reuses
// api/messageUs, never a second copy of the WhatsApp parse or of the help message.
describe('Options uses the one dancer message-us builder', () => {
  it('messageUsUrl IS api/messageUs dancerMessageUsUrl', () => {
    expect(messageUsUrl).toBe(dancerMessageUsUrl);
  });
  it('the help message is the shared profile-help message', () => {
    expect(HELP_MESSAGE).toBe(PROFILE_HELP_MESSAGE);
  });
  it('the Help row links the same URL the shared builder makes', () => {
    const help = optionsRows({ other_roles: [], is_active: true }).find((r) => r.id === 'help');
    expect(help?.href).toBe(dancerMessageUsUrl(PROFILE_HELP_MESSAGE));
  });
});
