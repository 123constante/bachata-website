import { RoleAreaPage } from '../shared/RoleAreaPage';
import { DEFAULT_AREA_PATHS } from '../shared/paths';

export interface DjAreaPageProps { profilePath?: string; backPath?: string }

export default function DjAreaPage({ profilePath = DEFAULT_AREA_PATHS.dj.profile, backPath = DEFAULT_AREA_PATHS.dj.back }: DjAreaPageProps) {
  return <RoleAreaPage role="dj" paths={{ profile: profilePath, back: backPath }} />;
}
