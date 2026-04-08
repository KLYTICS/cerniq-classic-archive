'use client';

import { fetchWithAppAuth } from './auth-fetch';
import { unwrapApiData } from './api-response';

export type DocumentExportKind =
  | 'alm_report'
  | 'sample_report'
  | 'alco_pack'
  | 'preview_report';

export interface DocumentExportManifest {
  id: string;
  kind: DocumentExportKind;
  language: 'en' | 'es';
  audience: 'internal' | 'external' | 'sample';
  filename: string;
  mimeType: string;
  status: 'ready' | 'processing' | 'failed' | 'unavailable';
  downloadUrl: string | null;
  generatedAt: string | null;
  expiresAt: string | null;
  watermark: string | null;
  sourceInstitutionId: string | null;
  sourceJobId: string | null;
}

function getDownloadFilename(
  manifest: DocumentExportManifest,
  disposition: string | null,
): string {
  const match = disposition?.match(/filename="?([^"]+)"?/);
  return match?.[1] || manifest.filename;
}

export async function fetchDocumentExports(
  manifestPath: string,
): Promise<DocumentExportManifest[]> {
  const response = await fetchWithAppAuth(manifestPath, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Unable to load exports (${response.status})`);
  }

  const payload = unwrapApiData<unknown>(await response.json());
  if (!Array.isArray(payload)) {
    throw new Error('Invalid export manifest payload');
  }

  return payload as DocumentExportManifest[];
}

export async function downloadDocumentExport(
  manifest: DocumentExportManifest,
): Promise<void> {
  if (!manifest.downloadUrl) {
    throw new Error('Document is not available for download yet');
  }

  const response = await fetchWithAppAuth(manifest.downloadUrl);

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getDownloadFilename(
    manifest,
    response.headers.get('content-disposition'),
  );
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function labelForDocumentKind(
  kind: DocumentExportKind,
  locale: 'en' | 'es',
): string {
  const isEs = locale === 'es';
  switch (kind) {
    case 'alm_report':
      return isEs ? 'Descargar informe' : 'Download report';
    case 'sample_report':
      return isEs ? 'Documento de muestra' : 'Sample document';
    case 'alco_pack':
      return isEs ? 'Paquete de junta' : 'Board package';
    case 'preview_report':
      return isEs ? 'Documento de vista previa' : 'Preview document';
    default:
      return isEs ? 'Descargar documento' : 'Download document';
  }
}

export function groupLanguages(
  manifests: DocumentExportManifest[],
): Array<'en' | 'es'> {
  return Array.from(
    new Set(manifests.map((manifest) => manifest.language)),
  ).sort() as Array<'en' | 'es'>;
}
