/**
 * Fixture registry. Adding a new fixture is a one-step change: drop a `<seedKey>.json`
 * file in this directory. The loader scans the directory at boot and validates that
 * every fixture's filename matches its `seedKey` field — a missing or mismatched
 * fixture is a deploy-time error rather than a runtime surprise.
 *
 * We read JSON via `fs` rather than `import` to avoid requiring `resolveJsonModule` in
 * tsconfig and to keep fixtures hot-reloadable in test environments.
 */
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { InstitutionFixture } from './_schema';

const FIXTURE_DIR = __dirname;

function loadAllFixtures(): Record<string, InstitutionFixture> {
  const out: Record<string, InstitutionFixture> = {};
  const files = readdirSync(FIXTURE_DIR).filter(
    (f) => f.endsWith('.json') && !f.startsWith('_'),
  );

  for (const file of files) {
    const path = join(FIXTURE_DIR, file);
    const raw = readFileSync(path, 'utf-8');
    const fixture = JSON.parse(raw) as InstitutionFixture;
    const expectedKey = basename(file, '.json');

    if (fixture.seedKey !== expectedKey) {
      throw new Error(
        `Fixture file ${file} declares seedKey="${fixture.seedKey}" but filename implies "${expectedKey}". They must match.`,
      );
    }
    if (out[fixture.seedKey]) {
      throw new Error(`Duplicate fixture seedKey: ${fixture.seedKey}`);
    }
    out[fixture.seedKey] = fixture;
  }

  return out;
}

const FIXTURES = loadAllFixtures();

export function listFixtures(): InstitutionFixture[] {
  return Object.values(FIXTURES);
}

export function getFixture(seedKey: string): InstitutionFixture {
  const fixture = FIXTURES[seedKey];
  if (!fixture) {
    const available = Object.keys(FIXTURES).join(', ') || '(none registered)';
    throw new Error(
      `Unknown institution fixture "${seedKey}". Available: ${available}`,
    );
  }
  return fixture;
}

export type { InstitutionFixture, SeedResult } from './_schema';
