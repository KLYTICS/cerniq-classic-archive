import { Injectable } from '@nestjs/common';

/**
 * Valid domain prefixes for Redis key namespacing.
 * Each domain maps to a feature area of the CERNIQ platform.
 */
export type RedisDomain =
  | 'alm'
  | 'agent'
  | 'ai'
  | 'session'
  | 'market'
  | 'enterprise'
  | 'cpa'
  | 'rate'
  | 'exam';

/** Default TTLs (in seconds) per domain */
const DOMAIN_TTL: Record<RedisDomain, number> = {
  alm: 1800, // 30 minutes — ALM calculations
  agent: 600, // 10 minutes — agent run artifacts
  ai: 3600, // 1 hour   — LLM responses
  session: 86400, // 24 hours — conversation sessions
  market: 300, // 5 minutes — market data
  enterprise: 3600, // 1 hour   — enterprise config
  cpa: 3600, // 1 hour   — CPA portal data
  rate: 900, // 15 minutes — rate alert thresholds
  exam: 7200, // 2 hours  — exam prep content
};

/**
 * Provides namespaced Redis key generation to prevent collisions
 * as the platform grows.
 *
 * Key pattern: `cerniq:{domain}:{segment1}:{segment2}:...`
 *
 * TD-002: Redis Key Namespacing
 */
@Injectable()
export class RedisNamespaceService {
  private static readonly PREFIX = 'cerniq';

  /**
   * Build a fully-qualified, namespaced Redis key.
   *
   * @param domain  Feature domain (alm, agent, ai, etc.)
   * @param segments  One or more path segments appended after the domain
   * @returns Key in the form `cerniq:{domain}:{seg1}:{seg2}:...`
   */
  key(domain: string, ...segments: string[]): string {
    const parts = [RedisNamespaceService.PREFIX, domain, ...segments].filter(
      (s) => s !== undefined && s !== null && s !== '',
    );
    return parts.join(':');
  }

  /**
   * Shorthand for ALM module cache keys.
   * Pattern: `cerniq:alm:{institutionId}:{module}`
   */
  almKey(institutionId: string, module: string): string {
    return this.key('alm', institutionId, module);
  }

  /**
   * Shorthand for agent run cache keys.
   * Pattern: `cerniq:agent:{runId}:{field}`
   */
  agentKey(runId: string, field: string): string {
    return this.key('agent', runId, field);
  }

  /**
   * Shorthand for AI/LLM response cache keys.
   * Pattern: `cerniq:ai:{institutionId}:{questionHash}`
   */
  aiKey(institutionId: string, questionHash: string): string {
    return this.key('ai', institutionId, questionHash);
  }

  /**
   * Shorthand for conversation session keys.
   * Pattern: `cerniq:session:{userId}:{sessionId}`
   */
  sessionKey(userId: string, sessionId: string): string {
    return this.key('session', userId, sessionId);
  }

  /**
   * Shorthand for market data cache keys.
   * Pattern: `cerniq:market:{dataType}` or `cerniq:market:{dataType}:{tenor}`
   */
  marketKey(dataType: string, tenor?: number): string {
    if (tenor !== undefined && tenor !== null) {
      return this.key('market', dataType, String(tenor));
    }
    return this.key('market', dataType);
  }

  /**
   * Shorthand for rate alert cache keys.
   * Pattern: `cerniq:rate:{institutionId}:{metric}`
   */
  rateAlertKey(institutionId: string, metric: string): string {
    return this.key('rate', institutionId, metric);
  }

  /**
   * Get the default TTL (in seconds) for a given domain.
   * Returns 600 (10 min) for unknown domains.
   */
  ttl(domain: string): number {
    return DOMAIN_TTL[domain as RedisDomain] ?? 600;
  }
}
