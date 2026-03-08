import { Injectable, Logger, BadRequestException } from '@nestjs/common';

// ─── Cooperativa subcategory mapping (ES → system key) ─────────────
const SUBCATEGORY_ALIASES: Record<string, string> = {
  // Spanish asset names
  prestamos_personales: 'consumer_loans',
  prestamos_hipotecarios: 'residential_mortgages',
  prestamos_comerciales: 'commercial_loans',
  inversiones: 'investment_securities',
  efectivo_equivalentes: 'cash_equivalents',
  efectivo: 'cash_equivalents',
  otros_activos: 'other_assets',
  // Spanish liability names
  ahorros_socios: 'savings_deposits',
  certificados_accion: 'time_deposits',
  depositos_a_plazo: 'time_deposits',
  cuentas_corrientes: 'demand_deposits',
  prestamos_externos: 'borrowings',
  otros_pasivos: 'other_liabilities',
  // English passthrough (already valid)
  commercial_loans: 'commercial_loans',
  residential_mortgages: 'residential_mortgages',
  consumer_loans: 'consumer_loans',
  investment_securities: 'investment_securities',
  cash_equivalents: 'cash_equivalents',
  other_assets: 'other_assets',
  demand_deposits: 'demand_deposits',
  savings_deposits: 'savings_deposits',
  time_deposits: 'time_deposits',
  borrowings: 'borrowings',
  subordinated_debt: 'subordinated_debt',
  other_liabilities: 'other_liabilities',
};

const VALID_CATEGORIES = ['asset', 'liability', 'activo', 'pasivo'];
const VALID_RATE_TYPES = ['fixed', 'variable', 'hybrid', 'fijo', 'variable'];

const ASSET_SUBCATEGORIES = new Set([
  'commercial_loans', 'residential_mortgages', 'consumer_loans',
  'investment_securities', 'cash_equivalents', 'other_assets',
]);
const LIABILITY_SUBCATEGORIES = new Set([
  'demand_deposits', 'savings_deposits', 'time_deposits',
  'borrowings', 'subordinated_debt', 'other_liabilities',
]);

export interface CSVRowError {
  row: number;
  field: string;
  value: string;
  message: string;
  messageEs: string;
}

export interface CSVParseResult {
  valid: boolean;
  items: ParsedBalanceSheetItem[];
  errors: CSVRowError[];
  warnings: string[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    totalAssets: number;
    totalLiabilities: number;
  };
}

export interface ParsedBalanceSheetItem {
  category: string;
  subcategory: string;
  name: string;
  balance: number;
  rate: number;
  duration: number;
  repriceDate?: string;
  maturityDate?: string;
  rateType: string;
}

@Injectable()
export class CSVIngestionService {
  private readonly logger = new Logger(CSVIngestionService.name);

  parseCSV(csvContent: string): CSVParseResult {
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return this.emptyResult('CSV must have a header row and at least one data row');
    }

    // Parse headers
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, ''));
    const requiredHeaders = ['category', 'subcategory', 'name', 'balance', 'rate', 'duration', 'ratetype'];

    // Also accept Spanish headers
    const headerMap = this.mapHeaders(headers);
    const missingHeaders = requiredHeaders.filter((h) => headerMap[h] === undefined);

    if (missingHeaders.length > 0) {
      return this.emptyResult(
        `Missing required columns: ${missingHeaders.join(', ')}. ` +
        `Required: category, subcategory, name, balance, rate, duration, rateType`,
      );
    }

    // Parse rows
    const items: ParsedBalanceSheetItem[] = [];
    const errors: CSVRowError[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0) continue;

      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').trim();
      });

      const rowErrors = this.validateRow(row, headerMap, i + 1);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        continue;
      }

      // Normalize values
      const rawCategory = this.getField(row, headerMap, 'category').toLowerCase();
      const category = rawCategory === 'activo' ? 'asset' : rawCategory === 'pasivo' ? 'liability' : rawCategory;

      const rawSubcategory = this.getField(row, headerMap, 'subcategory').toLowerCase().replace(/\s+/g, '_');
      const subcategory = SUBCATEGORY_ALIASES[rawSubcategory] || rawSubcategory;

      // Validate subcategory matches category
      if (category === 'asset' && !ASSET_SUBCATEGORIES.has(subcategory)) {
        if (LIABILITY_SUBCATEGORIES.has(subcategory)) {
          errors.push({
            row: i + 1, field: 'subcategory', value: rawSubcategory,
            message: `"${rawSubcategory}" is a liability subcategory but row is marked as asset`,
            messageEs: `"${rawSubcategory}" es subcategoría de pasivo pero la fila está marcada como activo`,
          });
          continue;
        }
        warnings.push(`Row ${i + 1}: Unknown subcategory "${rawSubcategory}" mapped to "${subcategory}"`);
      }
      if (category === 'liability' && !LIABILITY_SUBCATEGORIES.has(subcategory)) {
        if (ASSET_SUBCATEGORIES.has(subcategory)) {
          errors.push({
            row: i + 1, field: 'subcategory', value: rawSubcategory,
            message: `"${rawSubcategory}" is an asset subcategory but row is marked as liability`,
            messageEs: `"${rawSubcategory}" es subcategoría de activo pero la fila está marcada como pasivo`,
          });
          continue;
        }
        warnings.push(`Row ${i + 1}: Unknown subcategory "${rawSubcategory}" mapped to "${subcategory}"`);
      }

      const balance = parseFloat(this.getField(row, headerMap, 'balance'));
      const rawRate = parseFloat(this.getField(row, headerMap, 'rate'));
      // Auto-detect: if rate > 1, treat as percentage (5.25 → 0.0525); if ≤ 1, treat as decimal
      const rate = rawRate > 1 ? rawRate / 100 : rawRate;

      if (rawRate > 1) {
        warnings.push(`Row ${i + 1}: Rate ${rawRate} interpreted as ${rawRate}% (converted to ${rate})`);
      }

      const rawRateType = this.getField(row, headerMap, 'ratetype').toLowerCase();
      const rateType = rawRateType === 'fijo' ? 'fixed' : rawRateType;

      const repriceDateRaw = this.getField(row, headerMap, 'repricedate');
      const maturityDateRaw = this.getField(row, headerMap, 'maturitydate');

      items.push({
        category,
        subcategory,
        name: this.getField(row, headerMap, 'name'),
        balance,
        rate,
        duration: parseFloat(this.getField(row, headerMap, 'duration')),
        repriceDate: repriceDateRaw || undefined,
        maturityDate: maturityDateRaw || undefined,
        rateType,
      });
    }

    const totalAssets = items.filter((i) => i.category === 'asset').reduce((s, i) => s + i.balance, 0);
    const totalLiabilities = items.filter((i) => i.category === 'liability').reduce((s, i) => s + i.balance, 0);

    // Sanity check: equity should be positive
    if (items.length > 0 && totalAssets < totalLiabilities) {
      warnings.push(
        `Warning: Total liabilities ($${totalLiabilities.toFixed(1)}M) exceed total assets ($${totalAssets.toFixed(1)}M) — negative equity`,
      );
    }

    return {
      valid: errors.length === 0 && items.length > 0,
      items,
      errors,
      warnings,
      summary: {
        totalRows: lines.length - 1,
        validRows: items.length,
        errorRows: errors.length,
        totalAssets,
        totalLiabilities,
      },
    };
  }

  // ─── Cooperativa CSV Template ─────────────────────────────────────

  getCooperativaTemplate(): string {
    return [
      'category,subcategory,name,balance,rate,duration,rateType',
      'asset,prestamos_personales,Préstamos Auto y Personal,75,8.50,3.0,fixed',
      'asset,prestamos_hipotecarios,Préstamos Hipotecarios,90,6.25,12.0,fixed',
      'asset,prestamos_comerciales,Préstamos Comerciales,25,9.00,2.0,variable',
      'asset,inversiones,Bonos e Inversiones,40,4.50,3.5,fixed',
      'asset,efectivo_equivalentes,Efectivo y Equivalentes,20,5.25,0.1,variable',
      'liability,ahorros_socios,Ahorros de Socios,85,1.75,0.3,variable',
      'liability,certificados_accion,Certificados de Acción,55,4.50,1.2,fixed',
      'liability,cuentas_corrientes,Cuentas Corrientes,35,0.25,0.1,variable',
      'liability,prestamos_externos,Préstamos FHLB,30,5.50,2.0,fixed',
      'liability,depositos_a_plazo,Depósitos a Plazo,20,3.80,0.8,fixed',
    ].join('\n');
  }

  getGenericTemplate(): string {
    return [
      'category,subcategory,name,balance,rate,duration,rateType',
      'asset,commercial_loans,Commercial Real Estate,350,5.25,4.5,fixed',
      'asset,residential_mortgages,30yr Fixed Mortgages,280,4.75,6.2,fixed',
      'asset,investment_securities,Treasury Notes,120,4.10,2.8,fixed',
      'asset,cash_equivalents,Cash & Fed Funds,80,5.30,0.1,variable',
      'liability,demand_deposits,Checking Accounts,200,0.50,0.1,variable',
      'liability,savings_deposits,Money Market,150,3.80,0.3,variable',
      'liability,time_deposits,12-Month CDs,180,4.00,0.9,fixed',
      'liability,borrowings,FHLB Advances,100,4.50,1.5,fixed',
    ].join('\n');
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /** Map Spanish/English header synonyms to canonical keys */
  private mapHeaders(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    const synonyms: Record<string, string> = {
      category: 'category', categoria: 'category',
      subcategory: 'subcategory', subcategoria: 'subcategory',
      name: 'name', nombre: 'name',
      balance: 'balance', saldo: 'balance', monto: 'balance',
      rate: 'rate', tasa: 'rate',
      duration: 'duration', duracion: 'duration',
      ratetype: 'ratetype', tipotasa: 'ratetype', tipo_tasa: 'ratetype',
      repricedate: 'repricedate', fechareprecio: 'repricedate',
      maturitydate: 'maturitydate', fechavencimiento: 'maturitydate',
    };

    headers.forEach((h, idx) => {
      const canonical = synonyms[h.replace(/[_\s]/g, '')] || h;
      if (!map[canonical]) {
        map[canonical] = idx;
      }
    });

    return map;
  }

  private getField(row: Record<string, string>, headerMap: Record<string, number>, key: string): string {
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

  private validateRow(row: Record<string, string>, headerMap: Record<string, number>, rowNum: number): CSVRowError[] {
    const errors: CSVRowError[] = [];

    // Category
    const category = this.getField(row, headerMap, 'category').toLowerCase();
    if (!VALID_CATEGORIES.includes(category)) {
      errors.push({
        row: rowNum, field: 'category', value: category,
        message: `Invalid category "${category}". Must be: asset, liability (or activo, pasivo)`,
        messageEs: `Categoría inválida "${category}". Debe ser: asset, liability, activo, o pasivo`,
      });
    }

    // Name
    const name = this.getField(row, headerMap, 'name');
    if (!name || name.length === 0) {
      errors.push({
        row: rowNum, field: 'name', value: name,
        message: 'Name is required',
        messageEs: 'Nombre es requerido',
      });
    }

    // Balance
    const balanceStr = this.getField(row, headerMap, 'balance');
    const balance = parseFloat(balanceStr);
    if (isNaN(balance)) {
      errors.push({
        row: rowNum, field: 'balance', value: balanceStr,
        message: `Invalid balance "${balanceStr}" — must be a number`,
        messageEs: `Saldo inválido "${balanceStr}" — debe ser un número`,
      });
    } else if (balance < 0) {
      errors.push({
        row: rowNum, field: 'balance', value: balanceStr,
        message: 'Balance cannot be negative',
        messageEs: 'El saldo no puede ser negativo',
      });
    }

    // Rate
    const rateStr = this.getField(row, headerMap, 'rate');
    const rate = parseFloat(rateStr);
    if (isNaN(rate)) {
      errors.push({
        row: rowNum, field: 'rate', value: rateStr,
        message: `Invalid rate "${rateStr}" — must be a number`,
        messageEs: `Tasa inválida "${rateStr}" — debe ser un número`,
      });
    } else if (rate < 0 || rate > 100) {
      errors.push({
        row: rowNum, field: 'rate', value: rateStr,
        message: `Rate ${rate} out of range (0–100%)`,
        messageEs: `Tasa ${rate} fuera de rango (0–100%)`,
      });
    }

    // Duration
    const durationStr = this.getField(row, headerMap, 'duration');
    const duration = parseFloat(durationStr);
    if (isNaN(duration)) {
      errors.push({
        row: rowNum, field: 'duration', value: durationStr,
        message: `Invalid duration "${durationStr}" — must be a number in years`,
        messageEs: `Duración inválida "${durationStr}" — debe ser un número en años`,
      });
    } else if (duration < 0 || duration > 50) {
      errors.push({
        row: rowNum, field: 'duration', value: durationStr,
        message: `Duration ${duration} out of range (0–50 years)`,
        messageEs: `Duración ${duration} fuera de rango (0–50 años)`,
      });
    }

    // Rate type
    const rateType = this.getField(row, headerMap, 'ratetype').toLowerCase();
    if (rateType && !VALID_RATE_TYPES.includes(rateType)) {
      errors.push({
        row: rowNum, field: 'rateType', value: rateType,
        message: `Invalid rate type "${rateType}". Must be: fixed, variable, hybrid (or fijo)`,
        messageEs: `Tipo de tasa inválido "${rateType}". Debe ser: fixed, variable, hybrid, o fijo`,
      });
    }

    return errors;
  }

  private emptyResult(errorMessage: string): CSVParseResult {
    return {
      valid: false,
      items: [],
      errors: [{
        row: 0, field: 'headers', value: '',
        message: errorMessage,
        messageEs: errorMessage,
      }],
      warnings: [],
      summary: { totalRows: 0, validRows: 0, errorRows: 1, totalAssets: 0, totalLiabilities: 0 },
    };
  }
}
