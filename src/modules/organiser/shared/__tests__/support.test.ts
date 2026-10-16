import { afterEach, describe, expect, it, vi } from 'vitest';
import { supportLinks } from '../support';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('supportLinks (D7)', () => {
  it('reads the two env vars', () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', 'https://wa.me/440000000000');
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'help@example.com');
    expect(supportLinks()).toEqual({ whatsapp: 'https://wa.me/440000000000', email: 'help@example.com' });
  });

  it('absent or blank -> null, so the row hides (never a dead link)', () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', '');
    vi.stubEnv('VITE_SUPPORT_EMAIL', '   ');
    expect(supportLinks()).toEqual({ whatsapp: null, email: null });
  });

  it('a value that is not a link or an address is treated as absent', () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', 'call Ricky');
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'not-an-email');
    expect(supportLinks()).toEqual({ whatsapp: null, email: null });
  });

  it('a WhatsApp link with no number after the host is treated as absent', () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', 'https://wa.me/');
    vi.stubEnv('VITE_SUPPORT_EMAIL', 'help@example.com');
    expect(supportLinks()).toEqual({ whatsapp: null, email: 'help@example.com' });
  });
});
