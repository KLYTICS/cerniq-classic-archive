import { describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_DIR = __dirname;
const SAMPLE_PARAMS = Object.freeze({
  institutionId: 'cerniq-first-gate',
  marketShockPct: -7,
  liquidityBufferDays: 14,
  capitalRatio: 11.8,
});

const passthroughServiceFiles = fs
  .readdirSync(SERVICE_DIR)
  .filter((file) => file.endsWith('.service.ts'))
  .filter((file) => {
    const source = fs.readFileSync(path.join(SERVICE_DIR, file), 'utf8');
    return (
      source.includes('analyze(params') &&
      source.includes('result: params') &&
      source.includes('interpretationEs')
    );
  })
  .sort();

describe('ALM passthrough quant models', () => {
  it('keeps the passthrough catalog under explicit contract coverage', () => {
    expect(passthroughServiceFiles.length).toBeGreaterThanOrEqual(50);
  });

  it.each(passthroughServiceFiles)(
    '%s returns a stable narrative payload for stressed inputs',
    (file) => {
      const modulePath = path.join(SERVICE_DIR, file.replace(/\.ts$/, ''));
      const exports = require(modulePath) as Record<string, unknown>;
      const ServiceClass = Object.values(exports).find(
        (value) => typeof value === 'function',
      ) as new () => { analyze: (params: typeof SAMPLE_PARAMS) => any };

      expect(ServiceClass).toBeDefined();

      const service = new ServiceClass();
      const result = service.analyze({ ...SAMPLE_PARAMS });

      expect(result.result).toEqual(SAMPLE_PARAMS);
      expect(result.interpretation).toEqual(expect.any(String));
      expect(result.interpretationEs).toEqual(expect.any(String));
      expect(result.interpretation.trim().length).toBeGreaterThan(0);
      expect(result.interpretationEs.trim().length).toBeGreaterThan(0);
    },
  );
});
