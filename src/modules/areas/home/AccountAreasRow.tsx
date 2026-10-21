// Account home's "Your areas" row (D112): one tap to Your areas, its words from areaStatus (the ONE mapping).
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { AREA_PATHS } from '@/lib/areaPaths';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { Card } from '@/modules/organiser/ui/Card';
import { SummaryRow } from '@/modules/organiser/ui/SummaryRow';
import { YOUR_AREAS_LABEL, accountAreasWords } from './areaStatus';
import { fetchMyRoles, myRolesQueryKey } from './rolesApi';

export function AccountAreasRow() {
  const navigate = useNavigate();
  const roles = useQuery({ queryKey: myRolesQueryKey, queryFn: fetchMyRoles });
  const progress = useProfileProgress(null);
  return (
    <Card testId="account-areas-row">
      <SummaryRow
        icon={<LayoutGrid />}
        label={YOUR_AREAS_LABEL}
        sublabel={accountAreasWords(roles.data, progress.data)}
        onPress={() => navigate(AREA_PATHS.areas)}
        testId="account-areas-link"
      />
    </Card>
  );
}
