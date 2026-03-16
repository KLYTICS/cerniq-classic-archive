# CERNIQ Problem Map

## Confirmed From Code

### Problems CERNIQ Already Tries To Solve

- manual balance-sheet ingestion
- slow ALM calculations
- need for bilingual report delivery
- need for downloadable board-style PDF output
- institution setup and repeat report generation
- cooperativa-oriented compliance review

Evidence:

- `backend-node/src/alm/csv-ingestion.service.ts` validates messy CSV inputs and bilingual field names.
- `backend-node/src/alm/alm.service.ts` computes duration gap, NII, EVE, LCR, and BPV.
- `backend-node/src/alm/reports/reports.service.ts` generates bilingual PDFs.
- `backend-node/src/portal/portal.controller.ts` and `backend-node/src/pipeline/pipeline.worker.ts` support recurring report workflows.
- `backend-node/src/alm/alm-enterprise.service.ts` produces COSSEC compliance outputs.

## Inferred From Code Structure

### Mandatory Pains CERNIQ Can Credibly Address

- institutions relying on spreadsheets and consultant-heavy ALM reporting cycles
- management teams needing a faster upload-to-report workflow
- institutions that need Spanish and English communication across operations and leadership
- teams that need a repeatable report artifact, not just a dashboard

## Claimed Only By Docs Or Strategy Notes

- enterprise-wide financial intelligence
- deep regulatory mapping across COSSEC, NCUA, and Basel
- programmable institutional risk infrastructure beyond the current ALM/report workflow
- consultant-grade API integration as a first-class product surface

## Missing Or Unverifiable

- evidence of production-grade data lineage and audit trails
- evidence of model validation against external institutional benchmarks
- evidence of board, committee, or regulator adoption
- evidence of historical scenario libraries or yield-curve datasets

## Recommended Problem Statement

CERNIQ should currently be framed around one mandatory problem:

Institutions and their advisors need a faster, more defensible way to turn balance-sheet data into bilingual ALM risk reports without depending on fragmented spreadsheets and slow manual consulting cycles.
