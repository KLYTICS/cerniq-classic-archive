import { ChangelogController } from './changelog.controller';

describe('ChangelogController', () => {
  const controller = new ChangelogController();

  it('returns the full changelog by default', () => {
    const result = controller.getChangelog();

    expect(result).toHaveLength(3);
    expect(result[0].version).toBe('1.4.0');
  });

  it('clamps the query limit between 1 and 50', () => {
    expect(controller.getChangelog('1')).toHaveLength(1);
    expect(controller.getChangelog('0')).toHaveLength(1);
    expect(controller.getChangelog('999')).toHaveLength(3);
    expect(controller.getChangelog('not-a-number')).toHaveLength(3);
  });
});
