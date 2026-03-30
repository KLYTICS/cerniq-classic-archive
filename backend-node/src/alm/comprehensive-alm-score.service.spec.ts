import { describe, expect, it } from '@jest/globals';
import { ComprehensiveALMScoreService } from './comprehensive-alm-score.service';

describe('Comprehensive ALM Score', () => {
  const service = new ComprehensiveALMScoreService();

  it.each([
    [
      'A',
      {
        nim: 0.04,
        lcr: 100,
        nsfr: 100,
        capitalRatio: 10,
        durationGap: 0,
        camelScore: 1,
        earPct: 0,
        concentrationHHI: 0,
      },
      'Strong position.',
    ],
    [
      'B',
      {
        nim: 0.028,
        lcr: 70,
        nsfr: 70,
        capitalRatio: 7,
        durationGap: 1,
        camelScore: 2.5,
        earPct: 3,
        concentrationHHI: 3000,
      },
      'Strong position.',
    ],
    [
      'C',
      {
        nim: 0.022,
        lcr: 55,
        nsfr: 55,
        capitalRatio: 5.5,
        durationGap: 2.25,
        camelScore: 3.25,
        earPct: 4.5,
        concentrationHHI: 4500,
      },
      'Improvement needed.',
    ],
    [
      'D',
      {
        nim: 0.016,
        lcr: 40,
        nsfr: 40,
        capitalRatio: 4,
        durationGap: 3,
        camelScore: 4,
        earPct: 6,
        concentrationHHI: 6000,
      },
      'Improvement needed.',
    ],
    [
      'F',
      {
        nim: 0.008,
        lcr: 20,
        nsfr: 20,
        capitalRatio: 2,
        durationGap: 5,
        camelScore: 5,
        earPct: 8,
        concentrationHHI: 8000,
      },
      'Improvement needed.',
    ],
  ])(
    'assigns grade %s for the expected operating profile',
    (grade, params, narrative) => {
      const result = service.calculate(params);

      expect(result.grade).toBe(grade);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.dimensions).toHaveLength(8);
      expect(result.interpretation).toContain(`Grade ${grade}`);
      expect(result.interpretation).toContain(narrative);
      expect(result.interpretationEs).toContain(`${grade}`);
    },
  );

  it('degrades meaningfully under a same-day -7% operating profile', () => {
    const base = service.calculate({
      nim: 0.04,
      lcr: 100,
      nsfr: 100,
      capitalRatio: 10,
      durationGap: 0,
      camelScore: 1,
      earPct: 0,
      concentrationHHI: 0,
    });
    const stressed = service.calculate({
      nim: 0.021,
      lcr: 58,
      nsfr: 65,
      capitalRatio: 6.2,
      durationGap: 2.4,
      camelScore: 3.3,
      earPct: 4.2,
      concentrationHHI: 4200,
    });

    expect(stressed.score).toBeLessThan(base.score);
    expect(['B', 'C', 'D', 'F']).toContain(stressed.grade);
  });
});
