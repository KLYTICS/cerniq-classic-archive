import { GlDataSourceService } from './gl-data-source.service';

/**
 * GlDataSourceService — snapshot inspector public API tests.
 *
 * Covers the listSnapshotsForPeriod + deleteSnapshot methods that
 * power the GL Snapshot inspector panel and the Mark/Delete row
 * actions inside the cycle workspace.
 */

describe('GlDataSourceService snapshot inspector', () => {
  let svc: GlDataSourceService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      glBalanceSnapshot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    svc = new GlDataSourceService(mockPrisma);
  });

  describe('listSnapshotsForPeriod', () => {
    it('maps Prisma rows to the public shape', async () => {
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([
        {
          id: 'snap-1',
          account: '1010 Cash',
          balance: '1245310.22',
          sourceLabel: 'upload:march.csv',
          uploadedById: 'user-1',
          notes: 'From NetSuite',
          updatedAt: new Date('2026-04-08T08:00:00Z'),
        },
        {
          id: 'snap-2',
          account: '2100 AP',
          balance: '388212.45',
          sourceLabel: null,
          uploadedById: null,
          notes: null,
          updatedAt: new Date('2026-04-08T09:00:00Z'),
        },
      ]);

      const rows = await svc.listSnapshotsForPeriod('org-1', 2026, 4);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        id: 'snap-1',
        account: '1010 Cash',
        balance: 1_245_310.22,
        sourceLabel: 'upload:march.csv',
        uploadedById: 'user-1',
        notes: 'From NetSuite',
        updatedAt: '2026-04-08T08:00:00.000Z',
      });
      expect(rows[1].sourceLabel).toBeNull();
      expect(rows[1].balance).toBe(388_212.45);
    });

    it('returns an empty list when no rows match', async () => {
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([]);
      const rows = await svc.listSnapshotsForPeriod('org-1', 2026, 4);
      expect(rows).toEqual([]);
    });

    it('scopes the query to the org + period', async () => {
      mockPrisma.glBalanceSnapshot.findMany.mockResolvedValueOnce([]);
      await svc.listSnapshotsForPeriod('org-erwin', 2026, 4);
      expect(mockPrisma.glBalanceSnapshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-erwin',
            periodYear: 2026,
            periodMonth: 4,
          },
        }),
      );
    });
  });

  describe('deleteSnapshot', () => {
    it('returns deleted=true when one row was removed', async () => {
      mockPrisma.glBalanceSnapshot.deleteMany.mockResolvedValueOnce({
        count: 1,
      });
      const result = await svc.deleteSnapshot('org-1', 'snap-1');
      expect(result.deleted).toBe(true);
    });

    it('returns deleted=false when nothing matched (already gone)', async () => {
      mockPrisma.glBalanceSnapshot.deleteMany.mockResolvedValueOnce({
        count: 0,
      });
      const result = await svc.deleteSnapshot('org-1', 'snap-missing');
      expect(result.deleted).toBe(false);
    });

    it('scopes the delete by both id AND organizationId for safety', async () => {
      mockPrisma.glBalanceSnapshot.deleteMany.mockResolvedValueOnce({
        count: 1,
      });
      await svc.deleteSnapshot('org-erwin', 'snap-1');
      expect(mockPrisma.glBalanceSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { id: 'snap-1', organizationId: 'org-erwin' },
      });
    });
  });
});
