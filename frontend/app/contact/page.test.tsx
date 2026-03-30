import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from 'react';
import ContactPage, { getInitialContactLanguage } from './page';

const mocks = vi.hoisted(() => ({
  analyticsTrack: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: mocks.analyticsTrack },
  EVENTS: { LEAD_FORM_SUBMITTED: 'Lead Form Submitted' },
}));

vi.mock('@/components/brand/CerniqLogo', () => ({
  CerniqMark: () => <div data-testid="cerniq-mark" />,
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  Send: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  CheckCircle2: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  Calendar: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  Mail: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
  Building2: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe('ContactPage', () => {
  beforeEach(() => {
    mocks.analyticsTrack.mockReset();
    mocks.fetch.mockReset();
    vi.stubGlobal('fetch', mocks.fetch);
    localStorage.clear();
  });

  it('renders the form, key page copy, and direct contact details', () => {
    render(<ContactPage />);

    expect(screen.getByRole('heading', { name: /book a personalized demo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/institution name/i)).toBeInTheDocument();
    expect(screen.getByText(/asset size/i)).toBeInTheDocument();
    expect(screen.getByText('erwin@cerniq.io')).toBeInTheDocument();
  });

  it('renders a hidden honeypot field for spam prevention', () => {
    render(<ContactPage />);

    const honeypotContainer = document.querySelector('[aria-hidden="true"]');
    expect(honeypotContainer).toBeInTheDocument();
    expect(honeypotContainer?.querySelector('input[name="website"]')).toHaveAttribute('tabindex', '-1');
  });

  it('starts in Spanish when the saved language preference is es', () => {
    localStorage.setItem('cerniq_lang', 'es');

    render(<ContactPage />);

    expect(screen.getByRole('heading', { name: /agende un demo personalizado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar a Espanol' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('defaults contact language to English when browser storage is unavailable', () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      expect(getInitialContactLanguage()).toBe('en');
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('switches language when the toggle is pressed', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);

    await user.click(screen.getByRole('button', { name: 'Cambiar a Espanol' }));

    expect(screen.getByRole('heading', { name: /agende un demo personalizado/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar a Espanol' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches back to English when the English toggle is pressed', async () => {
    const user = userEvent.setup();
    localStorage.setItem('cerniq_lang', 'es');

    render(<ContactPage />);

    await user.click(screen.getByRole('button', { name: 'Switch to English' }));

    expect(screen.getByRole('heading', { name: /book a personalized demo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('submits the form, tracks analytics, and shows the success state', async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({ ok: true });

    render(<ContactPage />);

    await user.type(screen.getByLabelText(/your name/i), 'Ana Rivera');
    await user.type(screen.getByLabelText(/work email/i), 'ana@coop.pr');
    await user.type(screen.getByLabelText(/institution name/i), 'Coop Capital');
    await user.selectOptions(screen.getByRole('combobox'), '$500M - $1B');
    await user.type(
      screen.getByPlaceholderText(/interested in cecl compliance and stress testing/i),
      'Please show CECL and stress testing.',
    );

    await user.click(screen.getByRole('button', { name: /request demo/i }));

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        '/api/demo-request',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });
    expect(mocks.analyticsTrack).toHaveBeenCalledWith('Lead Form Submitted', {
      source: 'contact_page',
      institution: 'Coop Capital',
      assets: '$500M - $1B',
    });
    expect(await screen.findByText(/request received/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try interactive demo now/i })).toHaveAttribute('href', '/demo');
  });

  it('shows a fallback error message when submission fails', async () => {
    const user = userEvent.setup();
    mocks.fetch.mockResolvedValue({ ok: false });

    render(<ContactPage />);

    await user.type(screen.getByLabelText(/your name/i), 'Ana Rivera');
    await user.type(screen.getByLabelText(/work email/i), 'ana@coop.pr');
    await user.type(screen.getByLabelText(/institution name/i), 'Coop Capital');
    await user.click(screen.getByRole('button', { name: /request demo/i }));

    expect(await screen.findByText(/we could not submit your request/i)).toBeInTheDocument();
    expect(mocks.analyticsTrack).not.toHaveBeenCalled();
  });

  it('does not submit when the honeypot field is filled', async () => {
    const user = userEvent.setup();
    render(<ContactPage />);

    const honeypotInput = document.querySelector('input[name="website"]') as HTMLInputElement;
    fireEvent.change(honeypotInput, { target: { value: 'spam-bot' } });

    await user.type(screen.getByLabelText(/your name/i), 'Ana Rivera');
    await user.type(screen.getByLabelText(/work email/i), 'ana@coop.pr');
    await user.type(screen.getByLabelText(/institution name/i), 'Coop Capital');
    await user.click(screen.getByRole('button', { name: /request demo/i }));

    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /request demo/i })).toBeInTheDocument();
  });
});
