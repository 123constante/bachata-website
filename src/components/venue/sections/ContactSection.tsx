import { Phone, Mail, Globe, Instagram } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

type Props = {
  phone: string | null | undefined;
  email: string | null | undefined;
  website: string | null | undefined;
  instagram: string | null | undefined;
};

export const ContactSection = ({ phone, email, website, instagram }: Props) => {
  if (!phone && !email && !website && !instagram) return null;
  const Item = ({
    href,
    icon: Icon,
    label,
    external,
  }: {
    href: string;
    icon: typeof Phone;
    label: string;
    external?: boolean;
  }) => (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex flex-col items-center gap-1 rounded-md border border-venue-card-border bg-venue-card-pill hover:bg-venue-card transition-colors p-1.5 min-w-0"
    >
      <Icon className="w-4 h-4 text-venue-ember flex-shrink-0" aria-hidden="true" />
      <span className="text-[9px] uppercase tracking-wide text-venue-card-pill-fg font-semibold">{label}</span>
    </a>
  );
  return (
    <VenueSectionTile eyebrow="CONTACT" icon={Phone}>
      <div className="grid grid-cols-2 gap-1">
        {phone && <Item href={`tel:${phone}`} icon={Phone} label="Call" />}
        {email && <Item href={`mailto:${email}`} icon={Mail} label="Email" />}
        {website && <Item href={website} icon={Globe} label="Web" external />}
        {instagram && (
          <Item
            href={`https://instagram.com/${instagram.replace('@', '')}`}
            icon={Instagram}
            label="IG"
            external
          />
        )}
      </div>
    </VenueSectionTile>
  );
};
export default ContactSection;
