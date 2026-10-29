import { Link } from 'react-router-dom';
import { flags } from '@/lib/featureFlags';
import './GetListedHoloCta.css';

export const GetListedHoloCta = () => (
  <Link to={flags.organiserSelfServe ? "/account/new" : "/auth"} className="holo-cta" aria-label="Get listed as an organiser">
    <span className="holo-cta__diamond" aria-hidden="true" />
    Get Listed
  </Link>
);

export default GetListedHoloCta;
