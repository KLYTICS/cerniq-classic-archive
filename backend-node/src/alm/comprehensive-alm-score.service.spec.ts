import { ComprehensiveALMScoreService } from './comprehensive-alm-score.service';

describe('ComprehensiveALMScoreService', () => {
  const svc = new ComprehensiveALMScoreService();

  it('calculate returns score, grade, dimensions, and bilingual interpretation', () => {
    const r = svc.calculate({
      nim: 0.035,
      lcr: 120,
      nsfr: 110,
      capitalRatio: 12,
      durationGap: 1.5,
      camelScore: 2,
      earPct: 3,
      concentrationHHI: 1500,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(r.grade);
    expect(r.dimensions.length).toBe(8);
    expect(r.interpretation).toBeTruthy();
    expect(r.interpretationEs).toBeTruthy();
  });

  it('returns grade A for strong metrics', () => {
    const r = svc.calculate({
      nim: 0.04,
      lcr: 100,
      nsfr: 100,
      capitalRatio: 10,
      durationGap: 0,
      camelScore: 1,
      earPct: 0,
      concentrationHHI: 0,
    });
    expect(r.grade).toBe('A');
  });

  it('returns grade F for weak metrics', () => {
    const r = svc.calculate({
      nim: 0,
      lcr: 0,
      nsfr: 0,
      capitalRatio: 0,
      durationGap: 10,
      camelScore: 5,
      earPct: 20,
      concentrationHHI: 10000,
    });
    expect(r.grade).toBe('F');
  });
});
