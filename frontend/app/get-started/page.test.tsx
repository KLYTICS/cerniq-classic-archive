import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode, SVGProps } from "react";
import GetStartedPage from "./page";

const {
  replaceMock,
  submitDemoRequestMock,
  getCurrentUserMock,
  createCheckoutSessionMock,
} = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  submitDemoRequestMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  createCheckoutSessionMock: vi.fn(),
}));
const authState = {
  initialized: true,
  isAuthenticated: false,
  user: null as null | { id: string; email: string; name?: string },
  access: null as null | {
    platformAccessAllowed: boolean;
    isMasterCeo: boolean;
    isPaid: boolean;
    isDemo: boolean;
    effectiveTier: string;
    effectiveStatus: string | null;
    effectivePeriodEnd: string | null;
    daysRemaining: number | null;
    reason: string;
  },
  setAccess: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/store", () => ({
  useAuthStore: (selector?: (state: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
}));

vi.mock("@/lib/api", () => ({
  apiClient: {
    submitDemoRequest: submitDemoRequestMock,
    getCurrentUser: getCurrentUserMock,
  },
}));

vi.mock("@/lib/billing", () => ({
  createCheckoutSession: createCheckoutSessionMock,
}));

vi.mock("@/lib/subscription", () => ({
  rememberPortalUser: vi.fn(),
}));

vi.mock("lucide-react", () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    ArrowRight: Icon,
    CheckCircle2: Icon,
    FileText: Icon,
    Lock: Icon,
    Upload: Icon,
  };
});

describe("GetStartedPage", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    submitDemoRequestMock.mockReset();
    getCurrentUserMock.mockReset();
    createCheckoutSessionMock.mockReset();
    authState.initialized = true;
    authState.isAuthenticated = false;
    authState.user = null;
    authState.access = null;
    authState.setAccess.mockReset();
  });

  it("captures guest intake and shows preview + paid unlock state", async () => {
    submitDemoRequestMock.mockResolvedValue({ ok: true });
    render(<GetStartedPage />);

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Maria" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@institution.com"), {
      target: { value: "maria@coop.pr" },
    });
    fireEvent.change(screen.getByPlaceholderText("Institution name"), {
      target: { value: "Coop Test" },
    });
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "cooperativa" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(submitDemoRequestMock).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole("link", { name: /Preview sample output/i }),
    ).toHaveAttribute("href", "/preview/cooperativa-oriental");
    expect(
      screen.getByRole("button", { name: /Unlock secure upload — \$750/i }),
    ).toBeInTheDocument();
  });

  it("redirects paid users directly into the upload workflow", async () => {
    authState.isAuthenticated = true;
    authState.user = { id: "user-1", email: "qa@cerniq.io" };
    authState.access = {
      platformAccessAllowed: true,
      isMasterCeo: false,
      isPaid: true,
      isDemo: false,
      effectiveTier: "monthly",
      effectiveStatus: "active",
      effectivePeriodEnd: null,
      daysRemaining: null,
      reason: "paid",
    };

    render(<GetStartedPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/portal/submit?createCycle=1");
    });
  });
});
