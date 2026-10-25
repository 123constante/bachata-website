import { createContext, useContext } from 'react';

/**
 * True while a role page (TeacherProfile / DJProfile / DancerProfile) is rendered
 * as a TAB of /people/:id. The person page owns the chrome and the identity
 * (photo, name once, chips), so in embedded mode the role page drops its own
 * GlobalLayout shell, its identity tile and its canonical-URL rewrite.
 */
export const EmbeddedProfileContext = createContext(false);

export const useEmbeddedProfile = () => useContext(EmbeddedProfileContext);
