// Account home's "Your areas" row (D112): one tap to Your areas, its words from areaStatus (the ONE mapping).
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { AREA_PATHS } from '@/lib/areaPaths';
import { useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { Card, SummaryRow } from '@/modules/organiser/ui';
import { YOUR_AREAS_LABEL, accountAreasRowWords } from './areaStatus';
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
        sublabel={accountAreasRowWords(roles, progress)}
        onPress={() => navigate(AREA_PATHS.areas)}
        testId="account-areas-link"
      />
    </Card>
  );
}
