import { deepDiff } from './deep-diff.util';

describe('deep-diff.util', () => {
  it('returns empty array for identical objects', () => {
    const obj = { a: 1, b: 'hello' };
    expect(deepDiff(obj, obj)).toEqual([]);
  });

  it('detects changed primitive values', () => {
    const diff = deepDiff({ a: 1 }, { a: 2 });
    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'a', oldValue: 1, newValue: 2 }),
      ]),
    );
  });

  it('detects added keys', () => {
    const diff = deepDiff({ a: 1 }, { a: 1, b: 2 });
    expect(diff).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'b', newValue: 2 }),
      ]),
    );
  });
});
