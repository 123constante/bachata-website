import { CalendarDays, Home, UserRound, Users, type LucideIcon } from 'lucide-react';
import { ORG_PATHS } from './paths';

export interface Tab {
  key: 'home' | 'events' | 'team' | 'profile';
  label: string;
  to: string;
  Icon: LucideIcon;
  end?: boolean;
}

export const TABS: readonly Tab[] = [
  { key: 'home', label: 'Home', to: ORG_PATHS.home, Icon: Home, end: true },
  { key: 'events', label: 'Events', to: ORG_PATHS.events, Icon: CalendarDays },
  { key: 'team', label: 'Team', to: ORG_PATHS.team, Icon: Users },
  { key: 'profile', label: 'Profile', to: ORG_PATHS.profile, Icon: UserRound },
];
