// @vitest-environment jsdom
/**
 * People arc S3, owner D9: the frame's Back. Reached from a page of this site -> history back
 * (the page they came from, not the list); opened straight from a shared link or a new tab ->
 * backHref (the world's list). The href is always backHref (works before hydration, new tab).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { PersonFrame, backGoesToHistory } from '../frame';

afterEach(cleanup);

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const Dj = () => <PersonFrame backHref="/djs" shareTitle="Morcilla on Bachata Calendar" roles={['dj']} current="dj" slug="papacito" />;

const app = (entries: string[], index?: number) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      <Where />
      <Routes>
        <Route path="/djs/:id" element={<Dj />} />
        <Route path="/event/:id" element={<Link to="/djs/papacito">to DJ</Link>} />
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );

describe('Back rule', () => {
  it('backGoesToHistory: only a real router key', () => {
    expect(backGoesToHistory('default')).toBe(false);
    expect(backGoesToHistory(undefined)).toBe(false);
    expect(backGoesToHistory('')).toBe(false);
    expect(backGoesToHistory('k3x9a')).toBe(true);
  });

  it('backGoesToHistory: the browser history idx wins over the key', () => {
    // A client redirect (replace) on the first page: a real key but nothing of this site behind it.
    expect(backGoesToHistory('k3x9a', 0)).toBe(false);
    expect(backGoesToHistory('default', 2)).toBe(true);
    expect(backGoesToHistory('k3x9a', 1)).toBe(true);
    expect(backGoesToHistory('k3x9a', 'x')).toBe(true);
  });

  it('opened straight from a shared link: Back goes to the list', () => {
    app(['/djs/papacito']);
    const back = screen.getByTestId('frame-back');
    expect(back.textContent).toBe('Back');
    expect(back.getAttribute('href')).toBe('/djs');
    fireEvent.click(back);
    expect(screen.getByTestId('where').textContent).toBe('/djs');
  });

  it('came from another page of the site: Back goes where they came from', () => {
    app(['/event/abc']);
    fireEvent.click(screen.getByText('to DJ'));
    expect(screen.getByTestId('where').textContent).toBe('/djs/papacito');
    const back = screen.getByTestId('frame-back');
    expect(back.getAttribute('href')).toBe('/djs');
    fireEvent.click(back);
    expect(screen.getByTestId('where').textContent).toBe('/event/abc');
  });

  it('a modified click (new tab) is left to the browser', () => {
    app(['/event/abc']);
    fireEvent.click(screen.getByText('to DJ'));
    fireEvent.click(screen.getByTestId('frame-back'), { metaKey: true });
    expect(screen.getByTestId('where').textContent).toBe('/djs/papacito');
  });
});
