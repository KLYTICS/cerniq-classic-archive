import { expect, test } from "@playwright/test";

test.describe("Admin control tower", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("cerniq_cookie_consent", "accepted");
    });
  });

  test("authenticates, runs a safe action, and opens a subordinate workspace", async ({
    page,
  }) => {
    await page.route("**/admin/api/control-tower/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          generatedAt: "2026-04-08T18:00:00.000Z",
          health: {
            api: "healthy",
            database: "up",
            uptimeSeconds: 1800,
            memoryPercent: 42,
            timestamp: "2026-04-08T18:00:00.000Z",
          },
          executive: {
            demoRequests: 12,
            institutions: 5,
            users: 9,
            prospects: 21,
            recentUsers: 3,
            totalReportJobs: 11,
            completedReports: 7,
            failedReports: 1,
            activeSubscriptions: 4,
            totalSubscriptions: 6,
            mrr: 1196,
            arr: 14352,
          },
          stats: {
            demoRequests: 12,
            institutions: 5,
            users: 9,
            prospects: 21,
            recentUsers: 3,
            totalReportJobs: 11,
            completedReports: 7,
            failedReports: 1,
          },
          revenue: {
            activeSubscriptions: 4,
            totalSubscriptions: 6,
            mrr: 1196,
            arr: 14352,
          },
          pipeline: {
            counts: { awaitingData: 2, processing: 1, complete: 7, failed: 1 },
            recentJobs: [],
          },
          portal: {
            counts: {
              awaitingData: 2,
              validationFailed: 1,
              processing: 1,
              complete: 7,
              failed: 0,
              stalledActivations: 1,
            },
            stalledJobs: [],
            recentActionableJobs: [],
          },
          exports: {
            completedJobs: 7,
            onDemandFallbackJobs: 1,
            readyManifestCount: 14,
            degradedCount: 1,
          },
          demoSeats: {
            active: 4,
            expired: 2,
            expiringSoon: 1,
            recent: [],
          },
          intelligence: {
            workspace: { id: "ws-1", name: "Cerniq Intelligence" },
            stats: {
              totalAccounts: 24,
              buyers: 15,
              competitors: 9,
              staleAccounts: 3,
              overdueActions: 2,
            },
            hotChanges: [],
            staleAccounts: [],
            actions: [],
            recentRuns: [],
            recentArtifacts: [],
            handoff: { summary: "Refresh stale accounts", pinnedEntries: [] },
          },
          continuity: {
            workspaceRoot: "/Users/money/Desktop/Cerniq",
            branch: "codex/control-tower",
            dirtyFiles: 0,
            latestSessionSummary: ["Public production verification is green."],
            latestHandoffObjective: "Keep the branch resumable.",
            blockers: ["GitHub Actions billing is blocked"],
            nextCommands: ["cd backend-node", "npm test"],
            activeSkill: "ralph",
            activeSkillPhase: "planning",
            recentAgentTurns: 8,
            lastHudTitle: "Build admin control tower",
            omxStateFiles: [],
          },
          sessionContinuity: {
            workspaceRoot: "/Users/money/Desktop/Cerniq",
            activeBranch: "codex/control-tower",
            latestStatusSummary: ["Public production verification is green."],
            latestStatusBlockers: ["GitHub Actions billing is blocked"],
            lastAgentOutputTitle: "Build admin control tower",
            handoffUpdatedAt: "2026-04-08T18:00:00.000Z",
            latestStatusUpdatedAt: "2026-04-08T18:00:00.000Z",
            activeModes: ["ralph"],
            stateFiles: ["hud-state.json"],
            metrics: { turnCount: 8, lastTurnAt: "2026-04-08T18:00:00.000Z" },
            recommendedCommands: ["cd backend-node", "npm test"],
          },
          featureBridge: [
            {
              id: "portal",
              label: "Portal & report cycles",
              status: "warning",
              href: "/admin/pipeline",
              detail: "2 awaiting, 1 validation failed",
              metricLabel: "Awaiting upload",
              metricValue: 3,
              nextActionLabel: "Open pipeline",
            },
          ],
          blockers: [],
          recommendedActions: [
            {
              key: "refresh_intelligence",
              label: "Refresh stale intelligence",
              description: "Run a stale-only intelligence refresh pass.",
              tone: "primary",
            },
          ],
          nextActions: [
            {
              id: "refresh-intelligence",
              title: "Refresh stale intelligence accounts",
              domain: "intelligence",
              severity: "medium",
              action: "refresh_intelligence",
            },
          ],
          safeActions: [
            {
              action: "refresh_intelligence",
              label: "Refresh stale intelligence",
              description: "Run a stale-only intelligence refresh pass.",
            },
          ],
        }),
      });
    });

    await page.route("**/admin/api/control-tower/actions", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          action: "refresh_intelligence",
          status: "success",
          summary: "Refreshed stale intelligence accounts",
          data: { refreshed: 3 },
        }),
      });
    });

    await page.route("**/admin/api/pipeline", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          jobs: [],
          health: { awaitingData: 2, processing: 1, complete: 7, failed: 1 },
        }),
      });
    });

    await page.goto("/admin");
    await page.getByPlaceholder("Enter admin key").fill("test-admin-key");
    await page.getByRole("button", { name: /Enter control tower/i }).click();

    await expect(
      page.getByText("Run CERNIQ like one connected operating system."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: /Refresh stale intelligence/i })
      .click();
    await expect(
      page.getByText("Refreshed stale intelligence accounts"),
    ).toBeVisible();

    await page.getByRole("link", { name: /Pipeline/i }).click();
    await expect(page).toHaveURL(/\/admin\/pipeline/);
    await expect(page.getByText("Report Pipeline")).toBeVisible();
  });
});
