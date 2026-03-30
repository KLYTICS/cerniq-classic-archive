import { Injectable, Logger } from '@nestjs/common';

// ── Column alias mapping (Spanish → English) ─────────────────────────
const COLUMN_ALIASES: Record<string, string> = {
  // Spanish aliases
  fecha: 'date',
  numero_factura: 'invoice_number',
  numerofactura: 'invoice_number',
  proveedor: 'vendor',
  descripcion: 'description',
  monto: 'amount',
  moneda: 'currency',
  categoria: 'category',
  estado: 'status',
  // English passthrough
  date: 'date',
  invoice_number: 'invoice_number',
  invoicenumber: 'invoice_number',
  invoice_no: 'invoice_number',
  invoiceno: 'invoice_number',
  vendor: 'vendor',
  supplier: 'vendor',
  merchant: 'vendor',
  merchant_name: 'vendor',
  merchantname: 'vendor',
  description: 'description',
  desc: 'description',
  memo: 'description',
  amount: 'amount',
  total: 'amount',
  currency: 'currency',
  category: 'category',
  type: 'category',
  status: 'status',
  payment_status: 'status',
  paymentstatus: 'status',
};

// Valid categories for SpendCheck expenses
const VALID_CATEGORIES = new Set([
  'utilities',
  'insurance',
  'telecom',
  'audit',
  'supplies',
  'maintenance',
  'security',
  'other',
]);

// Status aliases (Spanish → English)
const STATUS_ALIASES: Record<string, string> = {
  paid: 'PAID',
  pagado: 'PAID',
  pagada: 'PAID',
  pending: 'PENDING',
  pendiente: 'PENDING',
  cancelled: 'CANCELLED',
  cancelado: 'CANCELLED',
  cancelada: 'CANCELLED',
};

export interface ExpenseRowError {
  row: number;
  field: string;
  value: string;
  message: string;
  messageEs: string;
}

export interface ParsedExpenseItem {
  date: string; // YYYY-MM-DD
  invoiceNumber: string;
  vendor: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  status: string; // PAID | PENDING | CANCELLED
}

export interface ExpenseParseResult {
  valid: boolean;
  items: ParsedExpenseItem[];
  errors: ExpenseRowError[];
  warnings: string[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    totalAmount: number;
    uniqueVendors: number;
    dateRange: { from: string; to: string } | null;
  };
}

@Injectable()
export class ExpenseIngestionService {
  private readonly logger = new Logger(ExpenseIngestionService.name);

  /**
   * Parse a CSV string containing AP invoice/expense data.
   * Supports both English and Spanish column headers.
   */
  parseExpenseCSV(csvContent: string): ExpenseParseResult {
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return this.emptyResult(
        'CSV must have a header row and at least one data row',
      );
    }

    // Parse headers
    const rawHeaders = this.parseCSVLine(lines[0]).map((h) =>
      h.trim().toLowerCase().replace(/\s+/g, '_'),
    );
    const headerMap = this.mapHeaders(rawHeaders);

    // Validate required headers
    const requiredColumns = ['date', 'invoice_number', 'vendor', 'amount'];
    const missingColumns = requiredColumns.filter(
      (col) => headerMap[col] === undefined,
    );

    if (missingColumns.length > 0) {
      return this.emptyResult(
        `Missing required columns: ${missingColumns.join(', ')}. ` +
          `Required: date, invoice_number, vendor, amount. ` +
          `Spanish aliases supported: fecha, numero_factura, proveedor, monto`,
      );
    }

    // Parse rows
    const items: ParsedExpenseItem[] = [];
    const errors: ExpenseRowError[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || values.every((v) => v.trim() === '')) continue;

      const rowNum = i + 1;
      const row: Record<string, string> = {};
      rawHeaders.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim();
      });

      const rowErrors = this.validateRow(row, headerMap, rowNum);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // Parse and normalize date
      const rawDate = this.getField(row, headerMap, 'date');
      const parsedDate = this.parseDate(rawDate);
      if (!parsedDate) {
        errors.push({
          row: rowNum,
          field: 'date',
          value: rawDate,
          message: `Invalid date "${rawDate}". Use YYYY-MM-DD or MM/DD/YYYY format`,
          messageEs: `Fecha invalida "${rawDate}". Use formato YYYY-MM-DD o MM/DD/YYYY`,
        });
        continue;
      }

      // Parse amount
      const rawAmount = this.getField(row, headerMap, 'amount').replace(
        /[,$]/g,
        '',
      );
      const amount = parseFloat(rawAmount);

      // Parse vendor
      const vendor = this.getField(row, headerMap, 'vendor');

      // Parse invoice number
      const invoiceNumber = this.getField(row, headerMap, 'invoice_number');

      // Parse optional fields
      const description = this.getField(row, headerMap, 'description') || '';
      const currency = (
        this.getField(row, headerMap, 'currency') || 'USD'
      ).toUpperCase();
      const rawCategory = (
        this.getField(row, headerMap, 'category') || 'other'
      ).toLowerCase();
      const category = VALID_CATEGORIES.has(rawCategory)
        ? rawCategory
        : 'other';

      if (rawCategory && !VALID_CATEGORIES.has(rawCategory)) {
        warnings.push(
          `Row ${rowNum}: Unknown category "${rawCategory}" defaulted to "other"`,
        );
      }

      // Parse status
      const rawStatus = (this.getField(row, headerMap, 'status') || 'paid')
        .toLowerCase()
        .trim();
      const status = STATUS_ALIASES[rawStatus] || 'PAID';

      if (rawStatus && !STATUS_ALIASES[rawStatus]) {
        warnings.push(
          `Row ${rowNum}: Unknown status "${rawStatus}" defaulted to "PAID"`,
        );
      }

      items.push({
        date: parsedDate,
        invoiceNumber,
        vendor,
        description,
        amount,
        currency,
        category,
        status,
      });
    }

    // Compute summary
    const totalAmount = items.reduce((s, i) => s + i.amount, 0);
    const uniqueVendors = new Set(items.map((i) => i.vendor.toLowerCase()))
      .size;
    const dates = items.map((i) => i.date).sort();
    const dateRange =
      dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null;

    return {
      valid: errors.length === 0 && items.length > 0,
      items,
      errors,
      warnings,
      summary: {
        totalRows: lines.length - 1,
        validRows: items.length,
        errorRows: errors.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        uniqueVendors,
        dateRange,
      },
    };
  }

  // ── Private Helpers ──────────────────────────────────────────────

  /** Map column aliases to canonical names */
  private mapHeaders(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const normalized = h.replace(/[\s_-]/g, '').toLowerCase();
      // Try exact match first
      if (COLUMN_ALIASES[h] && map[COLUMN_ALIASES[h]] === undefined) {
        map[COLUMN_ALIASES[h]] = idx;
      }
      // Try normalized match
      if (
        COLUMN_ALIASES[normalized] &&
        map[COLUMN_ALIASES[normalized]] === undefined
      ) {
        map[COLUMN_ALIASES[normalized]] = idx;
      }
    });
    return map;
  }

  private getField(
    row: Record<string, string>,
    headerMap: Record<string, number>,
    key: string,
  ): string {
    const headers = Object.keys(row);
    const idx = headerMap[key];
    if (idx === undefined) return '';
    return row[headers[idx]] || '';
  }

  /** Handle quoted CSV fields (commas inside quotes) */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  /** Parse date in YYYY-MM-DD or MM/DD/YYYY format, returns ISO date string or null */
  private parseDate(raw: string): string | null {
    if (!raw) return null;

    // Try YYYY-MM-DD
    const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    // Try MM/DD/YYYY
    const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    // Try DD/MM/YYYY (common in PR/Latin America)
    const euMatch = raw.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(d.getTime())) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    return null;
  }

  private validateRow(
    row: Record<string, string>,
    headerMap: Record<string, number>,
    rowNum: number,
  ): ExpenseRowError[] {
    const errors: ExpenseRowError[] = [];

    // date
    const date = this.getField(row, headerMap, 'date');
    if (!date) {
      errors.push({
        row: rowNum,
        field: 'date',
        value: date,
        message: 'Date is required',
        messageEs: 'La fecha es requerida',
      });
    }

    // invoice_number
    const invoiceNumber = this.getField(row, headerMap, 'invoice_number');
    if (!invoiceNumber) {
      errors.push({
        row: rowNum,
        field: 'invoice_number',
        value: invoiceNumber,
        message: 'Invoice number is required',
        messageEs: 'El numero de factura es requerido',
      });
    }

    // vendor
    const vendor = this.getField(row, headerMap, 'vendor');
    if (!vendor) {
      errors.push({
        row: rowNum,
        field: 'vendor',
        value: vendor,
        message: 'Vendor is required',
        messageEs: 'El proveedor es requerido',
      });
    }

    // amount
    const rawAmount = this.getField(row, headerMap, 'amount').replace(
      /[,$]/g,
      '',
    );
    const amount = parseFloat(rawAmount);
    if (!rawAmount || isNaN(amount)) {
      errors.push({
        row: rowNum,
        field: 'amount',
        value: rawAmount,
        message: `Invalid amount "${rawAmount}" — must be a positive number`,
        messageEs: `Monto invalido "${rawAmount}" — debe ser un numero positivo`,
      });
    } else if (amount <= 0) {
      errors.push({
        row: rowNum,
        field: 'amount',
        value: rawAmount,
        message: 'Amount must be positive',
        messageEs: 'El monto debe ser positivo',
      });
    }

    return errors;
  }

  private emptyResult(errorMessage: string): ExpenseParseResult {
    return {
      valid: false,
      items: [],
      errors: [
        {
          row: 0,
          field: 'headers',
          value: '',
          message: errorMessage,
          messageEs: errorMessage,
        },
      ],
      warnings: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        errorRows: 1,
        totalAmount: 0,
        uniqueVendors: 0,
        dateRange: null,
      },
    };
  }
}
