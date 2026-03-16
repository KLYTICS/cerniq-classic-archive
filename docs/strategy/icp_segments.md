# CERNIQ ICP Segments

## Confirmed From Code

### Primary ICP

- Puerto Rico cooperativas
- credit unions

Evidence:

- `frontend/app/page.tsx` headlines cooperativas and credit unions.
- `backend-node/src/alm/csv-ingestion.service.ts` includes Spanish header and subcategory aliases for cooperativas.
- `backend-node/src/alm/reports/reports.service.ts` conditionally renders COSSEC compliance for `cooperativa`.
- `backend-node/src/alm/dto/create-institution.dto.ts` explicitly allows `cooperativa` and `credit_union`.

### Secondary ICP

- community banks
- CPA / advisory firms

Evidence:

- `frontend/app/page.tsx` includes community banks and CPA/advisory firms in institution options.
- `frontend/lib/api.ts` normalizes demo-request institution types to `community_bank` and `cpa_consultant`.

## Inferred From Code Structure

- CPA and advisory firms are a plausible multiplier channel because the billing, portal, and repeat-report workflow can support partner-managed report delivery.
- Smaller institutions are the best-fit initial buyers because the current workflow is opinionated around CSV upload, fixed-format PDF delivery, and fast onboarding rather than deep enterprise implementation.

## Claimed Only By Strategy Docs Or Notes

- treasury departments
- risk consultants as a primary workflow
- broader institutional financial intelligence buyers

These segments are not yet supported by dedicated schemas, onboarding flows, or product-specific APIs in the repo.

## Missing Or Unverifiable

- evidence of live partner usage
- evidence of institution-specific onboarding variants beyond demo seeding
- evidence of buyer-specific packaging for treasury teams or consultants

## Recommended Operating Focus

- Primary: cooperativas in Puerto Rico
- Secondary: credit unions with similar reporting needs
- Channel test: CPA / advisory firms serving multiple institutions

Community banks can stay in the codebase as a supported type, but they should not drive messaging until the ALM workflow and regulatory mapping are tighter.
