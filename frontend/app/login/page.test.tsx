import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from "react";
import LoginPage from "./page";

const {
  mockPush,
  mockReplace,
  mockLogin,
  mockRegister,
  mockGetCurrentUser,
  mockSetAccess,
  mockSetSession,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockLogin: vi.fn(),
  mockRegister: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockSetAccess: vi.fn(),
  mockSetSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, back: vi.fn(), replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/login",
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    login: mockLogin,
    register: mockRegister,
    getCurrentUser: mockGetCurrentUser,
  },
}));

vi.mock("@/lib/analytics", () => ({
  analytics: { identify: vi.fn(), track: vi.fn() },
  EVENTS: { LOGIN: "Logged In", SIGNUP: "Signed Up" },
}));

vi.mock("@/lib/billing", () => ({
  getCurrentSubscription: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/subscription", () => ({
  hasPaidPortalAccess: vi.fn().mockReturnValue(false),
  isRememberedPortalUser: vi.fn().mockReturnValue(false),
  rememberPortalUser: vi.fn(),
}));

vi.mock("@/components/brand/CerniqLogo", () => ({
  CerniqMark: () => <div data-testid="cerniq-mark" />,
}));

vi.mock("@/lib/store", () => ({
  useAuthStore: () => ({
    initialized: true,
    isAuthenticated: false,
    user: null,
    setAccess: mockSetAccess,
    setSession: mockSetSession,
  }),
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => ({
    locale: "en",
    setLocale: vi.fn(),
    t: (key: string) => {
      const map: Record<string, string> = {
        "login.tagline": "ALM Intelligence",
        "login.signInToAccount": "Sign in to your account",
        "login.createAccount": "Create your account",
        "login.email": "Email",
        "login.emailPlaceholder": "you@institution.com",
        "login.password": "Password",
        "login.forgotPassword": "Forgot password?",
        "login.signIn": "Sign In",
        "login.signUp": "Sign Up",
        "login.noAccount": "Don't have an account?",
        "login.hasAccount": "Already have an account?",
        "login.orContinueWith": "or continue with",
        "login.featureALM": "Full ALM analysis",
        "login.featureRatios": "12 COSSEC/NCUA ratios",
        "login.featureReports": "Board-ready reports",
        "login.featureEncryption": "Bank-grade encryption",
        "common.processing": "Processing...",
        "common.google": "Google",
        "common.github": "GitHub",
      };
      return map[key] || key;
    },
  }),
}));

vi.mock("lucide-react", () => ({
  ArrowRight: (props: SVGProps<SVGSVGElement>) => <svg {...props} />,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockGetCurrentUser.mockReset();
    mockSetAccess.mockReset();
    mockSetSession.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the email input with correct type", () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText("Email");
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("renders the password input with correct type", () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("renders a submit button", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
  });

  it("renders the secure workspace access action", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("button", { name: /email secure sign-in link/i }),
    ).toBeInTheDocument();
  });

  it("renders toggle between login and signup modes", () => {
    render(<LoginPage />);

    expect(screen.getByText(/Don't have an account/i)).toBeInTheDocument();
  });

  it("falls back to dashboard instead of access-required when profile resolution is transiently unavailable", async () => {
    mockLogin.mockResolvedValue({
      user: { id: "user-1", email: "owner@cerniq.io" },
    });
    mockGetCurrentUser.mockRejectedValue(new Error("profile unavailable"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@cerniq.io" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    });

    await waitFor(() => {
      expect(mockSetSession).toHaveBeenCalledWith(
        { id: "user-1", email: "owner@cerniq.io" },
        null,
      );
      expect(mockSetAccess).toHaveBeenLastCalledWith(null);
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    expect(mockPush).not.toHaveBeenCalledWith("/access-required");
  });

  it("routes free authenticated users to dashboard instead of access-required", async () => {
    mockLogin.mockResolvedValue({
      user: { id: "user-2", email: "free@cerniq.io" },
    });
    mockGetCurrentUser.mockResolvedValue({
      id: "user-2",
      email: "free@cerniq.io",
      access: {
        platformAccessAllowed: false,
        isMasterCeo: false,
        isPaid: false,
        isDemo: false,
        effectiveTier: "free",
        effectiveStatus: null,
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: "subscription_required",
      },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "free@cerniq.io" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    expect(mockPush).not.toHaveBeenCalledWith("/access-required");
  });

  it("routes the master account to dashboard after profile resolution", async () => {
    mockLogin.mockResolvedValue({
      user: { id: "master-1", email: "data.ai.kiess@gmail.com" },
    });
    mockGetCurrentUser.mockResolvedValue({
      id: "master-1",
      email: "data.ai.kiess@gmail.com",
      access: {
        platformAccessAllowed: true,
        isMasterCeo: true,
        isPaid: false,
        isDemo: false,
        effectiveTier: "free",
        effectiveStatus: null,
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: "master_ceo",
      },
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "data.ai.kiess@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "ErwinKiess!CERNIQ2026" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    });

    await waitFor(() => {
      expect(mockSetAccess).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isMasterCeo: true,
          reason: "master_ceo",
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});
