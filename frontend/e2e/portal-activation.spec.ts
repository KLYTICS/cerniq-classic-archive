import { expect, test } from '@playwright/test';

test.describe('Portal activation flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cerniq_cookie_consent', 'accepted');
    });
  });

  test('creates a report cycle and advances into upload processing', async ({
    page,
  }) => {
    let cycleOpened = false;

    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: {
            id: 'portal-user-1',
            email: 'qa@cerniq.io',
            name: 'CERNIQ QA',
            access: {
              platformAccessAllowed: true,
              isMasterCeo: false,
              isPaid: true,
              isDemo: false,
              effectiveTier: 'monthly',
              effectiveStatus: 'active',
              effectivePeriodEnd: null,
              daysRemaining: null,
              reason: 'paid',
            },
          },
        }),
      });
    });

    await page.route('**/api/billing/subscription', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            tier: 'monthly',
            status: 'active',
          },
        }),
      });
    });

    await page.route('**/api/portal/overview', async (route) => {
      const body = cycleOpened
        ? {
            success: true,
            data: {
              access: {
                platformAccessAllowed: true,
                isMasterCeo: false,
                isPaid: true,
                isDemo: false,
                effectiveTier: 'monthly',
                effectiveStatus: 'active',
                effectivePeriodEnd: null,
                daysRemaining: null,
                reason: 'paid',
              },
              jobs: [
                {
                  id: 'job-awaiting',
                  institutionId: 'inst-1',
                  institutionName: 'Coop Activation',
                  status: 'AWAITING_DATA',
                  analysisPeriod: null,
                  previousJobId: null,
                  submittedAt: null,
                  processingStartedAt: null,
                  completedAt: null,
                  createdAt: '2026-04-08T10:00:00.000Z',
                  reportUrl: null,
                  reportUrlEn: null,
                  reportLang: 'es',
                  errorMessage: null,
                  userId: 'portal-user-1',
                  triggeredBy: 'portal_open_cycle',
                },
              ],
              latestActionableJob: {
                id: 'job-awaiting',
                institutionId: 'inst-1',
                institutionName: 'Coop Activation',
                status: 'AWAITING_DATA',
                analysisPeriod: null,
                previousJobId: null,
                submittedAt: null,
                processingStartedAt: null,
                completedAt: null,
                createdAt: '2026-04-08T10:00:00.000Z',
                reportUrl: null,
                reportUrlEn: null,
                reportLang: 'es',
                errorMessage: null,
                userId: 'portal-user-1',
                triggeredBy: 'portal_open_cycle',
              },
              workflowState: 'needs_upload',
              counts: {
                total: 1,
                awaitingData: 1,
                validationFailed: 0,
                processing: 0,
                complete: 0,
              },
              activation: null,
              demoSeat: { isDemo: false, seat: null },
              nextAction: {
                labelEn: 'Upload balance-sheet data',
                labelEs: 'Cargar datos del balance',
                href: '/portal/submit?jobId=job-awaiting',
                jobId: 'job-awaiting',
                explanationEn: 'Upload now.',
                explanationEs: 'Cargue ahora.',
              },
              validationSummary: null,
            },
          }
        : {
            success: true,
            data: {
              access: {
                platformAccessAllowed: true,
                isMasterCeo: false,
                isPaid: true,
                isDemo: false,
                effectiveTier: 'monthly',
                effectiveStatus: 'active',
                effectivePeriodEnd: null,
                daysRemaining: null,
                reason: 'paid',
              },
              jobs: [],
              latestActionableJob: null,
              workflowState: 'needs_report',
              counts: {
                total: 0,
                awaitingData: 0,
                validationFailed: 0,
                processing: 0,
                complete: 0,
              },
              activation: null,
              demoSeat: { isDemo: false, seat: null },
              nextAction: {
                labelEn: 'Create first report cycle',
                labelEs: 'Crear primer ciclo de informe',
                href: '/portal/submit?createCycle=1',
                jobId: null,
                explanationEn: 'Create the first report cycle.',
                explanationEs: 'Cree el primer ciclo de informe.',
              },
              validationSummary: null,
            },
          };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.route('**/api/portal/jobs/open-cycle', async (route) => {
      cycleOpened = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            created: true,
            reopened: false,
            nextActionHref: '/portal/submit?jobId=job-awaiting',
            job: {
              id: 'job-awaiting',
              institutionId: 'inst-1',
              institutionName: 'Coop Activation',
              status: 'AWAITING_DATA',
              analysisPeriod: null,
              previousJobId: null,
              submittedAt: null,
              processingStartedAt: null,
              completedAt: null,
              createdAt: '2026-04-08T10:00:00.000Z',
              reportUrl: null,
              reportUrlEn: null,
              reportLang: 'es',
              errorMessage: null,
              userId: 'portal-user-1',
              triggeredBy: 'portal_open_cycle',
            },
          },
        }),
      });
    });

    await page.route('**/api/portal/jobs/job-awaiting/submit', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            valid: true,
            status: 'QUEUED',
            jobId: 'job-awaiting',
            institutionId: 'inst-1',
            institutionName: 'Coop Activation',
            itemsImported: 42,
            warningCount: 1,
            nextHref: '/portal/reports/job-awaiting',
          },
        }),
      });
    });

    await page.goto('/portal');

    await expect(
      page.getByRole('link', { name: /Create first report cycle/i }).first(),
    ).toBeVisible();

    await page.getByRole('link', { name: /Create first report cycle/i }).first().click();
    await page.waitForURL(/\/portal\/submit\?jobId=job-awaiting/, {
      timeout: 15000,
    });

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'balance.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'category,subcategory,name,balance,rate,duration,rateType,repriceDate,maturityDate\nasset,residential_mortgages,Pool A,7.5,5.75,12.0,fixed,,2038-03-01',
      ),
    });

    await page.getByRole('button', { name: 'Submit Data' }).click();

    await expect(
      page.getByText(
        'Submission received. CERNIQ is processing your report now.',
      ),
    ).toBeVisible();
  });
});
