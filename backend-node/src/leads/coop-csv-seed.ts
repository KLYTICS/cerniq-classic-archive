import * as fs from 'fs';
import * as path from 'path';

export interface CooperativaCsvRow {
  name: string;
  institutionType: string;
  location: string;
  estimatedAssets: number;
  publicDataSource: string;
  contactRole: string;
  region: string;
}

const DEFAULT_CSV_PATH = path.resolve(
  __dirname,
  '../../../services/outbound/data/puerto_rico_cooperativas_seed.csv',
);

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

export function loadCooperativaCsvRows(csvPath = DEFAULT_CSV_PATH): CooperativaCsvRow[] {
  const resolved = path.resolve(csvPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Cooperativa CSV not found at ${resolved}`);
  }

  const content = fs.readFileSync(resolved, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const header = parseCsvLine(lines[0]);
  const index = (name: string) => header.indexOf(name);

  const institutionIdx = index('institution');
  const typeIdx = index('institution_type');
  const locationIdx = index('location');
  const assetsIdx = index('estimated_assets');
  const sourceIdx = index('public_data_source');
  const roleIdx = index('contact_role');
  const regionIdx = index('region');

  if (institutionIdx < 0) {
    throw new Error('CSV missing required column: institution');
  }

  const rows: CooperativaCsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const name = cols[institutionIdx]?.trim();
    if (!name) continue;

    rows.push({
      name,
      institutionType: cols[typeIdx]?.trim() || 'cooperativa',
      location: cols[locationIdx]?.trim() || '',
      estimatedAssets: Number.parseInt(cols[assetsIdx] || '0', 10) || 0,
      publicDataSource: cols[sourceIdx]?.trim() || 'cossec',
      contactRole: cols[roleIdx]?.trim() || 'CFO',
      region: cols[regionIdx]?.trim() || '',
    });
  }

  return rows;
}

export function toProspectCreateInput(row: CooperativaCsvRow) {
  return {
    name: row.name,
    institutionType: row.institutionType,
    location: row.location,
    estimatedAssets: row.estimatedAssets,
    publicDataSource: row.publicDataSource,
    contactRole: row.contactRole,
    notes: row.region ? `region:${row.region}` : undefined,
  };
}
