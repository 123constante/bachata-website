import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import { getListedTarget } from '@/lib/getListedTarget';
import './GetListedHoloCta.css';

export const GetListedHoloCta = () => {
  const target = getListedTarget(flags.organiserSelfServe);
  const inner = (
    <>
      <span className="holo-cta__diamond" aria-hidden="true" />
      Get Listed
    </>
  );
  return target.external ? (
    <a href={target.href} target="_blank" rel="noopener noreferrer" className="holo-cta" aria-label="Get listed as an organiser">{inner}</a>
  ) : (
    <Link to={target.href} className="holo-cta" aria-label="Get listed as an organiser">{inner}</Link>
  );
};

export default GetListedHoloCta;
