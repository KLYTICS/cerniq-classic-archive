import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── Interfaces ─────────────────────────────────────────────────

export interface ParseError {
  row: number;
  field?: string;
  message: string;
}

export interface ParsedQuarterlyData {
  institutionName: string;
  matchedInstitutionId?: string;
  balanceSheetItems: any[];
  reportingDate: string;
}

export interface ParseResult {
  institutions: ParsedQuarterlyData[];
  errors: ParseError[];
  warnings: string[];
}

export interface IngestionResult {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  missingHeaders: string[];
  extraHeaders: string[];
}

// ─── Constants ──────────────────────────────────────────────────

const REQUIRED_HEADERS = [
  'institution_name',
  'reporting_date',
  'category',
  'subcategory',
  'item_name',
  'balance',
  'rate',
  'duration',
  'rate_type',
] as const;

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CpaBulkIngestionService {
  private readonly logger = new Logger(CpaBulkIngestionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that the CSV headers contain all required fields.
   */
  validateCsvFormat(headers: string[]): ValidationResult {
    const normalized = headers.map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, '_'),
    );

    const missingHeaders = REQUIRED_HEADERS.filter(
      (req) => !normalized.includes(req),
    );
    const extraHeaders = normalized.filter(
      (h) => !REQUIRED_HEADERS.includes(h as any),
    );

    return {
      valid: missingHeaders.length === 0,
      missingHeaders,
      extraHeaders,
    };
  }

  /**
   * Parse a multi-institution quarterly CSV upload into structured data.
   *
   * Expected CSV format:
   *   institution_name, reporting_date, category, subcategory, item_name, balance, rate, duration, rate_type
   *
   * Multiple institutions may appear in a single file. Rows are grouped
   * by institution_name. Each institution is matched against existing
   * records in the database by name within the firm's client portfolio.
   */
  async parseQuarterlyUpload(
    firmId: string,
    csvBuffer: Buffer,
  ): Promise<ParseResult> {
    const csvText = csvBuffer.toString('utf-8').trim();
    const lines = csvText.split(/\r?\n/);

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV must contain a header row and at least one data row',
      );
    }

    const rawHeaders = lines[0].split(',');
    const validation = this.validateCsvFormat(rawHeaders);

    if (!validation.valid) {
      throw new BadRequestException(
        `Missing required CSV columns: ${validation.missingHeaders.join(', ')}`,
      );
    }

    const headers = rawHeaders.map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, '_'),
    );

    const errors: ParseError[] = [];
    const warnings: string[] = [];
    const institutionMap = new Map<string, ParsedQuarterlyData>();

    // Pre-fetch all firm client institution IDs for matching
    const firmClients = await this.prisma.cpaClientRelationship.findMany({
      where: { firmId, removedAt: null },
      include: {
        institution: { select: { id: true, name: true } },
      },
    });
    const institutionLookup = new Map<string, string>();
    for (const client of firmClients) {
      institutionLookup.set(
        client.institution.name.toLowerCase().trim(),
        client.institution.id,
      );
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCsvLine(line);
      if (values.length !== headers.length) {
        errors.push({
          row: i + 1,
          message: `Expected ${headers.length} columns, got ${values.length}`,
        });
        continue;
      }

      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = values[idx]?.trim() ?? '';
      });

      const instName = record['institution_name'];
      if (!instName) {
        errors.push({
          row: i + 1,
          field: 'institution_name',
          message: 'institution_name is required',
        });
        continue;
      }

      // Validate balance is a number
      const balance = parseFloat(record['balance']);
      if (isNaN(balance)) {
        errors.push({
          row: i + 1,
          field: 'balance',
          message: `Invalid balance value: "${record['balance']}"`,
        });
        continue;
      }

      const rate = parseFloat(record['rate']);
      if (isNaN(rate)) {
        errors.push({
          row: i + 1,
          field: 'rate',
          message: `Invalid rate value: "${record['rate']}"`,
        });
        continue;
      }

      const duration = parseFloat(record['duration']);
      if (isNaN(duration)) {
        errors.push({
          row: i + 1,
          field: 'duration',
          message: `Invalid duration value: "${record['duration']}"`,
        });
        continue;
      }

      const category = record['category']?.toLowerCase();
      if (category !== 'asset' && category !== 'liability') {
        errors.push({
          row: i + 1,
          field: 'category',
          message: `category must be "asset" or "liability", got "${record['category']}"`,
        });
        continue;
      }

      // Group by institution
      if (!institutionMap.has(instName)) {
        const matchedId = institutionLookup.get(instName.toLowerCase().trim());
        if (!matchedId) {
          warnings.push(
            `Row ${i + 1}: institution "${instName}" is not a registered client of this firm`,
          );
        }
        institutionMap.set(instName, {
          institutionName: instName,
          matchedInstitutionId: matchedId,
          balanceSheetItems: [],
          reportingDate: record['reporting_date'],
        });
      }

      const entry = institutionMap.get(instName)!;
      entry.balanceSheetItems.push({
        category,
        subcategory: record['subcategory'],
        name: record['item_name'],
        balance,
        rate,
        duration,
        rateType: record['rate_type'] || 'fixed',
      });
    }

    this.logger.log({
      event: 'cpa.csv_parsed',
      firmId,
      totalRows: lines.length - 1,
      institutions: institutionMap.size,
      errors: errors.length,
      warnings: warnings.length,
    });

    return {
      institutions: Array.from(institutionMap.values()),
      errors,
      warnings,
    };
  }

  /**
   * Persist parsed quarterly data into balance sheet items.
   * For each matched institution, creates or updates BSI records.
   */
  async ingestParsedData(
    firmId: string,
    parsedData: ParsedQuarterlyData[],
  ): Promise<IngestionResult> {
    let processed = 0;
    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const entry of parsedData) {
      if (!entry.matchedInstitutionId) {
        errors.push(
          `Skipped "${entry.institutionName}": no matching institution found in firm's client list`,
        );
        continue;
      }

      processed++;

      try {
        const reportingDate = new Date(entry.reportingDate);
        if (isNaN(reportingDate.getTime())) {
          errors.push(
            `Skipped "${entry.institutionName}": invalid reporting date "${entry.reportingDate}"`,
          );
          continue;
        }

        // Update institution reporting date
        await this.prisma.institution.update({
          where: { id: entry.matchedInstitutionId },
          data: { reportingDate },
        });

        for (const item of entry.balanceSheetItems) {
          // Try to find an existing BSI by name + institution
          const existing = await this.prisma.balanceSheetItem.findFirst({
            where: {
              institutionId: entry.matchedInstitutionId,
              name: item.name,
              category: item.category,
            },
          });

          if (existing) {
            await this.prisma.balanceSheetItem.update({
              where: { id: existing.id },
              data: {
                balance: item.balance,
                rate: item.rate,
                duration: item.duration,
                rateType: item.rateType,
                subcategory: item.subcategory,
              },
            });
            updated++;
          } else {
            await this.prisma.balanceSheetItem.create({
              data: {
                institutionId: entry.matchedInstitutionId,
                category: item.category,
                subcategory: item.subcategory,
                name: item.name,
                balance: item.balance,
                rate: item.rate,
                duration: item.duration,
                rateType: item.rateType,
              },
            });
            created++;
          }
        }
      } catch (err: any) {
        errors.push(
          `Error processing "${entry.institutionName}": ${err?.message || 'unknown'}`,
        );
      }
    }

    this.logger.log({
      event: 'cpa.bulk_ingestion_complete',
      firmId,
      processed,
      created,
      updated,
      errors: errors.length,
    });

    return { processed, created, updated, errors };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /**
   * Simple CSV line parser that handles quoted fields with commas.
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
