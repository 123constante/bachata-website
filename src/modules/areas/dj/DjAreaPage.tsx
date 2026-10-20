import { RoleAreaPage } from '../shared/RoleAreaPage';
import { DANCER_PROFILE_PATH, DEFAULT_AREA_PATHS, SIGN_IN_PATH } from '../shared/paths';

export interface DjAreaPageProps { profilePath?: string; backPath?: string; dancerProfilePath?: string; signInPath?: string }

export default function DjAreaPage({
  profilePath = DEFAULT_AREA_PATHS.dj.profile,
  backPath = DEFAULT_AREA_PATHS.dj.back,
  dancerProfilePath = DANCER_PROFILE_PATH,
  signInPath = SIGN_IN_PATH,
}: DjAreaPageProps) {
  return <RoleAreaPage role="dj" paths={{ profile: profilePath, back: backPath, blocked: { dancerProfile: dancerProfilePath, signIn: signInPath } }} />;
}
