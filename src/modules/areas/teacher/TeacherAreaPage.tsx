import { RoleAreaPage } from '../shared/RoleAreaPage';
import { DEFAULT_AREA_PATHS } from '../shared/paths';

export interface TeacherAreaPageProps { profilePath?: string; backPath?: string }

export default function TeacherAreaPage({ profilePath = DEFAULT_AREA_PATHS.teacher.profile, backPath = DEFAULT_AREA_PATHS.teacher.back }: TeacherAreaPageProps) {
  return <RoleAreaPage role="teacher" paths={{ profile: profilePath, back: backPath }} />;
}
