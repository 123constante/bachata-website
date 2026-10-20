import { createContext, useContext } from 'react';

/** What the wizard's steps need from the screen: the organiser logo upload (needs the page id) and the wizard's own path (to come back to). */
export interface WizardEnv { uploadLogo: ((file: File) => Promise<string>) | null; returnTo: string }

export const WizardEnvContext = createContext<WizardEnv>({ uploadLogo: null, returnTo: '' });
export const useWizardEnv = (): WizardEnv => useContext(WizardEnvContext);
