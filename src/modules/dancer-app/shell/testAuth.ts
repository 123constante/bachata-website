/**
 * Test-only auth stand-in for renderInShell. `@/hooks/useAuth` keeps its
 * context private, so a test file mocks the module once, at the top:
 *
 *   vi.mock('@/hooks/useAuth', async (importOriginal) =>
 *     (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
 *
 * and renderInShell({ auth: ... }) then sets who is signed in. The real module's
 * other exports (ProfileGateContext above all) are kept, so AppChrome-style
 * providers and readers share ONE context object. This file must not import
 * @/hooks/useAuth itself.
 */
export type TestUser = { id: string; email?: string; is_anonymous?: boolean };

export const testAuth: {
  user: TestUser | null;
  authStatus: 'resolving' | 'ready' | 'unavailable';
} = { user: null, authStatus: 'ready' };

export const setTestUser = (user: TestUser | null): void => {
  testAuth.user = user;
  testAuth.authStatus = 'ready';
};

export const authModuleMock = async <T extends Record<string, unknown>>(importOriginal: () => Promise<T>) => ({
  ...(await importOriginal()),
  useAuth: () => ({
    user: testAuth.user,
    session: null,
    isLoading: testAuth.authStatus === 'resolving',
    authStatus: testAuth.authStatus,
    signOut: async () => 'signed-out' as const,
    retryAuth: () => {},
  }),
});
