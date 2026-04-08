import { GlUploadService } from './gl-upload.service';
import { ActivityService } from './activity.service';

/**
 * GlUploadService tests focus on the parser — that's where the value
 * lives. The upsert path is covered by integration in real prisma usage;
 * we test the round-trip via a small in-memory mock here as a sanity
 * check on the inserted/updated counters.
 */

describe('GlUploadService.parseCsv', () => {
  let svc: GlUploadService;

  beforeEach(() => {
    svc = new GlUploadService({} as any, new ActivityService());
  });

  it('parses a clean CSV with the four required columns', () => {
    const csv = [
      'account,period_year,period_month,balance',
      '1010 Operating Cash,2026,4,1245310.22',
      '1200 Accounts Receivable,2026,4,522900.00',
    ].join('\n');
    const { rows, errors } = svc.parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      account: '1010 Operating Cash',
      periodYear: 2026,
      periodMonth: 4,
      balance: 1_245_310.22,
      notes: undefined,
    });
  });

  it('strips a UTF-8 BOM from the first cell', () => {
    const csv =
      '\uFEFFaccount,period_year,period_month,balance\n1010 Cash,2026,4,1000\n';
    const { rows, errors } = svc.parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows[0].account).toBe('1010 Cash');
  });

  it('handles CRLF line endings', () => {
    const csv =
      'account,period_year,period_month,balance\r\n1010 Cash,2026,4,1000\r\n';
    const { rows } = svc.parseCsv(csv);
    expect(rows).toHaveLength(1);
  });

  it('accepts comma-thousands in balance values', () => {
    const csv =
      'account,period_year,period_month,balance\n1010 Cash,2026,4,"1,245,310.22"\n';
    const { rows } = svc.parseCsv(csv);
    expect(rows[0].balance).toBeCloseTo(1_245_310.22, 2);
  });

  it('treats empty balance as a skip (not an error)', () => {
    const csv = [
      'account,period_year,period_month,balance',
      '1010 Cash,2026,4,1000',
      '1020 Reserve,2026,4,',
      '1030 MM,2026,4,500',
    ].join('\n');
    const { rows, errors } = svc.parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });

  it('rejects non-numeric balance', () => {
    const csv =
      'account,period_year,period_month,balance\n1010 Cash,2026,4,oops\n';
    const { rows, errors } = svc.parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toMatch(/Invalid balance/);
  });

  it('rejects out-of-range months', () => {
    const csv =
      'account,period_year,period_month,balance\n1010 Cash,2026,13,1000\n';
    const { errors } = svc.parseCsv(csv);
    expect(errors[0].message).toMatch(/period_month/);
  });

  it('rejects missing required columns and stops', () => {
    const csv = 'account,balance\n1010 Cash,1000\n';
    const { rows, errors } = svc.parseCsv(csv);
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/Missing required columns/);
  });

  it('skips blank lines silently', () => {
    const csv = [
      'account,period_year,period_month,balance',
      '1010 Cash,2026,4,1000',
      '',
      '1020 Reserve,2026,4,500',
      '',
    ].join('\n');
    const { rows, errors } = svc.parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(2);
  });

  it('captures the optional notes column when present', () => {
    const csv = [
      'account,period_year,period_month,balance,notes',
      '1010 Cash,2026,4,1000,From NetSuite trial balance',
    ].join('\n');
    const { rows } = svc.parseCsv(csv);
    expect(rows[0].notes).toBe('From NetSuite trial balance');
  });

  it('is tolerant of header column case', () => {
    const csv =
      'ACCOUNT,Period_Year,PERIOD_MONTH,Balance\n1010 Cash,2026,4,1000\n';
    const { rows, errors } = svc.parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(rows).toHaveLength(1);
  });

  it('reports an error for an empty file', () => {
    const { rows, errors } = svc.parseCsv('');
    expect(rows).toHaveLength(0);
    expect(errors[0].message).toMatch(/Empty CSV/);
  });
});

describe('GlUploadService.upload (round-trip)', () => {
  let svc: GlUploadService;
  let upserts: Array<{ where: any; create: any; update: any }>;

  beforeEach(() => {
    upserts = [];
    let now = 0;
    const mockPrisma = {
      glBalanceSnapshot: {
        // First call → createdAt === updatedAt (insert path).
        // Subsequent calls with the same key → bump updatedAt (update path).
        upsert: jest.fn(({ where, create, update }: any) => {
          upserts.push({ where, create, update });
          now += 1;
          // Detect "second call" by checking how many upserts share the
          // same composite key — first one is insert, rest are updates.
          const matches = upserts.filter(
            (u) =>
              u.where.org_account_period.account ===
                where.org_account_period.account &&
              u.where.org_account_period.periodYear ===
                where.org_account_period.periodYear &&
              u.where.org_account_period.periodMonth ===
                where.org_account_period.periodMonth,
          );
          const isInsert = matches.length === 1;
          const ts = new Date(now * 1000);
          return Promise.resolve({
            createdAt: ts,
            updatedAt: isInsert ? ts : new Date((now + 1) * 1000),
          });
        }),
      },
    };
    svc = new GlUploadService(mockPrisma as any, new ActivityService());
  });

  it('counts inserted vs updated correctly', async () => {
    const csv = [
      'account,period_year,period_month,balance',
      '1010 Cash,2026,4,1000',
      '1020 Reserve,2026,4,500',
    ].join('\n');
    const result = await svc.upload('org-1', csv, 'upload:test.csv', 'user-1');
    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.errored).toBe(0);
    expect(result.rows).toBe(2);

    // Re-upload the first row should now count as an update.
    const resultB = await svc.upload(
      'org-1',
      'account,period_year,period_month,balance\n1010 Cash,2026,4,2000\n',
      'upload:test-b.csv',
      'user-1',
    );
    expect(resultB.inserted).toBe(0);
    expect(resultB.updated).toBe(1);
  });

  it('surfaces parse errors in the result.errors array', async () => {
    const csv =
      'account,period_year,period_month,balance\n1010 Cash,2026,99,1000\n';
    const result = await svc.upload('org-1', csv, 'upload:bad.csv', null);
    expect(result.rows).toBe(0);
    expect(result.errored).toBeGreaterThan(0);
    expect(result.errors[0].message).toMatch(/period_month/);
  });
});

describe('GlUploadService.upload activity wiring', () => {
  let svc: GlUploadService;
  let activityCalls: any[];
  let mockPrisma: any;

  beforeEach(() => {
    activityCalls = [];
    mockPrisma = {
      glBalanceSnapshot: {
        upsert: jest.fn(() =>
          Promise.resolve({ createdAt: new Date(1), updatedAt: new Date(1) }),
        ),
      },
      closeCycle: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'cycle-apr', periodYear: 2026, periodMonth: 4 },
          ]),
      },
      $transaction: jest.fn(async (fn: any) => {
        return fn({
          closeActivity: {
            create: jest.fn(({ data }: any) => {
              activityCalls.push(data);
              return Promise.resolve({
                id: `act-${activityCalls.length}`,
                ...data,
              });
            }),
          },
        });
      }),
    };
    svc = new GlUploadService(mockPrisma, new ActivityService());
  });

  it('writes a GL_UPLOADED activity row for the matching open cycle', async () => {
    const csv = [
      'account,period_year,period_month,balance',
      '1010 Cash,2026,4,1000',
      '4000 Income,2026,4,500',
    ].join('\n');
    await svc.upload('org-1', csv, 'upload:march.csv', 'user-erwin');

    expect(activityCalls).toHaveLength(1);
    expect(activityCalls[0].kind).toBe('GL_UPLOADED');
    expect(activityCalls[0].cycleId).toBe('cycle-apr');
    expect(activityCalls[0].actorId).toBe('user-erwin');
    expect(activityCalls[0].payload.accounts).toBe(2);
    expect(activityCalls[0].payload.period).toBe('2026-04');
    expect(activityCalls[0].summaryEn).toMatch(/2026-04/);
    expect(activityCalls[0].summaryEn).toMatch(/2 accounts/);
  });

  it('writes one activity row per distinct (year, month) when the CSV spans periods', async () => {
    mockPrisma.closeCycle.findMany.mockResolvedValueOnce([
      { id: 'cycle-mar', periodYear: 2026, periodMonth: 3 },
      { id: 'cycle-apr', periodYear: 2026, periodMonth: 4 },
    ]);
    const csv = [
      'account,period_year,period_month,balance',
      '1010 Cash,2026,3,900',
      '1010 Cash,2026,4,1000',
      '4000 Income,2026,4,500',
    ].join('\n');
    await svc.upload('org-1', csv, 'upload:q1.csv', null);

    expect(activityCalls).toHaveLength(2);
    const mar = activityCalls.find((a) => a.cycleId === 'cycle-mar');
    const apr = activityCalls.find((a) => a.cycleId === 'cycle-apr');
    expect(mar?.payload.accounts).toBe(1);
    expect(apr?.payload.accounts).toBe(2);
  });

  it('writes nothing to activity when no matching cycles exist', async () => {
    mockPrisma.closeCycle.findMany.mockResolvedValueOnce([]);
    const csv =
      'account,period_year,period_month,balance\n1010 Cash,2026,4,1000\n';
    await svc.upload('org-1', csv, 'upload:orphan.csv', null);
    expect(activityCalls).toHaveLength(0);
  });

  it('still returns a successful upload result when activity logging throws', async () => {
    mockPrisma.closeCycle.findMany.mockRejectedValueOnce(
      new Error('cycle lookup down'),
    );
    const csv =
      'account,period_year,period_month,balance\n1010 Cash,2026,4,1000\n';
    const result = await svc.upload('org-1', csv, 'upload:march.csv', null);
    expect(result.inserted).toBe(1);
    expect(result.errored).toBe(0);
    // Activity write should NOT have happened — but the upload succeeded.
    expect(activityCalls).toHaveLength(0);
  });
});
