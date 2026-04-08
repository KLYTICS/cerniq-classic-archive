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
});
