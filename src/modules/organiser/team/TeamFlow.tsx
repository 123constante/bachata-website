import { flags } from '@/lib/featureFlags';
import AddSomeone from './AddSomeone';
import AddSomeoneR2 from './AddSomeoneR2';
import Person from './Person';
import PersonR2 from './PersonR2';

/** The routes under team/ that are not the list: one lazy chunk, the route names the screen. */
export default function TeamFlow({ step }: { step: 'add' | 'person' }) {
  if (flags.organiserTeamR2) return step === 'add' ? <AddSomeoneR2 /> : <PersonR2 />;
  return step === 'add' ? <AddSomeone /> : <Person />;
}
