# Export Acceptance Checklist

Date: 2026-04-08

## Contract

- [x] `GET /api/alm/:institutionId/exports` returns EN and ES `alm_report` manifests
- [x] `GET /api/alm/sample-report/:charterNumber/exports` returns EN and ES `sample_report` manifests
- [x] `GET /api/alm/previews/:slug/exports` returns EN and ES `preview_report` manifests
- [x] `GET /api/portal/jobs/:jobId/exports` returns report manifests and board-package manifests when the job is complete

## Rendering

- [x] ALM report PDF downloads with standardized filename and no watermark
- [x] Sample report PDF downloads with review watermark
- [x] Preview report PDF downloads with review watermark
- [x] ALCO pack downloads with standardized filename and headers

## Frontend

- [x] ALM dashboard uses manifest-driven downloads
- [x] Portal home uses manifest-driven downloads
- [x] Portal report viewer uses manifest-driven language selection and downloads
- [x] Portal progress completion state uses manifest-driven downloads
- [x] Demo embed uses manifest-driven downloads
- [x] Preview page uses manifest-driven downloads
- [x] Failed manifest loads surface a retryable user-visible error
- [x] Failed downloads surface a retryable user-visible error

## Regression

- [x] Existing binary endpoints still work
- [x] Existing sample-report POST endpoint still works
- [ ] Portal iframe report viewer still renders signed report URLs
- [x] Frontend build remains green
- [x] Backend typecheck/build remain green

## Future Follow-ups

- [ ] Normalize WebSocket completion payloads to manifest shape
- [ ] Bring prospect dossier sample downloads onto the same manifest contract
- [ ] Decide whether CSV/Excel/JSON exports should join a second-phase export standard
