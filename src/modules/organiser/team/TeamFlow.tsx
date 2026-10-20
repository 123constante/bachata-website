import AddSomeone from './AddSomeone';
import Person from './Person';

/** The routes under team/ that are not the list: one lazy chunk, the route names the screen. */
export default function TeamFlow({ step }: { step: 'add' | 'person' }) {
  return step === 'add' ? <AddSomeone /> : <Person />;
}
