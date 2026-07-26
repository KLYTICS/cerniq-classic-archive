import * as fs from 'fs';
import * as path from 'path';

export type GtmArtifactBundle = {
  runId: string;
  generatedAt: string;
  triggerSource: string;
  summary: Record<string, unknown>;
  playbook: Record<string, unknown>;
};

const DEFAULT_ARTIFACT_ROOT = path.resolve(__dirname, '../../../data/gtm-runs');

export function resolveGtmArtifactRoot(): string {
  return process.env.GTM_ARTIFACT_ROOT || DEFAULT_ARTIFACT_ROOT;
}

export function writeGtmArtifactBundle(bundle: GtmArtifactBundle): string {
  const root = resolveGtmArtifactRoot();
  const runDir = path.join(root, bundle.runId);
  fs.mkdirSync(runDir, { recursive: true });

  fs.writeFileSync(
    path.join(runDir, 'summary.json'),
    JSON.stringify(bundle.summary, null, 2),
    'utf8',
  );
  fs.writeFileSync(
    path.join(runDir, 'field-playbook.json'),
    JSON.stringify(bundle.playbook, null, 2),
    'utf8',
  );
  fs.writeFileSync(
    path.join(runDir, 'manifest.json'),
    JSON.stringify(
      {
        runId: bundle.runId,
        generatedAt: bundle.generatedAt,
        triggerSource: bundle.triggerSource,
        files: ['summary.json', 'field-playbook.json'],
      },
      null,
      2,
    ),
    'utf8',
  );

  const latestPath = path.join(root, 'latest.json');
  fs.writeFileSync(
    latestPath,
    JSON.stringify(
      {
        runId: bundle.runId,
        generatedAt: bundle.generatedAt,
        artifactPath: runDir,
      },
      null,
      2,
    ),
    'utf8',
  );

  return runDir;
}

export function readLatestGtmArtifactPointer(): {
  runId: string;
  generatedAt: string;
  artifactPath: string;
} | null {
  const latestPath = path.join(resolveGtmArtifactRoot(), 'latest.json');
  if (!fs.existsSync(latestPath)) return null;
  return JSON.parse(fs.readFileSync(latestPath, 'utf8')) as {
    runId: string;
    generatedAt: string;
    artifactPath: string;
  };
}
