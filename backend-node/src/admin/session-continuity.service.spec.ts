import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { SessionContinuityService } from './session-continuity.service';

describe('SessionContinuityService', () => {
  it('handles missing continuity artifacts safely', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cerniq-session-'));
    const originalCwd = process.cwd();
    process.chdir(tmp);

    const service = new SessionContinuityService();
    const result = await service.getSnapshot();

    expect(result.latestStatusSummary).toEqual([]);
    expect(result.activeModes).toEqual([]);
    expect(result.metrics).toBeNull();

    process.chdir(originalCwd);
  });

  it('still returns a safe snapshot when docs exist but git metadata does not', async () => {
    const tmp = await fs.mkdtemp(
      path.join(os.tmpdir(), 'cerniq-session-docs-'),
    );
    const originalCwd = process.cwd();
    await fs.mkdir(path.join(tmp, 'docs', 'agent'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'docs', 'agent', 'LATEST_SESSION_STATUS.md'),
      '# Latest Session Status\n\n## Summary\n- Local validation is green\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, 'docs', 'agent', 'SESSION_HANDOFF.md'),
      '# Session Handoff\n\n## Exact Next Commands\n```bash\nnpm test\n```\n',
      'utf8',
    );
    process.chdir(path.join(tmp, 'docs'));

    const service = new SessionContinuityService();
    const result = await service.getSnapshot();

    expect(result.activeBranch).toBeNull();
    expect(result.latestStatusSummary).toEqual(['Local validation is green']);
    expect(result.recommendedCommands).toEqual(['npm test']);

    process.chdir(originalCwd);
  });

  it('returns null branch cleanly when no git repo exists', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cerniq-session-'));
    const originalCwd = process.cwd();
    process.chdir(tmp);

    await fs.mkdir(path.join(tmp, 'docs', 'agent'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'docs', 'agent', 'LATEST_SESSION_STATUS.md'),
      '# Latest Session Status\n\n## Summary\n- All clear\n',
      'utf8',
    );

    const service = new SessionContinuityService();
    const result = await service.getSnapshot();

    expect(result.activeBranch).toBeNull();
    expect(result.latestStatusSummary).toEqual(['All clear']);

    process.chdir(originalCwd);
  });

  it('extracts commands and active modes when docs and .omx state exist', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'cerniq-session-'));
    const originalCwd = process.cwd();
    process.chdir(tmp);

    await fs.mkdir(path.join(tmp, 'docs', 'agent'), { recursive: true });
    await fs.mkdir(path.join(tmp, '.omx', 'state'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'docs', 'agent', 'SESSION_HANDOFF.md'),
      '# Session Handoff\n\n## Exact Next Commands\n```bash\ncd backend-node\nnpm test\n```',
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, 'docs', 'agent', 'LATEST_SESSION_STATUS.md'),
      '# Latest Session Status\n\n## Summary\n- Public production verification is green.\n\n## GitHub Actions Blocker\nBilling blocked\n',
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, '.omx', 'state', 'skill-active-state.json'),
      JSON.stringify({ active: true, skill: 'ralph', phase: 'planning' }),
      'utf8',
    );
    await fs.writeFile(
      path.join(tmp, '.omx', 'metrics.json'),
      JSON.stringify({
        turn_count: 8,
        last_turn_at: '2026-04-08T18:00:00.000Z',
      }),
      'utf8',
    );

    const service = new SessionContinuityService();
    const result = await service.getSnapshot();

    expect(result.activeModes).toContain('ralph');
    expect(result.recommendedCommands).toEqual(['cd backend-node', 'npm test']);
    expect(result.latestStatusBlockers).toEqual(['Billing blocked']);

    process.chdir(originalCwd);
  });
});
