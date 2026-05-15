import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

import {
  ALM_CATEGORIES,
  ALM_MODULES,
  MODULES_BY_CATEGORY,
} from '@/lib/alm/registry';

const pathnameRef = { value: '/alm' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...rest
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...rest}>{children}</a>
  ),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ locale: 'en', t: (k: string) => k }),
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ logout: vi.fn() }),
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqLockup: () => <div>cerniq-lockup</div>,
}));

import Sidebar from './Sidebar';

function renderSidebar(pathname: string) {
  pathnameRef.value = pathname;
  return render(<Sidebar open={true} onClose={vi.fn()} />);
}

describe('Sidebar — ALM tree auto-discovery from registry', () => {
  it('renders every populated category label when the tree is expanded', () => {
    renderSidebar('/alm');
    const tree = document.getElementById('alm-module-tree')!;
    expect(tree).toBeInTheDocument();

    const populatedCategories = ALM_CATEGORIES.filter(
      (cat) => MODULES_BY_CATEGORY[cat.id].length > 0,
    );
    for (const cat of populatedCategories) {
      expect(within(tree).getByText(cat.label.en)).toBeInTheDocument();
    }
  });

  it('renders one link per registered module with its registry name + href', () => {
    renderSidebar('/alm');
    const tree = document.getElementById('alm-module-tree')!;

    for (const mod of ALM_MODULES) {
      const link = within(tree)
        .getAllByRole('link')
        .find((el) => el.getAttribute('href') === mod.href);
      expect(link, `expected a tree link for ${mod.slug} → ${mod.href}`).toBeDefined();
      expect(link!.textContent).toContain(mod.name.en);
    }
  });

  it('the link count inside the tree equals ALM_MODULES.length (no hidden hardcoding)', () => {
    renderSidebar('/alm');
    const tree = document.getElementById('alm-module-tree')!;
    const treeLinks = within(tree).getAllByRole('link');
    expect(treeLinks.length).toBe(ALM_MODULES.length);
  });

  it('shows a status badge for non-ga modules and omits it for ga modules', () => {
    renderSidebar('/alm');
    const tree = document.getElementById('alm-module-tree')!;

    const sampleNonGa = ALM_MODULES.find((m) => m.status !== 'ga');
    const sampleGa = ALM_MODULES.find((m) => m.status === 'ga');
    if (sampleNonGa) {
      const link = within(tree)
        .getAllByRole('link')
        .find((el) => el.getAttribute('href') === sampleNonGa.href)!;
      expect(link.textContent?.toLowerCase()).toContain(sampleNonGa.status);
    }
    if (sampleGa) {
      const link = within(tree)
        .getAllByRole('link')
        .find((el) => el.getAttribute('href') === sampleGa.href)!;
      expect(link.textContent?.toLowerCase()).not.toMatch(/\bga\b/);
    }
  });

  it('keeps the tree collapsed off /alm/* until the toggle is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar('/dashboard');
    expect(document.getElementById('alm-module-tree')).toBeNull();

    const toggle = screen.getByRole('button', {
      name: /sidebar\.almIntelligence/i,
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('alm-module-tree')).toBeInTheDocument();
  });
});
