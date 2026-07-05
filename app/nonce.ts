import { createContext, useContext } from "react";

// Per-request CSP nonce. Set on the server by entry.server (wraps the whole tree
// in NonceProvider); read in root.tsx so <Scripts>/<ScrollRestoration> carry the
// matching nonce. On the client the provider is absent → useNonce() returns
// undefined, which is correct (the browser hydrates the already-nonced SSR DOM;
// it does not re-emit script tags).
export const NonceContext = createContext<string | undefined>(undefined);
export const NonceProvider = NonceContext.Provider;
export const useNonce = (): string | undefined => useContext(NonceContext);
