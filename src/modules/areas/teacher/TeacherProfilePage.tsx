import { RoleProfilePage } from '../shared/RoleProfilePage';
import { DANCER_PROFILE_PATH, DEFAULT_AREA_PATHS, SIGN_IN_PATH } from '../shared/paths';

export interface TeacherProfilePageProps { areaPath?: string; dancerProfilePath?: string; signInPath?: string }

export default function TeacherProfilePage({
  areaPath = DEFAULT_AREA_PATHS.teacher.area,
  dancerProfilePath = DANCER_PROFILE_PATH,
  signInPath = SIGN_IN_PATH,
}: TeacherProfilePageProps) {
  return <RoleProfilePage role="teacher" areaPath={areaPath} blocked={{ dancerProfile: dancerProfilePath, signIn: signInPath }} />;
}
