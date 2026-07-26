import {
  COOPERATIVA_LEADERSHIP_ROLES,
  COOPERATIVA_ORG_UNITS,
  COOPERATIVA_STRUCTURE_VERSION,
  extractMunicipality,
  resolvePrimaryRoleKey,
  slugifyCooperativaName,
} from './cooperativa-org-template';

describe('cooperativa-org-template', () => {
  it('slugifies cooperativa names', () => {
    expect(
      slugifyCooperativaName('Cooperativa de Ahorro y Crédito de Caguas'),
    ).toBe('caguas');
  });

  it('maps CSV contact roles to canonical role keys', () => {
    expect(resolvePrimaryRoleKey('VP Finanzas')).toBe('gerente_financiero');
    expect(resolvePrimaryRoleKey('CFO')).toBe('cfo');
  });

  it('defines full org unit and leadership template', () => {
    expect(COOPERATIVA_ORG_UNITS.length).toBeGreaterThanOrEqual(8);
    expect(COOPERATIVA_LEADERSHIP_ROLES.length).toBeGreaterThanOrEqual(16);
    expect(COOPERATIVA_STRUCTURE_VERSION).toBe('2026.1');
  });

  it('extracts municipality from location', () => {
    expect(extractMunicipality('Bayamón, PR')).toBe('Bayamón');
  });
});
