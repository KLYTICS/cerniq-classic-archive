import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApexSession } from "./auth-bridge";

const loadApexSessionFromCookiesMock =
  vi.fn<() => Promise<ApexSession | null>>();

vi.mock("./auth-bridge", async () => {
  const actual =
    await vi.importActual<typeof import("./auth-bridge")>("./auth-bridge");
  return {
    ...actual,
    loadApexSessionFromCookies: () => loadApexSessionFromCookiesMock(),
  };
});

// Import AFTER the mock so the gate picks up the mocked loader.
const { ApexSovereignNotFoundError, requireApexSovereignAccess } = await import(
  "./sovereign-gate"
);

const DEMO_ENV = "NEXT_PUBLIC_DEMO_MODE";
const originalDemo = process.env[DEMO_ENV];

function sovereignSession(): ApexSession {
  return {
    user: {
      id: "user-1",
      email: "owner@example.com",
      providerSubject: "user-1",
      groups: [],
      githubLogin: "monykiss",
      role: "sovereign",
      roleSource: "sovereign_github_allowlist",
    },
  };
}

function viewerSession(): ApexSession {
  return {
    user: {
      id: "user-2",
      email: "viewer@example.com",
      providerSubject: "user-2",
      groups: [],
      githubLogin: null,
      role: "viewer",
      roleSource: "default",
    },
  };
}

describe("requireApexSovereignAccess — DEMO mode", () => {
  beforeEach(() => {
    delete process.env[DEMO_ENV];
    loadApexSessionFromCookiesMock.mockReset();
  });

  afterEach(() => {
    if (originalDemo === undefined) delete process.env[DEMO_ENV];
    else process.env[DEMO_ENV] = originalDemo;
  });

  it("returns null without consulting the session loader (DEMO is the default)", async () => {
    const result = await requireApexSovereignAccess();
    expect(result).toBe(null);
    expect(loadApexSessionFromCookiesMock).not.toHaveBeenCalled();
  });

  it('returns null when DEMO is explicitly "true"', async () => {
    process.env[DEMO_ENV] = "true";
    const result = await requireApexSovereignAccess();
    expect(result).toBe(null);
    expect(loadApexSessionFromCookiesMock).not.toHaveBeenCalled();
  });

  it("returns null even when a sovereign session would resolve (gate is off)", async () => {
    loadApexSessionFromCookiesMock.mockResolvedValue(sovereignSession());
    const result = await requireApexSovereignAccess();
    expect(result).toBe(null);
    expect(loadApexSessionFromCookiesMock).not.toHaveBeenCalled();
  });
});

describe("requireApexSovereignAccess — protected mode", () => {
  beforeEach(() => {
    process.env[DEMO_ENV] = "false";
    loadApexSessionFromCookiesMock.mockReset();
  });

  afterEach(() => {
    if (originalDemo === undefined) delete process.env[DEMO_ENV];
    else process.env[DEMO_ENV] = originalDemo;
  });

  it("throws ApexSovereignNotFoundError when the loader returns null (unauthenticated)", async () => {
    loadApexSessionFromCookiesMock.mockResolvedValue(null);
    await expect(requireApexSovereignAccess()).rejects.toBeInstanceOf(
      ApexSovereignNotFoundError,
    );
  });

  it("throws ApexSovereignNotFoundError when authenticated but not sovereign", async () => {
    loadApexSessionFromCookiesMock.mockResolvedValue(viewerSession());
    await expect(requireApexSovereignAccess()).rejects.toBeInstanceOf(
      ApexSovereignNotFoundError,
    );
  });

  it("returns the session when role is sovereign", async () => {
    const session = sovereignSession();
    loadApexSessionFromCookiesMock.mockResolvedValue(session);
    const result = await requireApexSovereignAccess();
    expect(result).toBe(session);
  });

  it("uses notFound semantics, not 403 — the thrown error name is stable", async () => {
    loadApexSessionFromCookiesMock.mockResolvedValue(viewerSession());
    let caught: unknown;
    try {
      await requireApexSovereignAccess();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApexSovereignNotFoundError);
    expect((caught as Error).name).toBe("ApexSovereignNotFoundError");
    expect((caught as Error).message).toBe("apex_sovereign_not_found");
  });
});
