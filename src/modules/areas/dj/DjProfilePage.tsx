import { RoleProfilePage } from '../shared/RoleProfilePage';
import { DEFAULT_AREA_PATHS } from '../shared/paths';

export interface DjProfilePageProps { areaPath?: string }

export default function DjProfilePage({ areaPath = DEFAULT_AREA_PATHS.dj.area }: DjProfilePageProps) {
  return <RoleProfilePage role="dj" areaPath={areaPath} />;
}
