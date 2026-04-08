import { Injectable } from '@nestjs/common';
import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface SessionContinuitySnapshot {
  workspaceRoot: string;
  activeBranch: string | null;
  latestStatusSummary: string[];
  latestStatusBlockers: string[];
  lastAgentOutputTitle: string | null;
  handoffUpdatedAt: string | null;
  latestStatusUpdatedAt: string | null;
  activeModes: string[];
  stateFiles: string[];
  metrics:
    | {
        turnCount: number | null;
        lastTurnAt: string | null;
      }
    | null;
  recommendedCommands: string[];
}

@Injectable()
export class SessionContinuityService {
  async getSnapshot(): Promise<SessionContinuitySnapshot> {
    const workspaceRoot = await this.resolveWorkspaceRoot();
    const handoffPath = path.join(
      workspaceRoot,
      'docs',
      'agent',
      'SESSION_HANDOFF.md',
    );
    const latestStatusPath = path.join(
      workspaceRoot,
      'docs',
      'agent',
      'LATEST_SESSION_STATUS.md',
    );
    const omxStateDir = path.join(workspaceRoot, '.omx', 'state');
    const metricsPath = path.join(workspaceRoot, '.omx', 'metrics.json');

    const [handoffText, latestStatusText, stateFiles, metrics, hudState] =
      await Promise.all([
        this.readText(handoffPath),
        this.readText(latestStatusPath),
        this.readStateFiles(omxStateDir),
        this.readJson<any>(metricsPath),
        this.readJson<any>(path.join(omxStateDir, 'hud-state.json')),
      ]);

    return {
      workspaceRoot,
      activeBranch: this.readGitBranch(workspaceRoot),
      latestStatusSummary: this.extractBullets(latestStatusText, '## Summary'),
      latestStatusBlockers: this.extractParagraphLines(
        latestStatusText,
        '## GitHub Actions Blocker',
      ),
      lastAgentOutputTitle:
        typeof hudState?.last_agent_output === 'string'
          ? this.extractAgentTitle(hudState.last_agent_output)
          : null,
      handoffUpdatedAt: await this.readUpdatedAt(handoffPath),
      latestStatusUpdatedAt: await this.readUpdatedAt(latestStatusPath),
      activeModes: this.extractActiveModes(stateFiles),
      stateFiles: stateFiles.map((file) => path.basename(file.path)),
      metrics: metrics
        ? {
            turnCount:
              typeof metrics.turn_count === 'number'
                ? metrics.turn_count
                : null,
            lastTurnAt:
              typeof metrics.last_turn_at === 'string'
                ? metrics.last_turn_at
                : null,
          }
        : null,
      recommendedCommands: this.extractCodeBlockCommands(handoffText),
    };
  }

  private async resolveWorkspaceRoot() {
    const candidates = [
      process.cwd(),
      path.resolve(process.cwd(), '..'),
      path.resolve(process.cwd(), '../..'),
    ];

    for (const candidate of candidates) {
      const docsPath = path.join(candidate, 'docs', 'agent');
      const omxPath = path.join(candidate, '.omx');
      if ((await this.exists(docsPath)) || (await this.exists(omxPath))) {
        return candidate;
      }
    }

    return path.resolve(process.cwd(), '..');
  }

  private extractBullets(markdown: string | null, heading: string): string[] {
    if (!markdown) return [];
    const section = this.extractSection(markdown, heading);
    return section
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .map((line) => line.slice(2).trim())
      .slice(0, 6);
  }

  private extractParagraphLines(
    markdown: string | null,
    heading: string,
  ): string[] {
    if (!markdown) return [];
    const section = this.extractSection(markdown, heading);
    return section
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('- '))
      .slice(0, 6);
  }

  private extractSection(markdown: string, heading: string) {
    const marker = markdown.indexOf(heading);
    if (marker === -1) return '';
    const nextHeading = markdown.indexOf('\n## ', marker + heading.length);
    return markdown
      .slice(marker + heading.length, nextHeading === -1 ? undefined : nextHeading)
      .trim();
  }

  private extractAgentTitle(raw: string): string | null {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed?.title === 'string' ? parsed.title : null;
    } catch {
      return raw.trim() || null;
    }
  }

  private async readStateFiles(dir: string) {
    if (!(await this.exists(dir))) return [];
    const files = await fs.readdir(dir);
    return Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => ({
          path: path.join(dir, file),
          data: await this.readJson<any>(path.join(dir, file)),
        })),
    );
  }

  private extractActiveModes(
    files: Array<{ path: string; data: any }>,
  ): string[] {
    return files
      .filter(({ data }) => data && (data.active === true || data.phase))
      .map(({ path: filePath, data }) =>
        typeof data.skill === 'string'
          ? data.skill
          : path.basename(filePath, '.json'),
      );
  }

  private extractCodeBlockCommands(markdown: string | null): string[] {
    if (!markdown) return [];
    const match = markdown.match(
      /## Exact Next Commands[\s\S]*?```bash([\s\S]*?)```/,
    );
    if (!match?.[1]) return [];
    return match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .slice(0, 8);
  }

  private readGitBranch(cwd: string): string | null {
    try {
      return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd,
        encoding: 'utf8',
      }).trim();
    } catch {
      return null;
    }
  }

  private async readUpdatedAt(filePath: string) {
    try {
      const stat = await fs.stat(filePath);
      return stat.mtime.toISOString();
    } catch {
      return null;
    }
  }

  private async exists(target: string) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async readText(filePath: string) {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}
