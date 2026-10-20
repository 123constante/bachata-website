import { RoleAreaPage } from '../shared/RoleAreaPage';
import { DANCER_PROFILE_PATH, DEFAULT_AREA_PATHS, SIGN_IN_PATH } from '../shared/paths';

export interface TeacherAreaPageProps { profilePath?: string; backPath?: string; dancerProfilePath?: string; signInPath?: string }

export default function TeacherAreaPage({
  profilePath = DEFAULT_AREA_PATHS.teacher.profile,
  backPath = DEFAULT_AREA_PATHS.teacher.back,
  dancerProfilePath = DANCER_PROFILE_PATH,
  signInPath = SIGN_IN_PATH,
}: TeacherAreaPageProps) {
  return <RoleAreaPage role="teacher" paths={{ profile: profilePath, back: backPath, blocked: { dancerProfile: dancerProfilePath, signIn: signInPath } }} />;
}
