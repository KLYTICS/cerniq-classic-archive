# Export Acceptance Checklist

Date: 2026-04-06

## Contract

- [ ] `GET /api/alm/:institutionId/exports` returns EN and ES `alm_report` manifests
- [ ] `GET /api/alm/sample-report/:charterNumber/exports` returns EN and ES `sample_report` manifests
- [ ] `GET /api/alm/previews/:slug/exports` returns EN and ES `preview_report` manifests
- [ ] `GET /api/portal/jobs/:jobId/exports` returns report manifests and board-package manifests when the job is complete
- [ ] `GET /admin/api/prospects/:id/dossier/sample-report/exports` returns EN and ES `sample_report` manifests

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
- [ ] Admin prospect dossier uses manifest-driven sample-report downloads
- [ ] Failed manifest loads surface a retryable user-visible error
- [ ] Failed downloads surface a retryable user-visible error

## Regression

- [ ] Existing binary endpoints still work
- [ ] Existing sample-report POST endpoint still works
- [ ] Portal iframe report viewer still renders signed report URLs
- [ ] Portal WebSocket completion payload exposes manifest path metadata
- [ ] Control tower surfaces export/report domain health
- [ ] Frontend build remains green
- [ ] Backend typecheck/build remain green

## Future Follow-ups

- [ ] Decide whether CSV/Excel/JSON exports should join a second-phase export standard
