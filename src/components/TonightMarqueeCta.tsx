import { Link } from 'react-router-dom';
import './TonightMarqueeCta.css';

const HORIZONTAL_BULB_X = ['8%', '16.4%', '24.8%', '33.2%', '41.6%', '50%', '58.4%', '66.8%', '75.2%', '83.6%', '92%'];
const VERTICAL_BULB_Y = ['22%', '50%', '78%'];

interface TonightMarqueeCtaProps {
  to: string;
}

export function TonightMarqueeCta({ to }: TonightMarqueeCtaProps) {
  return (
    <Link to={to} className="tonight-cta-wrap" aria-label="See tonight's events">
      <span className="tonight-cta-bulbs" aria-hidden="true">
        {HORIZONTAL_BULB_X.map((left) => (
          <span key={`t-${left}`} className="tonight-cta-bulb top" style={{ left }} />
        ))}
        {HORIZONTAL_BULB_X.map((left) => (
          <span key={`b-${left}`} className="tonight-cta-bulb bot" style={{ left }} />
        ))}
        {VERTICAL_BULB_Y.map((top) => (
          <span key={`l-${top}`} className="tonight-cta-bulb left" style={{ top }} />
        ))}
        {VERTICAL_BULB_Y.map((top) => (
          <span key={`r-${top}`} className="tonight-cta-bulb right" style={{ top }} />
        ))}
      </span>
      <span className="tonight-cta-pill">
        <small>★ TODAYS EVENTS ★</small>
        <span>Click Here</span>
      </span>
    </Link>
  );
}

export default TonightMarqueeCta;
