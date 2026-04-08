import { Injectable, Logger } from '@nestjs/common';
import { CloseActivityKind, CloseCycleStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ActivityService } from './activity.service';

/**
 * GlUploadService — parses a GL CSV and upserts one row per line into the
 * `gl_balance_snapshots` table.
 *
 * Accepted CSV shape (header row required):
 *   account,period_year,period_month,balance[,notes]
 *
 * We deliberately keep the parser hand-rolled + tolerant:
 *   - BOM + CRLF friendly
 *   - Case-insensitive headers
 *   - Skips blank lines
 *   - Skips rows whose balance is empty (treated as "no reading this month")
 *   - Rejects rows with non-numeric balances, out-of-range months, etc.
 *
 * Every upload writes exactly one CloseActivity row per distinct (cycle)
 * we can associate with the upload — which, since uploads happen outside
 * a cycle context, is nil today. We still log at org level via the
 * service's logger for audit trail.
 */

export interface GlUploadRow {
  account: string;
  periodYear: number;
  periodMonth: number;
  balance: number;
  notes?: string;
}

export interface GlUploadError {
  rowNumber: number; // 1-indexed including header
  message: string;
}

export interface GlUploadResult {
  inserted: number;
  updated: number;
  errored: number;
  errors: GlUploadError[];
  rows: number;
  source: string;
}

const REQUIRED_HEADERS = [
  'account',
  'period_year',
  'period_month',
  'balance',
] as const;
const OPTIONAL_HEADERS = ['notes'] as const;

@Injectable()
export class GlUploadService {
  private readonly logger = new Logger(GlUploadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  parseCsv(content: string): { rows: GlUploadRow[]; errors: GlUploadError[] } {
    const rows: GlUploadRow[] = [];
    const errors: GlUploadError[] = [];
    // Strip UTF-8 BOM, normalize line endings, split.
    const lines = content
      .replace(/^\uFEFF/, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n');

    if (lines.length === 0 || !lines[0].trim()) {
      errors.push({ rowNumber: 1, message: 'Empty CSV file' });
      return { rows, errors };
    }

    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
    if (missing.length > 0) {
      errors.push({
        rowNumber: 1,
        message: `Missing required columns: ${missing.join(', ')}. Expected: ${REQUIRED_HEADERS.join(', ')}`,
      });
      return { rows, errors };
    }

    const accountIdx = header.indexOf('account');
    const yearIdx = header.indexOf('period_year');
    const monthIdx = header.indexOf('period_month');
    const balanceIdx = header.indexOf('balance');
    const notesIdx = header.indexOf('notes');

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.trim()) continue;
      const cells = splitCsvLine(line);

      const account = (cells[accountIdx] ?? '').trim();
      const yearStr = (cells[yearIdx] ?? '').trim();
      const monthStr = (cells[monthIdx] ?? '').trim();
      const balanceStr = (cells[balanceIdx] ?? '').trim();
      const notes = notesIdx >= 0 ? (cells[notesIdx] ?? '').trim() : '';

      if (!account) {
        errors.push({ rowNumber: i + 1, message: 'Missing account' });
        continue;
      }
      if (!balanceStr) {
        // Empty balance = skip silently. Allows partial exports.
        continue;
      }

      const periodYear = parseInt(yearStr, 10);
      if (
        !Number.isFinite(periodYear) ||
        periodYear < 2000 ||
        periodYear > 2100
      ) {
        errors.push({
          rowNumber: i + 1,
          message: `Invalid period_year: "${yearStr}"`,
        });
        continue;
      }

      const periodMonth = parseInt(monthStr, 10);
      if (
        !Number.isFinite(periodMonth) ||
        periodMonth < 1 ||
        periodMonth > 12
      ) {
        errors.push({
          rowNumber: i + 1,
          message: `Invalid period_month: "${monthStr}"`,
        });
        continue;
      }

      // Accept comma-thousands: "1,234,567.89" → 1234567.89
      const balance = Number(balanceStr.replace(/,/g, ''));
      if (!Number.isFinite(balance)) {
        errors.push({
          rowNumber: i + 1,
          message: `Invalid balance: "${balanceStr}"`,
        });
        continue;
      }

      rows.push({
        account,
        periodYear,
        periodMonth,
        balance,
        notes: notes || undefined,
      });
    }

    return { rows, errors };
  }

  async upload(
    orgId: string,
    csvContent: string,
    sourceLabel: string,
    userId: string | null,
  ): Promise<GlUploadResult> {
    const { rows, errors } = this.parseCsv(csvContent);

    let inserted = 0;
    let updated = 0;
    const upsertErrors: GlUploadError[] = [...errors];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      try {
        const result = await this.prisma.glBalanceSnapshot.upsert({
          where: {
            org_account_period: {
              organizationId: orgId,
              account: row.account,
              periodYear: row.periodYear,
              periodMonth: row.periodMonth,
            },
          },
          create: {
            organizationId: orgId,
            account: row.account,
            periodYear: row.periodYear,
            periodMonth: row.periodMonth,
            balance: new Prisma.Decimal(row.balance),
            sourceLabel,
            uploadedById: userId,
            notes: row.notes,
          },
          update: {
            balance: new Prisma.Decimal(row.balance),
            sourceLabel,
            uploadedById: userId,
            notes: row.notes,
          },
          select: { createdAt: true, updatedAt: true },
        });
        // createdAt === updatedAt only on insert; a delta means update.
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          inserted += 1;
        } else {
          updated += 1;
        }
      } catch (err) {
        upsertErrors.push({
          rowNumber: i + 2, // +1 for header, +1 for 1-indexing
          message: err instanceof Error ? err.message : 'Upsert failed',
        });
      }
    }

    // ── Activity wiring ──────────────────────────────────────────────
    // For every distinct (year, month) in the upload, find the matching
    // open cycle (if any) and write a CloseActivity row so the controller
    // sees "Maria uploaded march.csv · 142 accounts · 4 min ago" in the
    // recent-activity strip without any extra plumbing.
    if (rows.length > 0) {
      const periods = uniquePeriods(rows);
      try {
        const matchingCycles = (await this.prisma.closeCycle.findMany({
          where: {
            organizationId: orgId,
            status: { not: CloseCycleStatus.SIGNED_OFF },
            OR: periods.map(([y, m]) => ({ periodYear: y, periodMonth: m })),
          },
          select: { id: true, periodYear: true, periodMonth: true },
        })) as Array<{ id: string; periodYear: number; periodMonth: number }>;

        for (const cycle of matchingCycles) {
          const rowsForCycle = rows.filter(
            (r) =>
              r.periodYear === cycle.periodYear &&
              r.periodMonth === cycle.periodMonth,
          );
          const period = `${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}`;
          // Activity is best-effort — never block the upload if it fails.
          await this.prisma.$transaction(
            async (tx: Prisma.TransactionClient) => {
              await this.activity.record(tx, {
                cycleId: cycle.id,
                actorId: userId,
                kind: CloseActivityKind.GL_UPLOADED,
                summaryEn: `GL uploaded for ${period}: ${rowsForCycle.length} accounts (${sourceLabel.replace(/^upload:/, '')})`,
                summaryEs: `GL cargado para ${period}: ${rowsForCycle.length} cuentas (${sourceLabel.replace(/^upload:/, '')})`,
                payload: {
                  period,
                  accounts: rowsForCycle.length,
                  source: sourceLabel,
                  inserted,
                  updated,
                },
              });
            },
          );
        }
      } catch (err) {
        // Log + swallow — the upload itself succeeded; activity drift is
        // the lesser sin compared to a 500 on a successful CSV import.
        this.logger.warn(
          `GL upload activity logging failed for org=${orgId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    this.logger.log(
      `GL upload for org=${orgId}: ${inserted} inserted, ${updated} updated, ${upsertErrors.length} errored from ${rows.length} rows (${sourceLabel})`,
    );

    return {
      inserted,
      updated,
      errored: upsertErrors.length,
      errors: upsertErrors,
      rows: rows.length,
      source: sourceLabel,
    };
  }
}

/** Returns the distinct (year, month) pairs in the row set. */
function uniquePeriods(rows: GlUploadRow[]): Array<[number, number]> {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const row of rows) {
    const key = `${row.periodYear}-${row.periodMonth}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([row.periodYear, row.periodMonth]);
    }
  }
  return out;
}

/**
 * Minimal CSV line splitter that handles quoted fields containing commas.
 * Not a full RFC 4180 implementation — but it covers 99% of accounting
 * system exports without pulling in a dependency.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
