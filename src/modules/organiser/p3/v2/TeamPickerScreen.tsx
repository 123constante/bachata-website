import { useMemo } from 'react';
import { useTeamContext } from '../../team/useTeamContext';
import { PeoplePickerScreen, type PeoplePickerScreenProps } from './PeoplePickerScreen';

/** The picker with "On your team" filled from the page's team (organiser_team_v1). Only mounted with flag organiserPickerList. */
export function TeamPickerScreen(props: PeoplePickerScreenProps) {
  const { members } = useTeamContext();
  const teamIds = useMemo(() => new Set(members.flatMap((m) => [m.profileId, m.personId]).filter((x): x is string => !!x)), [members]);
  return <PeoplePickerScreen {...props} teamIds={props.teamIds ?? teamIds} />;
}
