import { describe, it, expect } from 'vitest';
import { paramString, paramInt, paramBool } from './url-params';

describe('url-params', () => {
  const params = { q: 'search', page: '3', active: 'true', arr: ['a', 'b'] };

  describe('paramString', () => {
    it('returns the param value', () => {
      expect(paramString(params, 'q')).toBe('search');
    });

    it('returns fallback for missing key', () => {
      expect(paramString(params, 'missing', 'default')).toBe('default');
    });

    it('returns first element of array param', () => {
      expect(paramString(params, 'arr')).toBe('a');
    });

    it('falls back when the array param is empty', () => {
      expect(paramString({ arr: [] }, 'arr', 'fallback')).toBe('fallback');
    });
  });

  describe('paramInt', () => {
    it('parses integer param', () => {
      expect(paramInt(params, 'page')).toBe(3);
    });

    it('returns fallback for non-numeric', () => {
      expect(paramInt(params, 'q', 1)).toBe(1);
    });
  });

  describe('paramBool', () => {
    it('parses true values', () => {
      expect(paramBool(params, 'active')).toBe(true);
    });

    it('parses false values', () => {
      expect(paramBool({ active: 'no' }, 'active', true)).toBe(false);
    });

    it('returns fallback for missing', () => {
      expect(paramBool(params, 'missing', false)).toBe(false);
    });
  });
});
