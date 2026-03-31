import { describe, expect, it } from 'vitest';
import { asRecord, unwrapApiArray, unwrapApiData } from './api-response';

describe('api response helpers', () => {
  it('unwraps the standard success envelope', () => {
    expect(
      unwrapApiData<{ tier: string }>({
        success: true,
        data: { tier: 'monthly' },
      }),
    ).toEqual({ tier: 'monthly' });
  });

  it('passes through plain payloads unchanged', () => {
    expect(unwrapApiData([{ id: 'job-1' }])).toEqual([{ id: 'job-1' }]);
  });

  it('unwraps response arrays and falls back to an empty list for malformed payloads', () => {
    expect(
      unwrapApiArray<{ id: string }>({
        success: true,
        data: [{ id: 'job-1' }],
      }),
    ).toEqual([{ id: 'job-1' }]);
    expect(unwrapApiArray<{ id: string }>({ success: true, data: null })).toEqual([]);
  });

  it('only treats objects as records', () => {
    expect(asRecord(null)).toBeNull();
    expect(asRecord('text')).toBeNull();
    expect(asRecord({ ok: true })).toEqual({ ok: true });
  });
});
