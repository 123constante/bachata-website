import ToWhom from './ToWhom';
import Confirm from './Confirm';

/** Hand over (S6, boards C30 -> C31 -> Done): one lazy chunk, the route names the step. */
export default function HandoverFlow({ step }: { step: 'to' | 'confirm' }) {
  return step === 'to' ? <ToWhom /> : <Confirm />;
}
