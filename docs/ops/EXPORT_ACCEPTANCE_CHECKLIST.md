# Export Acceptance Checklist

Date: 2026-04-06

## Contract

- [ ] `GET /api/alm/:institutionId/exports` returns EN and ES `alm_report` manifests
- [ ] `GET /api/alm/sample-report/:charterNumber/exports` returns EN and ES `sample_report` manifests
- [ ] `GET /api/alm/previews/:slug/exports` returns EN and ES `preview_report` manifests
- [ ] `GET /api/portal/jobs/:jobId/exports` returns report manifests and board-package manifests when the job is complete

## Rendering

- [ ] ALM report PDF downloads with standardized filename and no watermark
- [ ] Sample report PDF downloads with review watermark
- [ ] Preview report PDF downloads with review watermark
- [ ] ALCO pack downloads with standardized filename and headers

## Frontend

- [ ] ALM dashboard uses manifest-driven downloads
- [ ] Portal home uses manifest-driven downloads
- [ ] Portal report viewer uses manifest-driven language selection and downloads
- [ ] Portal progress completion state uses manifest-driven downloads
- [ ] Demo embed uses manifest-driven downloads
- [ ] Preview page uses manifest-driven downloads
- [ ] Failed manifest loads surface a retryable user-visible error
- [ ] Failed downloads surface a retryable user-visible error

## Regression

- [ ] Existing binary endpoints still work
- [ ] Existing sample-report POST endpoint still works
- [ ] Portal iframe report viewer still renders signed report URLs
- [ ] Frontend build remains green
- [ ] Backend typecheck/build remain green

## Future Follow-ups

- [ ] Normalize WebSocket completion payloads to manifest shape
- [ ] Bring prospect dossier sample downloads onto the same manifest contract
- [ ] Decide whether CSV/Excel/JSON exports should join a second-phase export standard
