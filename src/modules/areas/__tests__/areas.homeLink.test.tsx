// @vitest-environment jsdom
/**
 * F2 (restyle slice A, fix pass 2): ONE way home per screen. A screen under GlobalLayout breadcrumbs already has the
 * Home crumb, so it must not also render SiteHomeLink; a screen without breadcrumbs (the person-area frames, Continue
 * as) renders exactly one.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccountShell } from '../shared/AccountShell';
import { AreaFrame } from '../shared/AreaFrame';

afterEach(cleanup);

describe('one home link per screen', () => {
  it('AccountShell renders exactly one SiteHomeLink by default, none with homeLink={false}', () => {
    render(<MemoryRouter><AccountShell>x</AccountShell></MemoryRouter>);
    expect(screen.getAllByTestId('site-home-link')).toHaveLength(1);
    cleanup();
    render(<MemoryRouter><AccountShell homeLink={false}>x</AccountShell></MemoryRouter>);
    expect(screen.queryByTestId('site-home-link')).toBeNull();
  });
  it('AreaFrame (no breadcrumbs) renders exactly one', () => {
    render(<MemoryRouter><AreaFrame title="t" back={{ to: '/a', label: 'A' }}>x</AreaFrame></MemoryRouter>);
    expect(screen.getAllByTestId('site-home-link')).toHaveLength(1);
  });
  // The sweep: every screen file that puts an AccountShell under GlobalLayout breadcrumbs opts out of the second link.
  it.each(['src/pages/Account.tsx', 'src/pages/AccountSettings.tsx'])('%s: every AccountShell under breadcrumbs has homeLink={false}', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/breadcrumbs=\{buildBreadcrumbs/);
    const shells = src.match(/<AccountShell\b[^>]*>/g) ?? [];
    expect(shells.length).toBeGreaterThan(0);
    for (const tag of shells) expect(tag).toContain('homeLink={false}');
  });
  it('Continue as (no GlobalLayout breadcrumbs) keeps its one SiteHomeLink', () => {
    const src = readFileSync('src/components/account/profiles/ContinueAsPage.tsx', 'utf8');
    expect(src).not.toMatch(/breadcrumbs=/);
    for (const tag of src.match(/<AccountShell\b[^>]*>/g) ?? []) expect(tag).not.toContain('homeLink={false}');
  });
});
