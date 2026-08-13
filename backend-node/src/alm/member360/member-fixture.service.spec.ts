import { MemberAccountCategory } from '@prisma/client';
import { MemberFixtureService } from './member-fixture.service';
import { MemberLifecycleService } from './member-lifecycle.service';

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

  it('all balances are finite and non-negative, and only the churned cohort is zero', () => {
    const members = service.generateMembers('inst-demo-1', 50);
    const churnedStart = MemberFixtureService.ONBOARDING_COHORT;
    const churnedEnd = churnedStart + MemberFixtureService.CHURNED_COHORT;

    members.forEach((member, index) => {
      // The churned cohort is closed out: 0 is its TRUE balance, not a
      // stand-in for an unknown one, so it is exempt from ">0" but not from
      // ">=0". Every other member must still hold real money.
      const isChurnedCohort = index >= churnedStart && index < churnedEnd;
      for (const account of member.accounts) {
        expect(Number.isFinite(account.balance)).toBe(true);
        if (isChurnedCohort) {
          expect(account.balance).toBe(0);
        } else {
          expect(account.balance).toBeGreaterThan(0);
        }
      }
    });
  });

  it('guarantees a demo book reaches ONBOARDING and CHURNED, not just the middle stages', () => {
    // Regression guard for the gap found on 2026-08-13: purely stochastic
    // generation produced 0 onboarding and 0 churned members in a 250-member
    // book, so two lifecycle columns rendered permanently empty in the UI.
    const members = service.generateMembers('inst-demo-1', 50);

    const onboarding = members.slice(0, MemberFixtureService.ONBOARDING_COHORT);
    expect(onboarding).toHaveLength(MemberFixtureService.ONBOARDING_COHORT);
    for (const member of onboarding) {
      // The classifier's onboarding rule: a single SHARE account inside the
      // 30-day tenure window.
      expect(member.accounts).toHaveLength(1);
      expect(member.accounts[0].category).toBe(MemberAccountCategory.SHARE);
      const tenureDays =
        (Date.now() - member.memberSince.getTime()) / 86_400_000;
      expect(tenureDays).toBeLessThanOrEqual(
        MemberLifecycleService.ONBOARDING_WINDOW_DAYS,
      );
    }

    const churned = members.slice(
      MemberFixtureService.ONBOARDING_COHORT,
      MemberFixtureService.ONBOARDING_COHORT +
        MemberFixtureService.CHURNED_COHORT,
    );
    expect(churned).toHaveLength(MemberFixtureService.CHURNED_COHORT);
    for (const member of churned) {
      const total = member.accounts.reduce((sum, a) => sum + a.balance, 0);
      expect(total).toBe(0);
      // A churned member never carries an outstanding loan.
      expect(
        member.accounts.some((a) => a.category === MemberAccountCategory.LOAN),
      ).toBe(false);
    }
  });

  it('skips the pinned cohorts for small books so a tiny fixture is not majority-pinned', () => {
    const small = service.generateMembers(
      'inst-demo-1',
      MemberFixtureService.MIN_BOOK_FOR_COHORTS - 1,
    );
    // With no cohorts, every balance is drawn from a strictly positive range.
    for (const member of small) {
      for (const account of member.accounts) {
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
