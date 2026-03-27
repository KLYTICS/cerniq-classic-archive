// ── PR Cooperativa Vendor Profiles ──────────────────────────────────────────
// Benchmarked against a ~$185M cooperativa (COSSEC Q3 2025 median).
// Quarterly ranges reflect typical spend patterns for PR financial institutions.

export interface VendorProfile {
  vendorType: string;
  displayName: string;
  displayNameEs: string;
  matchKeywords: string[];
  typicalQuarterlyRange: { p25: number; median: number; p75: number };
  paymentFrequency: string;
  notes: string;
}

export const PR_VENDOR_PROFILES: VendorProfile[] = [
  // ── Utilities ──────────────────────────────────────────────────
  {
    vendorType: 'UTILITY_ELECTRIC',
    displayName: 'LUMA Energy / PREPA',
    displayNameEs: 'LUMA Energy / AEE',
    matchKeywords: [
      'prepa',
      'luma',
      'luma energy',
      'autoridad de energia',
      'aee',
      'electric',
      'electricidad',
    ],
    typicalQuarterlyRange: { p25: 18_000, median: 28_000, p75: 42_000 },
    paymentFrequency: 'Monthly',
    notes:
      'Multi-branch cooperativas pay per meter. PR electricity rates ~$0.27/kWh.',
  },
  {
    vendorType: 'UTILITY_WATER',
    displayName: 'AAA (Aqueduct & Sewer)',
    displayNameEs: 'AAA (Acueductos y Alcantarillados)',
    matchKeywords: [
      'aaa',
      'acueductos',
      'alcantarillados',
      'aqueduct',
      'water',
      'agua',
    ],
    typicalQuarterlyRange: { p25: 3_500, median: 6_200, p75: 9_500 },
    paymentFrequency: 'Monthly',
    notes: 'Water/sewer for branch offices.',
  },

  // ── Telecommunications ─────────────────────────────────────────
  {
    vendorType: 'TELECOM',
    displayName: 'Claro PR',
    displayNameEs: 'Claro PR',
    matchKeywords: ['claro', 'america movil', 'cingular'],
    typicalQuarterlyRange: { p25: 8_000, median: 14_500, p75: 22_000 },
    paymentFrequency: 'Monthly',
    notes: 'Phone lines, internet, mobile fleet for branch network.',
  },
  {
    vendorType: 'TELECOM',
    displayName: 'Liberty Communications',
    displayNameEs: 'Liberty Communications',
    matchKeywords: [
      'liberty',
      'liberty communications',
      'liberty cable',
      'liberty business',
    ],
    typicalQuarterlyRange: { p25: 6_000, median: 11_000, p75: 18_000 },
    paymentFrequency: 'Monthly',
    notes: 'Cable, internet, data circuits between branches.',
  },

  // ── Courier / Logistics ────────────────────────────────────────
  {
    vendorType: 'COURIER',
    displayName: 'FedEx',
    displayNameEs: 'FedEx',
    matchKeywords: ['fedex', 'federal express'],
    typicalQuarterlyRange: { p25: 1_200, median: 2_800, p75: 5_000 },
    paymentFrequency: 'Weekly',
    notes: 'Document and check courier between branches and mainland.',
  },
  {
    vendorType: 'COURIER',
    displayName: 'UPS',
    displayNameEs: 'UPS',
    matchKeywords: ['ups', 'united parcel'],
    typicalQuarterlyRange: { p25: 800, median: 2_000, p75: 4_200 },
    paymentFrequency: 'Weekly',
    notes: 'Package and supplies delivery.',
  },

  // ── Audit / Advisory ──────────────────────────────────────────
  {
    vendorType: 'AUDIT_ADVISORY',
    displayName: 'BDO Puerto Rico',
    displayNameEs: 'BDO Puerto Rico',
    matchKeywords: ['bdo', 'bdo puerto rico', 'bdo pr'],
    typicalQuarterlyRange: { p25: 25_000, median: 45_000, p75: 75_000 },
    paymentFrequency: 'Quarterly',
    notes: 'Dominant PR cooperativa auditor. Annual audit + COSSEC exam prep.',
  },
  {
    vendorType: 'AUDIT_ADVISORY',
    displayName: 'Ernst & Young (EY)',
    displayNameEs: 'Ernst & Young (EY)',
    matchKeywords: ['ernst', 'young', 'ey ', 'e&y'],
    typicalQuarterlyRange: { p25: 30_000, median: 55_000, p75: 95_000 },
    paymentFrequency: 'Quarterly',
    notes: 'External audit and advisory for larger cooperativas.',
  },
  {
    vendorType: 'AUDIT_ADVISORY',
    displayName: 'KPMG',
    displayNameEs: 'KPMG',
    matchKeywords: ['kpmg'],
    typicalQuarterlyRange: { p25: 35_000, median: 60_000, p75: 100_000 },
    paymentFrequency: 'Quarterly',
    notes: 'Audit, tax, and risk advisory.',
  },
  {
    vendorType: 'AUDIT_ADVISORY',
    displayName: 'Deloitte',
    displayNameEs: 'Deloitte',
    matchKeywords: ['deloitte', 'deloitte & touche'],
    typicalQuarterlyRange: { p25: 35_000, median: 65_000, p75: 110_000 },
    paymentFrequency: 'Quarterly',
    notes: 'Audit, regulatory compliance, IT advisory.',
  },

  // ── IT / Technology ────────────────────────────────────────────
  {
    vendorType: 'IT_SERVICES',
    displayName: 'IBM',
    displayNameEs: 'IBM',
    matchKeywords: ['ibm', 'international business machines'],
    typicalQuarterlyRange: { p25: 15_000, median: 35_000, p75: 65_000 },
    paymentFrequency: 'Monthly',
    notes: 'Core banking system (AS/400 legacy), maintenance contracts.',
  },
  {
    vendorType: 'IT_SERVICES',
    displayName: 'Cisco Systems',
    displayNameEs: 'Cisco Systems',
    matchKeywords: ['cisco', 'cisco systems', 'meraki'],
    typicalQuarterlyRange: { p25: 8_000, median: 18_000, p75: 35_000 },
    paymentFrequency: 'Quarterly',
    notes: 'Network infrastructure, firewalls, switches, Meraki cloud.',
  },

  // ── Regulatory Fees ────────────────────────────────────────────
  {
    vendorType: 'REGULATORY',
    displayName: 'COSSEC',
    displayNameEs: 'COSSEC',
    matchKeywords: [
      'cossec',
      'corporacion para la supervision',
      'supervision cooperativas',
    ],
    typicalQuarterlyRange: { p25: 12_000, median: 22_000, p75: 38_000 },
    paymentFrequency: 'Quarterly',
    notes: 'Regulatory examination fees and supervision assessments.',
  },

  // ── Insurance ──────────────────────────────────────────────────
  {
    vendorType: 'INSURANCE',
    displayName: 'Triple-S / GFR',
    displayNameEs: 'Triple-S / GFR',
    matchKeywords: [
      'triple-s',
      'triple s',
      'triples',
      'grupo financiero triple',
    ],
    typicalQuarterlyRange: { p25: 45_000, median: 85_000, p75: 135_000 },
    paymentFrequency: 'Monthly',
    notes: 'Employee health insurance. Largest PR health insurer.',
  },
  {
    vendorType: 'INSURANCE',
    displayName: 'Universal Insurance Group',
    displayNameEs: 'Universal Insurance Group',
    matchKeywords: [
      'universal insurance',
      'universal group',
      'universal seguros',
    ],
    typicalQuarterlyRange: { p25: 8_000, median: 16_000, p75: 28_000 },
    paymentFrequency: 'Quarterly',
    notes: 'Property and casualty insurance for branch buildings.',
  },

  // ── Security Services ──────────────────────────────────────────
  {
    vendorType: 'SECURITY',
    displayName: 'Allied Universal / G4S',
    displayNameEs: 'Allied Universal / G4S',
    matchKeywords: [
      'allied universal',
      'g4s',
      'allied',
      'securitas',
      'security',
      'seguridad',
      'guardia',
    ],
    typicalQuarterlyRange: { p25: 20_000, median: 38_000, p75: 60_000 },
    paymentFrequency: 'Monthly',
    notes: 'Armed guards for branches, vault escort, ATM servicing.',
  },

  // ── Office Supplies ────────────────────────────────────────────
  {
    vendorType: 'OFFICE_SUPPLIES',
    displayName: 'Office Depot / OfficeMax',
    displayNameEs: 'Office Depot / OfficeMax',
    matchKeywords: ['office depot', 'officemax', 'office max', 'staples'],
    typicalQuarterlyRange: { p25: 3_000, median: 6_500, p75: 11_000 },
    paymentFrequency: 'Monthly',
    notes: 'Paper, toner, general office supplies for all branches.',
  },

  // ── Maintenance / HVAC ─────────────────────────────────────────
  {
    vendorType: 'MAINTENANCE',
    displayName: 'Carrier / Trane HVAC',
    displayNameEs: 'Carrier / Trane HVAC',
    matchKeywords: [
      'carrier',
      'trane',
      'hvac',
      'aire acondicionado',
      'air conditioning',
      'climate',
      'mantenimiento',
    ],
    typicalQuarterlyRange: { p25: 5_000, median: 12_000, p75: 22_000 },
    paymentFrequency: 'Quarterly',
    notes:
      'HVAC maintenance contracts for branch offices. Critical in PR tropical climate.',
  },
];
