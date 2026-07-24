import {
  buildOutreach,
  buildSeatContactNote,
  matchCossecSlug,
  scoreInstitution,
} from './cooperativa-outreach';

describe('cooperativa-outreach', () => {
  it('scores tier-1 finance buyer with COSSEC as high priority A', () => {
    const result = scoreInstitution({
      estimatedAssets: 320_000_000,
      contactRole: 'CFO',
      region: 'East',
      cossec: true,
    });
    expect(result.tier).toBe(1);
    expect(result.grade).toBe('A');
    expect(result.pri).toBe('H');
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it('builds compact outreach without fabricating PII', () => {
    const outreach = buildOutreach({
      name: 'Cooperativa de Ahorro y Crédito de Caguas',
      location: 'Caguas, PR',
      estimatedAssets: 320_000_000,
      contactRole: 'CFO',
      region: 'East',
    });

    expect(outreach.secure.pii).toBe('none');
    expect(outreach.secure.access).toBe('admin');
    expect(outreach.role).toBe('cfo');
    expect(outreach.note).toContain('CFO');
    expect(outreach.seq).toContain('in-person');
    expect(outreach.cossec).toBe(true);
  });

  it('matches known COSSEC slug', () => {
    expect(matchCossecSlug('Cooperativa de Ahorro y Crédito de Bayamón')).toBe(
      'bayamon',
    );
  });

  it('builds seat contact note only for primary buyers', () => {
    const outreach = buildOutreach({
      name: 'Cooperativa de Ahorro y Crédito de Aguada',
      location: 'Aguada, PR',
      estimatedAssets: 150_000_000,
      contactRole: 'CFO',
      region: 'West',
    });

    expect(
      buildSeatContactNote({
        roleKey: 'cfo',
        isPrimaryBuyer: true,
        outreach,
      }),
    ).toMatchObject({
      bestChannel: expect.any(String),
      openerEs: expect.stringContaining('CERNIQ'),
      openerEn: expect.stringContaining('CERNIQ'),
    });

    expect(
      buildSeatContactNote({
        roleKey: 'vp_operaciones',
        isPrimaryBuyer: false,
        outreach,
      }),
    ).toBeNull();
  });
});
