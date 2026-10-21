import type { RoleWriters } from '../home/rolesApi';
import { RoleAreaPage } from '../shared/RoleAreaPage';
import { DANCER_PROFILE_PATH, DEFAULT_AREA_PATHS, SIGN_IN_PATH } from '../shared/paths';

export interface TeacherAreaPageProps { profilePath?: string; backPath?: string; backLabel?: string; dancerProfilePath?: string; signInPath?: string; writers?: RoleWriters }

export default function TeacherAreaPage({
  profilePath = DEFAULT_AREA_PATHS.teacher.profile,
  backPath = DEFAULT_AREA_PATHS.teacher.back,
  backLabel,
  dancerProfilePath = DANCER_PROFILE_PATH,
  signInPath = SIGN_IN_PATH,
  writers,
}: TeacherAreaPageProps) {
  return <RoleAreaPage role="teacher" paths={{ profile: profilePath, back: backPath, backLabel, blocked: { dancerProfile: dancerProfilePath, signIn: signInPath } }} writers={writers} />;
}
