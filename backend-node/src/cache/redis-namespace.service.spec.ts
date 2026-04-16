import { RedisNamespaceService } from './redis-namespace.service';

describe('RedisNamespaceService', () => {
  let service: RedisNamespaceService;

  beforeEach(() => {
    service = new RedisNamespaceService();
  });

  // ── key() ──────────────────────────────────────────────────────────

  describe('key()', () => {
    it('produces cerniq:{domain}:{segments} format', () => {
      expect(service.key('alm', 'inst-123', 'liquidity')).toBe(
        'cerniq:alm:inst-123:liquidity',
      );
    });

    it('handles a single segment', () => {
      expect(service.key('market', 'yield-curve')).toBe(
        'cerniq:market:yield-curve',
      );
    });

    it('handles many segments', () => {
      expect(service.key('agent', 'run-1', 'step', '3', 'output')).toBe(
        'cerniq:agent:run-1:step:3:output',
      );
    });

    it('filters out empty string segments', () => {
      expect(service.key('ai', '', 'hash-abc')).toBe('cerniq:ai:hash-abc');
    });

    it('filters out undefined/null segments', () => {
      expect(
        service.key('session', undefined as unknown as string, 'sid-1'),
      ).toBe('cerniq:session:sid-1');
    });

    it('handles special characters in IDs', () => {
      expect(service.key('alm', 'inst/123', 'field@2')).toBe(
        'cerniq:alm:inst/123:field@2',
      );
    });

    it('handles zero segments (domain-only key)', () => {
      expect(service.key('market')).toBe('cerniq:market');
    });
  });

  // ── Shorthand methods ──────────────────────────────────────────────

  describe('almKey()', () => {
    it('produces cerniq:alm:{institutionId}:{module}', () => {
      expect(service.almKey('inst-42', 'liquidity')).toBe(
        'cerniq:alm:inst-42:liquidity',
      );
    });
  });

  describe('agentKey()', () => {
    it('produces cerniq:agent:{runId}:{field}', () => {
      expect(service.agentKey('run-abc', 'status')).toBe(
        'cerniq:agent:run-abc:status',
      );
    });
  });

  describe('aiKey()', () => {
    it('produces cerniq:ai:{institutionId}:{questionHash}', () => {
      expect(service.aiKey('inst-1', 'sha256hash')).toBe(
        'cerniq:ai:inst-1:sha256hash',
      );
    });
  });

  describe('sessionKey()', () => {
    it('produces cerniq:session:{userId}:{sessionId}', () => {
      expect(service.sessionKey('user-7', 'sess-99')).toBe(
        'cerniq:session:user-7:sess-99',
      );
    });
  });

  describe('marketKey()', () => {
    it('produces cerniq:market:{dataType} without tenor', () => {
      expect(service.marketKey('yield-curve')).toBe(
        'cerniq:market:yield-curve',
      );
    });

    it('produces cerniq:market:{dataType}:{tenor} with tenor', () => {
      expect(service.marketKey('swap-rate', 10)).toBe(
        'cerniq:market:swap-rate:10',
      );
    });

    it('includes tenor when it is 0', () => {
      expect(service.marketKey('overnight', 0)).toBe(
        'cerniq:market:overnight:0',
      );
    });
  });

  describe('rateAlertKey()', () => {
    it('produces cerniq:rate:{institutionId}:{metric}', () => {
      expect(service.rateAlertKey('inst-5', 'nel')).toBe(
        'cerniq:rate:inst-5:nel',
      );
    });
  });

  // ── TTL defaults ───────────────────────────────────────────────────

  describe('ttl()', () => {
    it('returns 3600 for ai domain', () => {
      expect(service.ttl('ai')).toBe(3600);
    });

    it('returns 300 for market domain', () => {
      expect(service.ttl('market')).toBe(300);
    });

    it('returns 86400 for session domain', () => {
      expect(service.ttl('session')).toBe(86400);
    });

    it('returns 1800 for alm domain', () => {
      expect(service.ttl('alm')).toBe(1800);
    });

    it('returns 600 for agent domain', () => {
      expect(service.ttl('agent')).toBe(600);
    });

    it('returns 900 for rate domain', () => {
      expect(service.ttl('rate')).toBe(900);
    });

    it('returns 3600 for enterprise domain', () => {
      expect(service.ttl('enterprise')).toBe(3600);
    });

    it('returns 3600 for cpa domain', () => {
      expect(service.ttl('cpa')).toBe(3600);
    });

    it('returns 7200 for exam domain', () => {
      expect(service.ttl('exam')).toBe(7200);
    });

    it('returns 600 (fallback) for unknown domain', () => {
      expect(service.ttl('unknown')).toBe(600);
    });
  });
});
