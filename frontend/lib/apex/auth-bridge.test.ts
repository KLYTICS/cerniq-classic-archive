import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deriveApexSession,
  isApexProtectedMode,
  normalizeStringSet,
  resolveSovereignFromGithubLogin,
} from "./auth-bridge";

const SOVEREIGN_ENV = "APEX_SOVEREIGN_GITHUB_LOGINS";
const DEMO_ENV = "NEXT_PUBLIC_DEMO_MODE";

describe("normalizeStringSet", () => {
  it("returns empty set for undefined", () => {
    expect(normalizeStringSet(undefined).size).toBe(0);
  });

  it("returns empty set for empty string", () => {
    expect(normalizeStringSet("").size).toBe(0);
  });

  it("comma-splits, trims, lower-cases", () => {
    const set = normalizeStringSet(" Alpha , BETA ,gamma  ");
    expect(set.has("alpha")).toBe(true);
    expect(set.has("beta")).toBe(true);
    expect(set.has("gamma")).toBe(true);
    expect(set.size).toBe(3);
  });

  it("drops empty entries (trailing commas, double commas)", () => {
    const set = normalizeStringSet("alpha,,beta,");
    expect(set.size).toBe(2);
    expect(set.has("alpha")).toBe(true);
    expect(set.has("beta")).toBe(true);
  });
});

describe("resolveSovereignFromGithubLogin", () => {
  const originalEnv = process.env[SOVEREIGN_ENV];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[SOVEREIGN_ENV];
    } else {
      process.env[SOVEREIGN_ENV] = originalEnv;
    }
  });

  it("returns false when env is unset", () => {
    delete process.env[SOVEREIGN_ENV];
    expect(resolveSovereignFromGithubLogin("monykiss")).toBe(false);
  });

  it("returns false when env is set but login is null/undefined", () => {
    process.env[SOVEREIGN_ENV] = "monykiss";
    expect(resolveSovereignFromGithubLogin(null)).toBe(false);
    expect(resolveSovereignFromGithubLogin(undefined)).toBe(false);
  });

  it("returns false when login is empty string or whitespace", () => {
    process.env[SOVEREIGN_ENV] = "monykiss";
    expect(resolveSovereignFromGithubLogin("")).toBe(false);
    expect(resolveSovereignFromGithubLogin("   ")).toBe(false);
  });

  it("matches case-insensitively on both env and login", () => {
    process.env[SOVEREIGN_ENV] = "MonyKiss";
    expect(resolveSovereignFromGithubLogin("monykiss")).toBe(true);
    expect(resolveSovereignFromGithubLogin("MONYKISS")).toBe(true);
    expect(resolveSovereignFromGithubLogin("MonyKiss")).toBe(true);
  });

  it("rejects logins outside the allowlist", () => {
    process.env[SOVEREIGN_ENV] = "monykiss";
    expect(resolveSovereignFromGithubLogin("attacker")).toBe(false);
  });

  it("supports comma-delimited allowlists", () => {
    process.env[SOVEREIGN_ENV] = "monykiss, owner2, owner3";
    expect(resolveSovereignFromGithubLogin("owner2")).toBe(true);
    expect(resolveSovereignFromGithubLogin("owner3")).toBe(true);
    expect(resolveSovereignFromGithubLogin("monykiss")).toBe(true);
    expect(resolveSovereignFromGithubLogin("not-on-list")).toBe(false);
  });
});

describe("isApexProtectedMode", () => {
  const originalDemo = process.env[DEMO_ENV];

  afterEach(() => {
    if (originalDemo === undefined) {
      delete process.env[DEMO_ENV];
    } else {
      process.env[DEMO_ENV] = originalDemo;
    }
  });

  it("returns false when DEMO env is unset (DEMO is the default)", () => {
    delete process.env[DEMO_ENV];
    expect(isApexProtectedMode()).toBe(false);
  });

  it('returns false when DEMO is explicitly "true"', () => {
    process.env[DEMO_ENV] = "true";
    expect(isApexProtectedMode()).toBe(false);
  });

  it('returns true only when DEMO is the literal string "false"', () => {
    process.env[DEMO_ENV] = "false";
    expect(isApexProtectedMode()).toBe(true);
  });

  it("does not treat other strings as protected", () => {
    process.env[DEMO_ENV] = "FALSE";
    expect(isApexProtectedMode()).toBe(false);
    process.env[DEMO_ENV] = "0";
    expect(isApexProtectedMode()).toBe(false);
  });
});

describe("deriveApexSession", () => {
  const originalSovereign = process.env[SOVEREIGN_ENV];
  const originalDemo = process.env[DEMO_ENV];

  beforeEach(() => {
    delete process.env[SOVEREIGN_ENV];
    delete process.env[DEMO_ENV];
  });

  afterEach(() => {
    if (originalSovereign === undefined) delete process.env[SOVEREIGN_ENV];
    else process.env[SOVEREIGN_ENV] = originalSovereign;
    if (originalDemo === undefined) delete process.env[DEMO_ENV];
    else process.env[DEMO_ENV] = originalDemo;
  });

  it("returns null when cerniq user is null", () => {
    expect(deriveApexSession(null)).toBe(null);
  });

  it("maps cerniq user → viewer in DEMO mode regardless of githubLogin allowlist", () => {
    process.env[SOVEREIGN_ENV] = "monykiss";
    const session = deriveApexSession({
      id: "user-1",
      email: "user@example.com",
      githubLogin: "monykiss",
    });
    expect(session).toEqual({
      user: {
        id: "user-1",
        email: "user@example.com",
        providerSubject: "user-1",
        groups: [],
        githubLogin: "monykiss",
        role: "viewer",
        roleSource: "default",
      },
    });
  });

  it("elevates to sovereign in protected mode when githubLogin is on the allowlist", () => {
    process.env[DEMO_ENV] = "false";
    process.env[SOVEREIGN_ENV] = "monykiss";
    const session = deriveApexSession({
      id: "user-1",
      email: "user@example.com",
      githubLogin: "MonyKiss",
    });
    expect(session?.user.role).toBe("sovereign");
    expect(session?.user.roleSource).toBe("sovereign_github_allowlist");
  });

  it("stays as viewer in protected mode when githubLogin is null", () => {
    process.env[DEMO_ENV] = "false";
    process.env[SOVEREIGN_ENV] = "monykiss";
    const session = deriveApexSession({
      id: "user-1",
      email: "user@example.com",
      githubLogin: null,
    });
    expect(session?.user.role).toBe("viewer");
    expect(session?.user.githubLogin).toBe(null);
  });

  it("stays as viewer in protected mode when githubLogin is not on the allowlist", () => {
    process.env[DEMO_ENV] = "false";
    process.env[SOVEREIGN_ENV] = "owner";
    const session = deriveApexSession({
      id: "user-1",
      email: "user@example.com",
      githubLogin: "attacker",
    });
    expect(session?.user.role).toBe("viewer");
    expect(session?.user.roleSource).toBe("default");
  });

  it("normalizes empty email to null", () => {
    const session = deriveApexSession({
      id: "user-1",
      email: "",
    });
    expect(session?.user.email).toBe(null);
  });
});
