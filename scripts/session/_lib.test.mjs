// scripts/session/_lib.test.mjs
// node:test suite for the pure coordination primitives. Run with:
//   npm run test:session
//
// Disk-touching functions (writeSessionAtomic, readSession, listSessions)
// are exercised by the end-to-end smoke in scripts/session/_lib.smoke.mjs;
// this file pins the policy-critical pure logic with deterministic inputs.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pathsConflict,
  findConflicts,
  isStale,
  STALE_MS,
  currentSessionNickname,
} from './_lib.mjs';

describe('pathsConflict — strict prefix policy', () => {
  it('equal paths conflict', () => {
    assert.equal(pathsConflict('a/b', 'a/b'), true);
  });

  it('proper prefix conflicts', () => {
    assert.equal(pathsConflict('a/b', 'a/b/c'), true);
  });

  it('reverse prefix conflicts', () => {
    assert.equal(pathsConflict('a/b/c', 'a/b'), true);
  });

  it('sibling directories do not conflict', () => {
    assert.equal(pathsConflict('a/b', 'a/c'), false);
  });

  it('completely unrelated paths do not conflict', () => {
    assert.equal(pathsConflict('a', 'b'), false);
  });

  // This is the correctness case that a naive startsWith() gets wrong.
  it('name-prefix collision does not conflict (src/foo vs src/foobar)', () => {
    assert.equal(pathsConflict('src/foo', 'src/foobar'), false);
  });

  it('trailing slash is ignored', () => {
    assert.equal(pathsConflict('a/b/', 'a/b'), true);
    assert.equal(pathsConflict('a/b/', 'a/b/c'), true);
  });

  it('trailing slashes on both sides', () => {
    assert.equal(pathsConflict('a/b/', 'a/b/'), true);
  });

  it('single-component root is still subject to prefix rule', () => {
    assert.equal(pathsConflict('docs', 'docs'), true);
    assert.equal(pathsConflict('docs', 'docs/api'), true);
    assert.equal(pathsConflict('docs', 'documentation'), false);
  });

  it('empty string is treated as its own (non-root) token — does not match normal paths', () => {
    // '' normalizes to '/', which is neither prefix-of nor equal-to 'a/'.
    // This is the safe default: malformed/empty claims are inert rather
    // than blanket-matching everything. Callers should reject '' before
    // storing it as a claim.
    assert.equal(pathsConflict('', 'a'), false);
    assert.equal(pathsConflict('', ''), true); // only matches itself
  });
});

describe('findConflicts — aggregates per peer session', () => {
  const other = {
    nickname: 'reviewer',
    claims: ['backend-node/src/alm', 'docs'],
  };

  it('returns empty when nothing overlaps', () => {
    const c = findConflicts(['frontend/app/portal'], other);
    assert.deepEqual(c, []);
  });

  it('returns one entry per overlapping pair', () => {
    const c = findConflicts(['backend-node/src/alm/services'], other);
    assert.equal(c.length, 1);
    assert.equal(c[0].mine, 'backend-node/src/alm/services');
    assert.equal(c[0].theirs, 'backend-node/src/alm');
    assert.equal(c[0].by, 'reviewer');
  });

  it('cross-product when multiple of my claims overlap one of theirs', () => {
    const c = findConflicts(
      ['backend-node/src/alm', 'backend-node/src/alm/services'],
      other,
    );
    assert.equal(c.length, 2);
  });

  it('handles session with no claims field (defaults to [])', () => {
    const c = findConflicts(['anything'], { nickname: 'empty' });
    assert.deepEqual(c, []);
  });
});

describe('isStale — 30-minute TTL boundary', () => {
  const base = Date.parse('2026-04-15T12:00:00.000Z');

  it('fresh session (just now) is live', () => {
    const s = { heartbeat_at: new Date(base).toISOString() };
    assert.equal(isStale(s, base), false);
  });

  it('session exactly at TTL edge is NOT stale (strict >)', () => {
    const s = { heartbeat_at: new Date(base).toISOString() };
    assert.equal(isStale(s, base + STALE_MS), false);
  });

  it('session one ms past TTL is stale', () => {
    const s = { heartbeat_at: new Date(base).toISOString() };
    assert.equal(isStale(s, base + STALE_MS + 1), true);
  });

  it('falls back to started_at when heartbeat_at missing', () => {
    const s = { started_at: new Date(base).toISOString() };
    assert.equal(isStale(s, base + STALE_MS + 1), true);
  });

  it('treats missing timestamps as epoch (always stale)', () => {
    assert.equal(isStale({}, base), true);
  });
});

describe('currentSessionNickname — env var parsing', () => {
  it('returns null when unset', () => {
    delete process.env.CERNIQ_SESSION;
    assert.equal(currentSessionNickname(), null);
  });

  it('returns valid nickname', () => {
    process.env.CERNIQ_SESSION = 'erwin-alm';
    assert.equal(currentSessionNickname(), 'erwin-alm');
  });

  it('rejects malformed nicknames', () => {
    process.env.CERNIQ_SESSION = 'A'; // uppercase
    assert.equal(currentSessionNickname(), null);
    process.env.CERNIQ_SESSION = '-leading-hyphen';
    assert.equal(currentSessionNickname(), null);
    process.env.CERNIQ_SESSION = 'a'; // too short (1 char)
    assert.equal(currentSessionNickname(), null);
    process.env.CERNIQ_SESSION = 'a'.repeat(33); // too long
    assert.equal(currentSessionNickname(), null);
    delete process.env.CERNIQ_SESSION;
  });

  it('accepts nicknames at length boundaries', () => {
    process.env.CERNIQ_SESSION = 'ab'; // 2 chars, min
    assert.equal(currentSessionNickname(), 'ab');
    process.env.CERNIQ_SESSION = 'a' + 'b'.repeat(31); // 32 chars, max
    assert.equal(currentSessionNickname(), 'a' + 'b'.repeat(31));
    delete process.env.CERNIQ_SESSION;
  });
});
