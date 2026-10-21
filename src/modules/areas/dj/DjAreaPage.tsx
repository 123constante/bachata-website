import type { RoleWriters } from '../home/rolesApi';
import { RoleAreaPage } from '../shared/RoleAreaPage';
import { DANCER_PROFILE_PATH, DEFAULT_AREA_PATHS, SIGN_IN_PATH } from '../shared/paths';

export interface DjAreaPageProps { profilePath?: string; backPath?: string; backLabel?: string; dancerProfilePath?: string; signInPath?: string; writers?: RoleWriters }

export default function DjAreaPage({
  profilePath = DEFAULT_AREA_PATHS.dj.profile,
  backPath = DEFAULT_AREA_PATHS.dj.back,
  backLabel,
  dancerProfilePath = DANCER_PROFILE_PATH,
  signInPath = SIGN_IN_PATH,
  writers,
}: DjAreaPageProps) {
  return <RoleAreaPage role="dj" paths={{ profile: profilePath, back: backPath, backLabel, blocked: { dancerProfile: dancerProfilePath, signIn: signInPath } }} writers={writers} />;
}
