import { RoleProfilePage } from '../shared/RoleProfilePage';
import { DANCER_PROFILE_PATH, DEFAULT_AREA_PATHS, SIGN_IN_PATH } from '../shared/paths';

export interface DjProfilePageProps { areaPath?: string; dancerProfilePath?: string; signInPath?: string }

export default function DjProfilePage({
  areaPath = DEFAULT_AREA_PATHS.dj.area,
  dancerProfilePath = DANCER_PROFILE_PATH,
  signInPath = SIGN_IN_PATH,
}: DjProfilePageProps) {
  return <RoleProfilePage role="dj" areaPath={areaPath} blocked={{ dancerProfile: dancerProfilePath, signIn: signInPath }} />;
}
