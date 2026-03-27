import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// ─── CERNIQ Target Schema Fields ────────────────────────────

const CERNIQ_FIELDS = [
  'subcategory',
  'name',
  'balance',
  'rate',
  'duration',
  'maturityDate',
  'repriceDate',
  'rateType',
  'category',
];

const SUBCATEGORY_VALUES = [
  'cash',
  'securities',
  'consumer_loans',
  'auto_loans',
  'residential_mortgage',
  'commercial_re',
  'commercial_loans',
  'other_assets',
  'credit_cards',
  'demand_deposits',
  'savings_deposits',
  'share_drafts',
  'iras',
  'time_deposits',
  'money_market',
  'fhlb_advances',
  'other_borrowings',
];

// ─── Column Classification Heuristics ───────────────────────

const HEADER_PATTERNS: Record<string, string[]> = {
  balance: [
    'balance',
    'amount',
    'monto',
    'saldo',
    'principal',
    'outstanding',
    'valor',
    'total',
  ],
  rate: [
    'rate',
    'tasa',
    'yield',
    'rendimiento',
    'coupon',
    'interest',
    'interes',
    'apy',
    'apr',
  ],
  duration: [
    'duration',
    'duracion',
    'maturity',
    'vencimiento',
    'term',
    'plazo',
    'years',
    'anos',
  ],
  name: [
    'name',
    'nombre',
    'description',
    'descripcion',
    'instrument',
    'instrumento',
    'account',
    'cuenta',
  ],
  subcategory: [
    'category',
    'categoria',
    'type',
    'tipo',
    'class',
    'clase',
    'subcategory',
    'subcategoria',
    'product',
    'producto',
  ],
  rateType: ['rate_type', 'tipo_tasa', 'fixed', 'variable', 'fijo'],
  maturityDate: ['maturity_date', 'fecha_vencimiento', 'mat_date', 'expiry'],
  repriceDate: ['reprice_date', 'fecha_reprecio', 'next_reprice', 'reset_date'],
};

// ─── Types ───────────────────────────────────────────────────

export interface ColumnMapping {
  csvColumn: string;
  cerniqField: string | null;
  confidence: number; // 0-1
  sampleValues: string[];
}

export interface IngestAnalysisResult {
  mappings: ColumnMapping[];
  sampleData: Record<string, string>[];
  unmappedColumns: string[];
  validationErrors: Array<{ row: number; field: string; issue: string }>;
  warnings: string[];
  ready: boolean;
}

export interface IngestCommitResult {
  rowsIngested: number;
  warnings: string[];
  errors: string[];
}

@Injectable()
export class CsvIngestV2Service {
  private readonly logger = new Logger(CsvIngestV2Service.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Step 1: Analyze CSV & Suggest Mappings ───────────────

  async analyzeCSV(
    institutionId: string,
    csvContent: string,
  ): Promise<IngestAnalysisResult> {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return {
        mappings: [],
        sampleData: [],
        unmappedColumns: [],
        validationErrors: [
          {
            row: 0,
            field: 'file',
            issue: 'CSV must have at least a header + 1 data row',
          },
        ],
        warnings: [],
        ready: false,
      };
    }

    const headers = this.parseCSVLine(lines[0]);
    const sampleRows = lines.slice(1, 4).map((line) => {
      const values = this.parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? '';
      });
      return row;
    });

    // Load saved mappings for this institution
    const savedMappings = await this.prisma.columnMappingMemory.findMany({
      where: { institutionId },
    });
    const savedMap = new Map<string, string>(
      savedMappings
        .filter(
          (mapping): mapping is typeof mapping & { cerniqField: string } =>
            typeof mapping.cerniqField === 'string' &&
            mapping.cerniqField.length > 0,
        )
        .map((m) => [m.csvColumnName.toLowerCase(), m.cerniqField]),
    );

    // Classify each column
    const mappings: ColumnMapping[] = headers.map((header) => {
      const headerLower = header.toLowerCase().trim();
      const sampleValues = sampleRows
        .map((r) => r[header] ?? '')
        .filter(Boolean);

      // Check saved memory first
      if (savedMap.has(headerLower)) {
        return {
          csvColumn: header,
          cerniqField: savedMap.get(headerLower)!,
          confidence: 0.95,
          sampleValues,
        };
      }

      // Pattern matching on header name
      for (const [field, patterns] of Object.entries(HEADER_PATTERNS)) {
        for (const pattern of patterns) {
          if (headerLower.includes(pattern)) {
            return {
              csvColumn: header,
              cerniqField: field,
              confidence: 0.85,
              sampleValues,
            };
          }
        }
      }

      // Value-based inference
      const allNumeric = sampleValues.every(
        (v) => !isNaN(parseFloat(v.replace(/[$,]/g, ''))),
      );
      const hasDecimals = sampleValues.some((v) => v.includes('.'));
      const allSmall = sampleValues.every((v) => {
        const n = parseFloat(v);
        return !isNaN(n) && n >= 0 && n <= 0.3;
      });

      if (allSmall && hasDecimals)
        return {
          csvColumn: header,
          cerniqField: 'rate',
          confidence: 0.6,
          sampleValues,
        };
      if (allNumeric && !allSmall)
        return {
          csvColumn: header,
          cerniqField: 'balance',
          confidence: 0.5,
          sampleValues,
        };

      return {
        csvColumn: header,
        cerniqField: null,
        confidence: 0,
        sampleValues,
      };
    });

    const unmappedColumns = mappings
      .filter((m) => m.cerniqField === null)
      .map((m) => m.csvColumn);

    // Validation
    const validationErrors: IngestAnalysisResult['validationErrors'] = [];
    const warnings: string[] = [];

    const hasBalance = mappings.some((m) => m.cerniqField === 'balance');
    const hasName = mappings.some(
      (m) => m.cerniqField === 'name' || m.cerniqField === 'subcategory',
    );
    if (!hasBalance)
      warnings.push(
        'No balance/amount column detected — required for ingestion.',
      );
    if (!hasName)
      warnings.push(
        'No name/category column detected — items will need manual classification.',
      );

    return {
      mappings,
      sampleData: sampleRows,
      unmappedColumns,
      validationErrors,
      warnings,
      ready: hasBalance && validationErrors.length === 0,
    };
  }

  // ─── Step 2: Commit Ingestion with Confirmed Mappings ─────

  async commitIngestion(
    institutionId: string,
    csvContent: string,
    confirmedMappings: Record<string, string>, // csvColumn → cerniqField
    saveMappings: boolean = true,
  ): Promise<IngestCommitResult> {
    const lines = csvContent.trim().split('\n');
    const headers = this.parseCSVLine(lines[0]);

    // Save confirmed mappings for future uploads
    if (saveMappings) {
      for (const [csvCol, cerniqField] of Object.entries(confirmedMappings)) {
        await this.prisma.columnMappingMemory.upsert({
          where: {
            institutionId_csvColumnName: {
              institutionId,
              csvColumnName: csvCol.toLowerCase(),
            },
          },
          update: { cerniqField, confirmedAt: new Date() },
          create: {
            institutionId,
            csvColumnName: csvCol.toLowerCase(),
            cerniqField,
          },
        });
      }
    }

    // Parse data rows
    const items: any[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length === 0 || values.every((v) => !v.trim())) continue;

      const row: Record<string, any> = {};
      headers.forEach((h, j) => {
        const field = confirmedMappings[h];
        if (field) row[field] = values[j]?.trim() ?? '';
      });

      // Parse balance
      const balance = parseFloat((row.balance ?? '0').replace(/[$,]/g, ''));
      if (isNaN(balance) || balance <= 0) {
        warnings.push(
          `Row ${i + 1}: invalid balance "${row.balance}", skipping.`,
        );
        continue;
      }

      // Parse rate
      let rate = parseFloat((row.rate ?? '0').replace(/%/g, ''));
      if (rate > 1) rate = rate / 100; // handle percentage format

      // Determine category
      const sub = (row.subcategory ?? row.name ?? '').toLowerCase();
      const category = this.inferCategory(sub);

      items.push({
        institutionId,
        category,
        subcategory: this.normalizeSubcategory(sub, category),
        name: row.name || row.subcategory || `Item ${i}`,
        balance,
        rate: Math.max(0, Math.min(0.3, rate)),
        duration: parseFloat(row.duration ?? '1') || 1,
        rateType: (row.rateType || 'fixed').toLowerCase().includes('var')
          ? 'variable'
          : 'fixed',
      });
    }

    if (items.length === 0) {
      return {
        rowsIngested: 0,
        warnings,
        errors: ['No valid rows found after parsing.'],
      };
    }

    // Delete existing and import
    await this.prisma.balanceSheetItem.deleteMany({ where: { institutionId } });
    await this.prisma.balanceSheetItem.createMany({ data: items });

    return { rowsIngested: items.length, warnings, errors };
  }

  // ─── Private Helpers ──────────────────────────────────────

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    result.push(current.trim());
    return result;
  }

  private inferCategory(text: string): 'asset' | 'liability' {
    const liabilityKeywords = [
      'deposit',
      'savings',
      'share',
      'cd',
      'certificate',
      'borrow',
      'fhlb',
      'money_market',
      'ira',
      'draft',
      'liability',
      'pasivo',
    ];
    return liabilityKeywords.some((k) => text.includes(k))
      ? 'liability'
      : 'asset';
  }

  private normalizeSubcategory(text: string, category: string): string {
    const t = text.toLowerCase();
    if (t.includes('cash') || t.includes('efectivo')) return 'cash';
    if (
      t.includes('secur') ||
      t.includes('invest') ||
      t.includes('bond') ||
      t.includes('valor')
    )
      return 'securities';
    if (t.includes('auto') || t.includes('vehicle') || t.includes('vehiculo'))
      return 'auto_loans';
    if (
      t.includes('mortgage') ||
      t.includes('hipotec') ||
      t.includes('residential')
    )
      return 'residential_mortgage';
    if (t.includes('commercial') && t.includes('re')) return 'commercial_re';
    if (t.includes('commercial') || t.includes('c&i'))
      return 'commercial_loans';
    if (t.includes('credit') && t.includes('card')) return 'credit_cards';
    if (t.includes('consumer') || t.includes('personal'))
      return 'consumer_loans';
    if (t.includes('demand') || t.includes('checking'))
      return 'demand_deposits';
    if (t.includes('saving') || t.includes('ahorro')) return 'savings';
    if (
      t.includes('time') ||
      t.includes('cd') ||
      t.includes('plazo') ||
      t.includes('certificate')
    )
      return 'time_deposits';
    if (t.includes('money') && t.includes('market')) return 'money_market';
    if (t.includes('fhlb') || t.includes('borrow')) return 'borrowings';
    if (t.includes('draft')) return 'share_drafts';
    if (t.includes('ira')) return 'iras';
    return category === 'asset' ? 'other_assets' : 'other_borrowings';
  }
}
