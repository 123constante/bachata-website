import { RoleProfilePage } from '../shared/RoleProfilePage';
import { DEFAULT_AREA_PATHS } from '../shared/paths';

export interface TeacherProfilePageProps { areaPath?: string }

export default function TeacherProfilePage({ areaPath = DEFAULT_AREA_PATHS.teacher.area }: TeacherProfilePageProps) {
  return <RoleProfilePage role="teacher" areaPath={areaPath} />;
}
