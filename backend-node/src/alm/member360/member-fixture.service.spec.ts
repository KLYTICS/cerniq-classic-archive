import { MemberAccountCategory } from '@prisma/client';
import { MemberFixtureService } from './member-fixture.service';

describe('MemberFixtureService', () => {
  let service: MemberFixtureService;

  beforeEach(() => {
    service = new MemberFixtureService();
  });

  it('is deterministic: same institutionId + count produces byte-identical output', () => {
    const a = service.generateMembers('inst-demo-1', 20);
    const b = service.generateMembers('inst-demo-1', 20);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces different books for different institutions', () => {
    const a = service.generateMembers('inst-demo-1', 20);
    const b = service.generateMembers('inst-demo-2', 20);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('generates the requested member count', () => {
    const members = service.generateMembers('inst-demo-1', 37);
    expect(members).toHaveLength(37);
  });

  it('every member carries a SHARE account (mandatory cooperativa membership)', () => {
    const members = service.generateMembers('inst-demo-1', 50);
    for (const member of members) {
      expect(
        member.accounts.some((a) => a.category === MemberAccountCategory.SHARE),
      ).toBe(true);
    }
  });

  it('every member number is unique within the generated book', () => {
    const members = service.generateMembers('inst-demo-1', 100);
    const numbers = new Set(members.map((m) => m.memberNumber));
    expect(numbers.size).toBe(100);
  });

  it('every loan account has a delinquencyDays value and a derived COSSEC classification', () => {
    const members = service.generateMembers('inst-demo-1', 50);
    const loanAccounts = members.flatMap((m) =>
      m.accounts.filter((a) => a.category === MemberAccountCategory.LOAN),
    );
    expect(loanAccounts.length).toBeGreaterThan(0);
    for (const account of loanAccounts) {
      expect(account.delinquencyDays).not.toBeNull();
      expect(account.cossecClassification).not.toBeNull();
    }
  });

  it('non-loan accounts (SHARE) carry no delinquency days or COSSEC classification', () => {
    const members = service.generateMembers('inst-demo-1', 50);
    const shareAccounts = members.flatMap((m) =>
      m.accounts.filter((a) => a.category === MemberAccountCategory.SHARE),
    );
    for (const account of shareAccounts) {
      expect(account.delinquencyDays).toBeNull();
      expect(account.cossecClassification).toBeNull();
    }
  });

  it('CD accounts (certificado de depósito) carry a maturity date', () => {
    const members = service.generateMembers('inst-demo-1', 80);
    const cds = members.flatMap((m) =>
      m.accounts.filter((a) => a.productType === 'certificado de depósito'),
    );
    expect(cds.length).toBeGreaterThan(0);
    for (const cd of cds) {
      expect(cd.maturityDate).not.toBeNull();
    }
  });

  it('all balances are positive and finite', () => {
    const members = service.generateMembers('inst-demo-1', 50);
    for (const member of members) {
      for (const account of member.accounts) {
        expect(Number.isFinite(account.balance)).toBe(true);
        expect(account.balance).toBeGreaterThan(0);
      }
    }
  });

  it('memberSince is always in the past', () => {
    const members = service.generateMembers('inst-demo-1', 20);
    const now = Date.now();
    for (const member of members) {
      expect(member.memberSince.getTime()).toBeLessThan(now);
    }
  });
});
