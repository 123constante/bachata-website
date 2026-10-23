import type { CSSProperties } from 'react';

export const gradientBg = 'linear-gradient(120deg, var(--da-gradient-from) 0%, var(--da-gradient-mid) 52%, var(--da-gradient-to) 100%)';

export const linkStyle: CSSProperties = {
  color: 'var(--da-accent)',
  fontWeight: 700,
  fontSize: 14,
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
};

export const buttonStyle: CSSProperties = {
  minHeight: 48,
  borderRadius: 12,
  padding: '0 16px',
  background: 'var(--da-accent)',
  color: 'var(--da-on-accent)',
  fontWeight: 800,
  fontSize: 15,
  border: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
};
