# CERNIQ WAVE 03 PRODUCT BIBLE — Vol. 8
## From Product-Market-Fit to Scalable Revenue Machine

**Owner:** Erwin Kiess-Alfonso / KLYTICS LLC
**Volume:** 8 (Vol1=Agent Bible, Vol2=Engineering Bible, Vol3=Execution Bible, Vol4=Swarm Master Bible, Vol5=GTM War Room, Vol6=Quant Models, Vol7=Security+Compliance, Vol8=Wave 03 Product Bible)
**Last Updated:** 2026-04-16
**Timeline:** April 2026 → December 2026
**Classification:** Internal Only — DO NOT PUBLISH
**Supersedes:** All prior Wave 03 planning fragments, Notion cards, and terminal sticky notes

---

> **ONE SENTENCE:** Wave 03 transforms CERNIQ from a technically impressive ALM demo into an unstoppable revenue machine by closing the Wave 02 gaps, layering AI-native advisory intelligence, building CPA distribution infrastructure, and establishing the data moat that makes the platform defensible against any competitor who tries to enter Puerto Rico's 109-cooperativa market.

---

## TABLE OF CONTENTS

1. [Wave 03 North Star](#1-wave-03-north-star)
2. [Completing Wave 02 Gaps — April 2026](#2-completing-wave-02-gaps--april-2026)
3. [Wave 03 Epic Breakdown](#3-wave-03-epic-breakdown)
4. [Product Decisions and Trade-Offs](#4-product-decisions-and-trade-offs)
5. [Product Agent Swarm — 10 CLIs](#5-product-agent-swarm--10-clis)
6. [Feature Flag Strategy](#6-feature-flag-strategy)
7. [Product Metrics and North Star KPIs](#7-product-metrics-and-north-star-kpis)
8. [Appendix: Schema Additions Reference](#8-appendix-schema-additions-reference)

---

## 1. WAVE 03 NORTH STAR

### 1.1 The Bridge Problem

Wave 01 and Wave 02 proved the core thesis: cooperativas need ALM tooling, they will engage with a polished demo, and the bilingual board report lands with CFOs. The 62-module engine is real and differentiating. The demo converts.

Wave 02 shipped the infrastructure for revenue: Stripe billing, client portal, lead pipeline, 6-agent outbound sales swarm, and the ProspectInstitution + CooperativaBenchmark data layer. What Wave 02 did not finish — the COSSEC PDF parser, NCUA API integration, and sample report auto-generator — are not minor loose ends. They are the three components that convert outreach from generic fintech pitches into personalized regulatory intelligence. That personalization delta is worth 30–40 percentage points of demo-to-close conversion rate. Closing those gaps is the first act of Wave 03.

After the gap-closing sprint, Wave 03 has one job: build the product surface that justifies enterprise pricing, creates lock-in, and opens the CPA channel as a scalable distribution flywheel. Everything in this document flows from that sentence.

### 1.2 Timeline Overview

```
April 2026      May 2026        June 2026       Q3 2026         Q4 2026
│               │               │               │               │
├── Gap Sprint ─┤               │               │               │
│  COSSEC PDF   ├── W3-1 ──────►│               │               │
│  NCUA API     │  AI Advisor   │               │               │
│  Sample Rpts  ├── W3-2 ──────►│               │               │
│               │  CPA Platform │               │               │
│               ├── W3-3 ───────┼──────────────►│               │
│               │  NCUA 5300    │               │               │
│               │               ├── W3-4 ───────┼──────────────►│
│               │               │  Exam Prep    │               │
│               │               ├── W3-5 ───────┼──────────────►│
│               │               │  RT Dashboard │               │
│               │               │               ├── W3-6 ──────►│
│               │               │               │  Benchmarking │
│               │               │               ├── W3-7 ──────►│
│               │               │               │  Enterprise   │
│               │               │               │               │
▼               ▼               ▼               ▼               ▼
1 cooperativa   5 cooperativas  10 cooperativas 30+ coops       60+ coops
signed          signed          signed          $25K MRR        $83K MRR
```

**December 2026 Target: $83K MRR (~$1M ARR run rate)**

Basis:
- 60 cooperativas at $1,200/year average = $72K MRR equivalent / 12 = $6,000/month... 

Corrected model:
- 40 cooperativas at $199/month (Standard) = $7,960/month
- 12 cooperativas at $499/month (Professional) = $5,988/month  
- 4 CPA firms at $1,499/month (CPA White-Label, 5 clients each) = $5,996/month
- 3 Enterprise at $2,500/month = $7,500/month
- **Total: ~$27,444 MRR by Dec 2026 = $329K ARR**

This is the conservative model. The aggressive model (full CPA channel firing, NCUA expansion seeded) reaches $83K MRR. Both are in-scope for Wave 03 infrastructure; the revenue outcome depends on GTM execution tracked in Vol. 5.

### 1.3 Wave 03 OKRs

#### OKR-1: Close the Activation Gap

**Objective:** Every prospective cooperativa that receives an outbound email can see their own data before the first sales call.

**Key Results:**
- KR1.1: COSSEC PDF parser operational and ingesting data for 80+ of 109 cooperativas by April 30, 2026
- KR1.2: Sample report auto-generator produces pre-built personalized reports for all 109 ProspectInstitution records by May 7, 2026
- KR1.3: Outbound email personalization includes 3+ institution-specific data points (vs. current generic pitch) — measured by email click-through rate increasing from baseline to ≥18%

#### OKR-2: Launch AI-Native Differentiation

**Objective:** CERNIQ is the only ALM platform where a CFO can ask a natural language question and receive a bilingual, regulation-aware, board-ready answer in under 5 seconds.

**Key Results:**
- KR2.1: AI Advisor (W3-1) ships to 100% of paid subscribers by June 30, 2026
- KR2.2: Automated ALM narrative generation replaces ≥80% of manual commentary fields in board reports
- KR2.3: AI feature cited as primary purchase reason by ≥40% of new sign-ups in post-sale survey (Wave 03 cohort)

#### OKR-3: Build Scalable Distribution via CPA Channel

**Objective:** CPA firms become the dominant acquisition channel for cooperativa clients, with each CPA firm managing 5+ cooperativa relationships on CERNIQ.

**Key Results:**
- KR3.1: CPA White-Label platform (W3-2) in closed beta with 2 CPA firms by July 31, 2026
- KR3.2: 1 CPA firm converts to paid tier by September 30, 2026
- KR3.3: CPA-sourced cooperativa onboardings represent ≥30% of new cooperativa sign-ups in Q4 2026

### 1.4 FAANG-Style Product Principles Applied to CERNIQ

These are not inspiration posters. They are decision filters. When the team is debating a trade-off, run it through these five principles before committing.

**Principle 1 — Working Backwards from the CFO**
Every feature decision starts with one question: "Does this make the cooperativa CFO look smarter, faster, or more prepared in front of their board?" If the answer is no, the feature goes to the bottom of the backlog. CERNIQ is a CFO productivity tool wrapped in ALM compliance. Features that serve engineers, CPAs, or regulators are secondary unless they unlock CFO access.

**Principle 2 — Data Moat Before Revenue Moat**
The COSSEC PDF parser, CooperativaBenchmark table, and benchmarking epics are not nice-to-haves. They are the foundation of CERNIQ's long-term defensibility. The more cooperativa-specific data CERNIQ ingests and normalizes, the harder it becomes for a competitor to replicate the personalization layer. Prioritize data pipeline work even when it is invisible to end users.

**Principle 3 — Bilingual is a Feature, Not a Constraint**
Puerto Rico's financial regulatory environment operates in Spanish. Board minutes are in Spanish. COSSEC examiners speak Spanish. A CFO who receives an English-only ALM report is being asked to do translation work on top of financial analysis. Bilingual output is a product moat, not a localization checkbox. Every new feature ships in EN + ES simultaneously — never as a later sprint.

**Principle 4 — Incremental Complexity, Always Shippable**
Wave 03 contains 7 epics. None of them ships all-at-once. Each epic has a Week 1 shippable slice. The AI Advisor ships as a Q&A chatbot before it ships as automated narrative generation. The CPA platform ships as a multi-client view before it ships as white-labeled PDFs. This is not feature-gating for its own sake — it is the only way a 10-terminal team ships 7 epics in 9 months.

**Principle 5 — Metered Value, Not Feature Lists**
CERNIQ's pricing must be tied to measurable value delivered, not to feature bundles that prospects cannot evaluate. "You saved 12 hours of manual ALM analysis this month" is a retention argument. "You have access to 62 ALM modules" is a features list nobody reads. Wave 03 builds the instrumentation layer that makes value metering possible — time saved, reports generated, exam findings flagged, benchmarks checked.

---

## 2. COMPLETING WAVE 02 GAPS — APRIL 2026

These three items block the personalization layer. They are the highest-priority items in the entire document. Nothing in Wave 03 epics ships before these are closed.

### 2.1 COSSEC PDF Parser

**Problem Statement:**
COSSEC (Corporación para la Supervisión y Seguridad de Cooperativas de Puerto Rico) publishes public examination findings for each supervised cooperativa. These findings are currently trapped in PDFs. CERNIQ has 109 ProspectInstitution records with name and size data. What it lacks is the examination finding data that would let the outbound email say: "Your last COSSEC exam found 3 capital adequacy findings — here's how CERNIQ addresses each one specifically."

**Architecture:**

```
COSSEC Website (public)
        │
        ▼
┌─────────────────────────────┐
│  Python Microservice        │
│  cerniq-cossec-parser/      │
│                             │
│  scraper.py                 │
│  ├── requests + BeautifulSoup│
│  ├── PDF URL discovery       │
│  └── download queue         │
│                             │
│  parser.py                  │
│  ├── pdfplumber (primary)    │
│  ├── PyMuPDF (fallback)      │
│  └── regex extraction rules  │
│                             │
│  normalizer.py              │
│  ├── Finding categorization  │
│  ├── Severity scoring        │
│  └── JSON output             │
└─────────────────────────────┘
        │
        ▼ HTTP POST to NestJS ingest endpoint
┌─────────────────────────────┐
│  NestJS: CoossecIngestModule│
│  POST /admin/api/cossec/ingest
│                             │
│  Writes to:                 │
│  ├── CooperativaBenchmark   │
│  └── CossecExamFinding      │
└─────────────────────────────┘
```

**New Prisma Schema — CossecExamFinding table:**

```prisma
model CossecExamFinding {
  id                String   @id @default(cuid())
  cooperativaName   String
  cooperativaId     String?  // FK to ProspectInstitution if matched
  examYear          Int
  examQuarter       String?  // Q1/Q2/Q3/Q4
  findingCategory   String   // CAPITAL_ADEQUACY | LIQUIDITY | ALM | GOVERNANCE | LENDING | IT
  findingText       String
  severity          String   // HIGH | MEDIUM | LOW
  resolvedInNext    Boolean  @default(false)
  sourceUrl         String
  parsedAt          DateTime @default(now())
  rawPdfHash        String   // SHA-256 of source PDF for dedup

  prospectInstitution ProspectInstitution? @relation(fields: [cooperativaId], references: [id])

  @@index([cooperativaId])
  @@index([findingCategory, severity])
}
```

**Parser Implementation Sketch:**

```python
# parser.py
import pdfplumber
import re
from dataclasses import dataclass
from typing import List

FINDING_CATEGORIES = {
    'ALM': ['duración', 'sensibilidad', 'tasa de interés', 'duration', 'NII', 'EVE'],
    'CAPITAL_ADEQUACY': ['capital', 'patrimonio', 'PCA', 'net worth'],
    'LIQUIDITY': ['liquidez', 'LCR', 'NSFR', 'liquidity'],
    'GOVERNANCE': ['junta', 'directores', 'política', 'board', 'governance'],
    'LENDING': ['préstamos', 'morosidad', 'CECL', 'allowance', 'loans'],
}

SEVERITY_SIGNALS = {
    'HIGH': ['inmediata', 'crítico', 'immediate', 'critical', 'material'],
    'MEDIUM': ['moderado', 'recomendación', 'moderate', 'recommendation'],
    'LOW': ['menor', 'observación', 'minor', 'observation'],
}

@dataclass
class ParsedFinding:
    category: str
    finding_text: str
    severity: str
    page_number: int

def extract_findings(pdf_path: str) -> List[ParsedFinding]:
    findings = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            text = page.extract_text() or ''
            # Split on common COSSEC finding delimiters
            sections = re.split(r'(?:HALLAZGO|FINDING|OBSERVACIÓN)\s*\d+', text, flags=re.IGNORECASE)
            for section in sections[1:]:  # skip header
                category = _categorize(section)
                severity = _score_severity(section)
                findings.append(ParsedFinding(
                    category=category,
                    finding_text=section[:500].strip(),
                    severity=severity,
                    page_number=page_num + 1
                ))
    return findings

def _categorize(text: str) -> str:
    text_lower = text.lower()
    for category, signals in FINDING_CATEGORIES.items():
        if any(sig.lower() in text_lower for sig in signals):
            return category
    return 'OTHER'

def _score_severity(text: str) -> str:
    text_lower = text.lower()
    for severity, signals in SEVERITY_SIGNALS.items():
        if any(sig.lower() in text_lower for sig in signals):
            return severity
    return 'LOW'
```

**NestJS Ingest Controller:**

```typescript
// src/cossec/cossec-ingest.controller.ts
@Controller('admin/api/cossec')
@UseGuards(AdminGuard)
export class CossecIngestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prospectMatcher: ProspectMatcherService,
  ) {}

  @Post('ingest')
  async ingestFindings(@Body() dto: CossecIngestDto) {
    const { cooperativaName, examYear, findings, sourceUrl, rawPdfHash } = dto;

    // Dedup by PDF hash
    const existing = await this.prisma.cossecExamFinding.findFirst({
      where: { rawPdfHash },
    });
    if (existing) return { skipped: true, reason: 'duplicate_pdf' };

    // Fuzzy-match cooperativaName → ProspectInstitution
    const prospect = await this.prospectMatcher.findBestMatch(cooperativaName);

    const created = await this.prisma.$transaction(
      findings.map((f) =>
        this.prisma.cossecExamFinding.create({
          data: {
            cooperativaName,
            cooperativaId: prospect?.id ?? null,
            examYear,
            findingCategory: f.category,
            findingText: f.findingText,
            severity: f.severity,
            sourceUrl,
            rawPdfHash,
          },
        }),
      ),
    );

    return { ingested: created.length, prospectMatched: !!prospect };
  }

  @Get('summary/:prospectId')
  async getFindingsSummary(@Param('prospectId') prospectId: string) {
    const findings = await this.prisma.cossecExamFinding.findMany({
      where: { cooperativaId: prospectId },
      orderBy: [{ examYear: 'desc' }, { severity: 'asc' }],
    });

    return {
      totalFindings: findings.length,
      highSeverity: findings.filter((f) => f.severity === 'HIGH').length,
      byCategory: this.groupByCategory(findings),
      mostRecentExamYear: findings[0]?.examYear ?? null,
      almFindings: findings.filter((f) => f.findingCategory === 'ALM'),
    };
  }
}
```

**Outreach Personalization Integration:**

The existing `GET /admin/api/prospects/:id/outreach` endpoint gets upgraded to pull `CossecExamFinding` data and inject it into the bilingual outreach message:

```typescript
// Enriched outreach message snippet
const almFindings = await this.prisma.cossecExamFinding.findMany({
  where: { cooperativaId: prospect.id, findingCategory: 'ALM' },
  orderBy: { examYear: 'desc' },
  take: 3,
});

if (almFindings.length > 0) {
  const findingsSummaryEs = almFindings
    .map((f) => `• ${f.findingText.slice(0, 120)}...`)
    .join('\n');
  message += `\n\nEn su último examen COSSEC identificamos ${almFindings.length} hallazgos de ALM:\n${findingsSummaryEs}\n\nCERNIQ aborda cada uno de estos con módulos específicos.`;
}
```

**Deployment:** Python service runs as a Railway cron job, once weekly. Output POSTs to NestJS via internal Railway network. No external exposure needed.

---

### 2.2 NCUA API Integration

**Problem Statement:**
NCUA (National Credit Union Administration) exposes call report data via a public REST API at `https://www.ncua.gov/analysis/credit-union-corporate/call-report-data`. This is the entry point for US credit union expansion. The 109-cooperativa market is finite. FL, NY, and TX Hispanic-serving credit unions represent a 2,000+ institution expansion opportunity. The NCUA API integration is the technical unlock for that expansion.

**NCUA API Overview:**

The NCUA Call Report API returns quarterly 5300 data. Key endpoints:
- `GET /api/Credit/{charterNumber}` — institution profile
- `GET /api/Credit/{charterNumber}/CallReportData/{year}/{quarter}` — quarterly financials
- `GET /api/Credit/Search?name={name}&state={state}` — institution search

**Field Mapping — NCUA 5300 → CERNIQ ALM Schema:**

```typescript
// src/ncua/ncua-field-mapper.ts
export const NCUA_TO_CERNIQ_MAP: Record<string, string> = {
  // Balance Sheet
  'ACCT_010':  'totalAssets',
  'ACCT_018':  'totalLoans',
  'ACCT_025':  'investments',
  'ACCT_050':  'totalDeposits',
  'ACCT_056':  'shareAccounts',          // regular shares
  'ACCT_057':  'sharesDrafts',           // checking equivalents
  'ACCT_058':  'sharesCertificates',     // CDs / time deposits
  'ACCT_400':  'netWorth',
  'ACCT_930':  'totalBorrowings',

  // Income Statement
  'ACCT_115':  'interestIncome',
  'ACCT_130':  'interestExpense',
  'ACCT_650':  'netInterestIncome',

  // ALM-relevant ratios
  'ACCT_019A': 'fixedRateLoans',
  'ACCT_019B': 'variableRateLoans',
  'ACCT_035':  'firstMortgages',
  'ACCT_036':  'adjustableMortgages',

  // Liquidity
  'ACCT_009':  'cashAndEquivalents',
  'ACCT_020':  'linesOfCredit',

  // Capital
  'ACCT_940':  'riskBasedCapitalRatio',
  'ACCT_941':  'leverageRatio',
};
```

**NestJS NCUA Service:**

```typescript
// src/ncua/ncua.service.ts
@Injectable()
export class NcuaService {
  private readonly baseUrl = 'https://www.ncua.gov/api';

  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
    private readonly almEngine: AlmEngineService,
  ) {}

  async importCreditUnion(charterNumber: string): Promise<NcuaImportResult> {
    // 1. Fetch institution profile
    const profile = await this.httpService
      .get(`${this.baseUrl}/Credit/${charterNumber}`)
      .pipe(map((r) => r.data))
      .toPromise();

    // 2. Fetch most recent 4 quarters of call report data
    const quarters = await this.fetchRecentQuarters(charterNumber, 4);

    // 3. Map NCUA fields to CERNIQ ALM schema
    const mappedBalanceSheet = this.mapFields(quarters[0]);

    // 4. Create or update institution record
    const institution = await this.prisma.institution.upsert({
      where: { ncuaCharterNumber: charterNumber },
      create: {
        name: profile.CU_NAME,
        ncuaCharterNumber: charterNumber,
        state: profile.STATE,
        totalAssets: mappedBalanceSheet.totalAssets,
        regulatoryBody: 'NCUA',
        ...mappedBalanceSheet,
      },
      update: {
        totalAssets: mappedBalanceSheet.totalAssets,
        lastNcuaSyncAt: new Date(),
        ...mappedBalanceSheet,
      },
    });

    // 5. Seed ALM engine with mapped data
    const almResults = await this.almEngine.runFullSuite(institution.id);

    return {
      institutionId: institution.id,
      charterNumber,
      mappedFields: Object.keys(mappedBalanceSheet).length,
      almModulesRun: almResults.modulesCompleted,
    };
  }

  private mapFields(callReportData: Record<string, number>): Partial<InstitutionALMData> {
    const result: Record<string, number> = {};
    for (const [ncuaField, cerniqField] of Object.entries(NCUA_TO_CERNIQ_MAP)) {
      if (callReportData[ncuaField] !== undefined) {
        result[cerniqField] = callReportData[ncuaField];
      }
    }
    return result as Partial<InstitutionALMData>;
  }
}
```

**Schema addition — Institution model gets NCUA fields:**

```prisma
model Institution {
  // ... existing fields ...
  ncuaCharterNumber  String?  @unique
  regulatoryBody     String   @default("COSSEC") // COSSEC | NCUA | BOTH
  state              String?  // US state for NCUA institutions
  lastNcuaSyncAt     DateTime?
  ncuaDataSource     String?  // raw quarter string e.g. "2025Q4"
}
```

**GTM implication:** The NCUA integration enables a `/onboarding/credit-union` flow where a US credit union enters their charter number and CERNIQ auto-populates 40+ balance sheet fields from public NCUA data. First demo-ready in under 60 seconds with no manual data entry.

---

### 2.3 Sample Report Auto-Generator Pipeline

**Problem Statement:**
The ALM engine already exists. ProspectInstitution records already have seed balance sheet data. The gap is a batch pipeline that runs the ALM engine against all 109 prospects, generates PDFs, stores them in Supabase Storage, and attaches the report URL to each prospect record so outbound can link directly.

**Pipeline Architecture:**

```
┌──────────────────────────────────────────────────────┐
│  NestJS BatchReportModule                            │
│                                                      │
│  POST /admin/api/batch-reports/generate              │
│  ├── Auth: AdminGuard                                │
│  ├── Reads: ProspectInstitution (all 109)            │
│  ├── For each prospect:                              │
│  │   ├── Map prospect fields → ALM engine input      │
│  │   ├── Run ALM suite (async, Redis BullMQ queue)   │
│  │   ├── Generate bilingual PDF (existing PDF svc)   │
│  │   ├── Upload to Supabase Storage                  │
│  │   └── Update ProspectInstitution.sampleReportUrl  │
│  └── Returns: { queued: 109, estimatedCompletionMs } │
└──────────────────────────────────────────────────────┘
         │
         ▼ BullMQ Worker (separate Railway worker dyno)
┌──────────────────────────────────────────────────────┐
│  BatchReportWorker                                   │
│  ├── Processes 5 reports concurrently                │
│  ├── ALM engine runtime: ~2-4s per report            │
│  ├── PDF generation: ~1-2s per report                │
│  ├── Total: ~109 reports in ~2-3 minutes             │
└──────────────────────────────────────────────────────┘
```

**Implementation:**

```typescript
// src/batch-reports/batch-report.processor.ts
@Processor('batch-reports')
export class BatchReportProcessor {
  constructor(
    private readonly almEngine: AlmEngineService,
    private readonly pdfService: PdfReportService,
    private readonly supabase: SupabaseStorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Process({ concurrency: 5 })
  async processProspectReport(job: Job<{ prospectId: string }>) {
    const { prospectId } = job.data;

    const prospect = await this.prisma.prospectInstitution.findUniqueOrThrow({
      where: { id: prospectId },
    });

    // Map ProspectInstitution fields to ALM engine input schema
    const almInput = this.mapProspectToAlmInput(prospect);

    // Run full 62-module ALM suite
    const almResults = await this.almEngine.runFullSuite(almInput);

    // Generate bilingual PDF (EN + ES)
    const pdfBuffer = await this.pdfService.generateSampleReport({
      institution: prospect,
      almResults,
      lang: 'bilingual',
      watermark: 'SAMPLE — CERNIQ CONFIDENTIAL',
      isSample: true,
    });

    // Upload to Supabase Storage
    const fileName = `samples/${prospect.id}/report_${Date.now()}.pdf`;
    const publicUrl = await this.supabase.uploadBuffer(fileName, pdfBuffer, 'application/pdf');

    // Update prospect record with report URL
    await this.prisma.prospectInstitution.update({
      where: { id: prospectId },
      data: {
        sampleReportUrl: publicUrl,
        sampleReportGeneratedAt: new Date(),
      },
    });

    return { prospectId, reportUrl: publicUrl };
  }

  private mapProspectToAlmInput(prospect: ProspectInstitution): AlmEngineInput {
    return {
      totalAssets: prospect.totalAssets,
      totalLoans: prospect.totalLoans ?? prospect.totalAssets * 0.65,
      totalDeposits: prospect.totalDeposits ?? prospect.totalAssets * 0.78,
      netWorth: prospect.netWorth ?? prospect.totalAssets * 0.09,
      // ... all field mappings ...
      institutionName: prospect.name,
      regulatoryBody: 'COSSEC',
      runDate: new Date(),
      scenarioSet: 'STANDARD_5_SCENARIOS',
    };
  }
}
```

**ProspectInstitution schema additions:**

```prisma
model ProspectInstitution {
  // ... existing fields ...
  sampleReportUrl          String?
  sampleReportGeneratedAt  DateTime?
  cossecFindingsCount      Int      @default(0)
  cossecLastExamYear       Int?
  almRiskScore             Float?   // 0-100 from ALM suite run
  outreachPersonalized     Boolean  @default(false)
}
```

**Outreach integration:** Once all 109 reports are generated, the outbound email sequence includes a personalized link: `https://app.cerniq.com/demo/preview?token={signedJwt}` that opens the sample report in a read-only portal view. The JWT is signed with prospect ID, expires in 7 days, and triggers a `SAMPLE_REPORT_VIEWED` analytics event when opened — firing a Slack notification to the sales team.

---

## 3. WAVE 03 EPIC BREAKDOWN

### Epic W3-1: AI Advisor / Claude Integration

**Problem:** CFOs currently receive ALM numbers and must interpret them. The gap between a Duration Gap of -2.3 years and understanding "this means your NII falls $420K if rates rise 200bps" requires financial expertise most cooperativa CFOs lack. CERNIQ has the numbers. It needs the interpreter.

**Solution:** An AI Advisor layer that runs on top of the ALM engine output, delivering natural language Q&A, automated narrative generation, and proactive alert generation — in both English and Spanish.

**Model Strategy:**
- **Claude claude-sonnet-4-6** (primary): Narrative generation, board report commentary, bilingual translation, nuanced regulatory language. Claude's context handling makes it ideal for long-form financial narrative where nuance and regulatory accuracy matter.
- **GPT-4o** (structured analysis): JSON-structured sensitivity tables, quantitative comparisons, pattern detection across time-series ALM data.
- **Ollama (llama3.1:70b)** (local fallback): Privacy-sensitive clients, offline demo mode, cost optimization for high-volume narrative tasks.

**Architecture:**

```
User Question (NL)
       │
       ▼
┌─────────────────────────────────────────────┐
│  AIAdvisorService (NestJS)                  │
│                                             │
│  1. Resolve intent (Q&A vs narrative vs alert)│
│  2. Fetch ALM context from cache/DB         │
│  3. Build prompt (institution-specific)     │
│  4. Route to correct model                  │
│  5. Stream response to /ai-insights page    │
│  6. Store in ConversationHistory table      │
└─────────────────────────────────────────────┘
```

**Prompt Engineering — Bilingual Financial Commentary:**

```typescript
// src/ai-advisor/prompts/alm-narrative.prompt.ts
export function buildAlmNarrativePrompt(params: {
  institution: Institution;
  almResults: AlmResults;
  lang: 'es' | 'en' | 'bilingual';
  audience: 'board' | 'cfo' | 'examiner';
}): string {
  const { institution, almResults, lang, audience } = params;

  return `You are a senior ALM officer and financial analyst for ${institution.name}, a Puerto Rico cooperativa supervised by COSSEC.

INSTITUTION CONTEXT:
- Total Assets: $${(institution.totalAssets / 1e6).toFixed(1)}M
- Regulatory Capital Ratio: ${almResults.capitalRatio.toFixed(2)}%
- Duration Gap: ${almResults.durationGap.toFixed(2)} years
- NII Sensitivity (+200bps): ${almResults.niiSensitivity200Up.toFixed(1)}%
- LCR: ${almResults.lcr.toFixed(1)}%
- EVE Sensitivity (+200bps): ${almResults.eveSensitivity200Up.toFixed(1)}%

SECTOR BENCHMARKS (COSSEC Q4 2025):
- Median Duration Gap: ${almResults.sectorMedianDurationGap.toFixed(2)} years
- Median NII Sensitivity: ${almResults.sectorMedianNiiSensitivity.toFixed(1)}%
- Median LCR: ${almResults.sectorMedianLcr.toFixed(1)}%

AUDIENCE: ${audience === 'board' ? 'Board of Directors (non-technical)' : audience === 'cfo' ? 'CFO (technical)' : 'COSSEC Examiner'}
LANGUAGE: ${lang === 'bilingual' ? 'Write in Spanish first, then provide the English translation below a horizontal rule.' : lang === 'es' ? 'Respond entirely in Spanish.' : 'Respond in English.'}

Generate a professional ALM commentary narrative (3-5 paragraphs) that:
1. Opens with the institution's overall risk position vs. sector
2. Explains the most significant ALM metric deviations and their business implications
3. Identifies the top 2-3 risk management priorities
4. Closes with forward-looking recommendations
5. Uses precise regulatory terminology (COSSEC/NCUA standards)
6. Cites specific numbers from the data above
7. NEVER fabricates numbers not present in the data above

Do not use bullet points. Write in flowing prose appropriate for a board report.`;
}
```

**Q&A Intent Router:**

```typescript
// src/ai-advisor/intent-router.service.ts
export class IntentRouterService {
  async route(question: string, context: InstitutionContext): Promise<AdvisorResponse> {
    const intent = await this.classifyIntent(question);

    switch (intent.type) {
      case 'METRIC_EXPLANATION':
        return this.explainMetric(intent.metric, context);
      case 'TREND_ANALYSIS':
        return this.analyzeTrend(intent.metric, context);
      case 'SECTOR_COMPARISON':
        return this.compareSector(intent.metric, context);
      case 'EXAM_PREP':
        return this.prepareExamAnswer(intent.topic, context);
      case 'SCENARIO_WHAT_IF':
        return this.runWhatIfScenario(intent.scenario, context);
      default:
        return this.generalAlmAdvice(question, context);
    }
  }
}
```

**Success Metric:** AI Advisor used in ≥60% of active monthly sessions. Average time-in-page on /ai-insights ≥4 minutes.
**Engineering Estimate:** 3 weeks (1 week prompt engineering + integration, 1 week streaming UI, 1 week bilingual QA)
**Priority:** P0 — flagship Wave 03 differentiator

---

### Epic W3-2: CPA White-Label Platform

**Problem:** CPAs in Puerto Rico manage ALM compliance for 5-20 cooperativa clients each. They currently do this with Excel and PDF reports. CERNIQ has an opportunity to make CPAs the primary distribution channel if the platform supports multi-client management with white-labeled output.

**Solution:** A CPA-tier multi-tenant dashboard where one CPA login manages N cooperativa clients, generates white-labeled PDF reports under the CPA firm's branding, and supports bulk CSV ingestion for quarterly data uploads.

**Multi-Tenant Architecture:**

```prisma
model CpaFirm {
  id              String         @id @default(cuid())
  firmName        String
  licenseNumber   String?
  brandingLogoUrl String?
  brandingColor   String         @default("#1e3a5f")
  contactEmail    String         @unique
  stripeCustomerId String?
  tier            String         @default("CPA_STANDARD") // CPA_STANDARD | CPA_PRO
  createdAt       DateTime       @default(now())

  users           CpaFirmUser[]
  clients         CpaClientRelationship[]
  reports         GeneratedReport[]
}

model CpaClientRelationship {
  id            String      @id @default(cuid())
  cpaFirmId     String
  institutionId String
  addedAt       DateTime    @default(now())
  active        Boolean     @default(true)

  cpaFirm       CpaFirm     @relation(fields: [cpaFirmId], references: [id])
  institution   Institution @relation(fields: [institutionId], references: [id])

  @@unique([cpaFirmId, institutionId])
}
```

**CPA Dashboard API Shape:**

```typescript
// GET /api/v1/cpa/dashboard
interface CpaDashboardResponse {
  firm: {
    id: string;
    firmName: string;
    brandingLogoUrl: string;
    clientCount: number;
    activeReportsThisMonth: number;
  };
  clients: Array<{
    institutionId: string;
    institutionName: string;
    totalAssets: number;
    lastReportDate: string;
    almRiskScore: number;          // 0-100
    openExamFindings: number;
    nextReportDue: string;
    statusBadge: 'CURRENT' | 'DUE_SOON' | 'OVERDUE';
  }>;
  alerts: Array<{
    institutionId: string;
    alertType: string;
    message: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}
```

**Bulk CSV Ingestion:**

```typescript
// POST /api/v1/cpa/bulk-ingest
// Accepts multipart/form-data with CSV file
// CSV columns: institution_id, total_assets, total_loans, total_deposits,
//              net_worth, fixed_rate_loans, variable_rate_loans, ...

@Post('bulk-ingest')
@UseInterceptors(FileInterceptor('file'))
async bulkIngest(
  @UploadedFile() file: Express.Multer.File,
  @CurrentCpaFirm() firm: CpaFirm,
) {
  const rows = await this.csvParser.parse(file.buffer);
  const validationResult = await this.validateBulkRows(rows, firm.id);

  if (validationResult.errors.length > 0) {
    return { success: false, errors: validationResult.errors };
  }

  const jobs = await this.reportQueue.addBulk(
    validationResult.validRows.map((row) => ({
      name: 'generate-report',
      data: { institutionData: row, cpaFirmId: firm.id, whiteLabel: true },
    })),
  );

  return {
    success: true,
    queued: jobs.length,
    estimatedCompletionSeconds: jobs.length * 6,
  };
}
```

**White-Label PDF:** The existing `PdfReportService` gets a `whiteLabel` option that replaces the CERNIQ header/footer with the CPA firm's logo, colors, and contact information. The "Powered by CERNIQ" footer remains in small text (negotiable at Enterprise tier).

**Success Metric:** 2 CPA firms in paid tier by Q3 2026. Each CPA firm managing ≥5 cooperativa clients.
**Engineering Estimate:** 4 weeks
**Priority:** P0 — distribution channel unlock

---

### Epic W3-3: NCUA Form 5300 Automation

**Problem:** US credit unions file Form 5300 quarterly with NCUA. Each filing contains 900+ data fields. Onboarding a US credit union today requires manual data entry. This is a conversion killer for the US expansion.

**Solution:** Auto-parse Form 5300 from either the NCUA public API (for public data) or a user-uploaded XML/PDF export, map to CERNIQ ALM schema, and generate a compliance summary within 60 seconds.

**Form 5300 XML Parser:**

```typescript
// src/ncua/form5300-parser.service.ts
@Injectable()
export class Form5300ParserService {
  parseXml(xmlBuffer: Buffer): AlmEngineInput {
    const parsed = this.xmlParser.parse(xmlBuffer.toString());
    const callReport = parsed.CallReport;

    return {
      totalAssets: this.safeNumber(callReport['ACCT_010']),
      totalLoans: this.safeNumber(callReport['ACCT_018']),
      // ... complete field mapping from NCUA_TO_CERNIQ_MAP ...
      runDate: new Date(callReport.AS_OF_DATE),
      reportingPeriod: `${callReport.YEAR}Q${callReport.QUARTER}`,
    };
  }

  async onboardCreditUnionFromCharter(charterNumber: string): Promise<OnboardingResult> {
    const ncuaData = await this.ncuaService.fetchLatestCallReport(charterNumber);
    const almInput = this.mapNcuaToAlm(ncuaData);
    const institution = await this.createInstitutionRecord(almInput, ncuaData.profile);
    return { institutionId: institution.id, fieldsImported: Object.keys(almInput).length };
  }
}
```

**US Credit Union Onboarding Flow (new page: `/onboarding/credit-union`):**

1. Enter charter number → auto-populate institution name + state from NCUA API
2. Confirm institution details → one click
3. CERNIQ fetches 4 quarters of 5300 data → runs ALM suite
4. Sample report generated → user sees results in 60 seconds
5. Email capture → Stripe checkout for subscription

**Success Metric:** ≤5 minutes from charter number entry to first ALM report.
**Engineering Estimate:** 3 weeks
**Priority:** P1 — US expansion enabler

---

### Epic W3-4: Regulatory Exam Prep Suite

**Problem:** COSSEC examinations are the highest-stakes event in a cooperativa's year. Exam findings directly affect capital requirements and operating permissions. Cooperativas spend $10,000-50,000 per examination cycle with consultants preparing documentation. CERNIQ can automate 80% of that prep.

**Solution:** An exam readiness self-assessment that scores 12 common COSSEC finding categories, generates an exam readiness grade (A-F), and produces an evidence package with board minutes templates, ALM policy templates, and stress test documentation.

**Exam Readiness Score Algorithm:**

```typescript
// src/exam-prep/exam-readiness.service.ts
interface ExamCategory {
  id: string;
  nameEs: string;
  nameEn: string;
  weight: number; // 0-1, must sum to 1 across all categories
  checkFn: (institution: Institution, almResults: AlmResults) => ExamCategoryScore;
}

const EXAM_CATEGORIES: ExamCategory[] = [
  {
    id: 'ALM_POLICY',
    nameEs: 'Política de ALM documentada y aprobada por la junta',
    nameEn: 'ALM policy documented and board-approved',
    weight: 0.15,
    checkFn: (inst, alm) => ({
      score: inst.hasAlmPolicy ? 100 : 0,
      finding: inst.hasAlmPolicy ? null : 'ALM policy not found in system',
      remediation: 'Upload ALM policy document. CERNIQ template available.',
    }),
  },
  {
    id: 'DURATION_GAP_IN_POLICY',
    nameEs: 'Brecha de duración dentro de los límites de política',
    nameEn: 'Duration gap within policy limits',
    weight: 0.12,
    checkFn: (inst, alm) => {
      const limit = inst.durationGapPolicyLimit ?? 3.0;
      const gap = Math.abs(alm.durationGap);
      if (gap <= limit * 0.75) return { score: 100 };
      if (gap <= limit) return { score: 70, finding: 'Approaching policy limit' };
      return { score: 0, finding: `Duration gap ${gap.toFixed(2)}y exceeds policy limit ${limit}y` };
    },
  },
  // ... 10 more categories ...
];

letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

**Evidence Package Generator:**

The evidence package produces a ZIP file containing:
- `alm_policy_template.docx` — pre-populated with institution name, board approval placeholder, and CERNIQ-calculated limits
- `board_minutes_template.docx` — quarterly ALM discussion template with pre-filled metrics from last report
- `stress_test_documentation.pdf` — CERNIQ-generated stress test results formatted to COSSEC documentation standards
- `exam_readiness_summary.pdf` — bilingual A-F graded assessment with finding-by-finding remediation plan

**Success Metric:** Exam Prep Suite used by ≥50% of Professional-tier subscribers before their annual COSSEC exam.
**Engineering Estimate:** 5 weeks
**Priority:** P1 — retention + upsell driver

---

### Epic W3-5: Real-Time ALM Dashboard

**Problem:** The current ALM dashboard shows results from the last uploaded balance sheet. Market conditions change daily. SOFR moves. Treasury rates shift. A cooperativa CFO looking at stale sensitivity numbers is flying blind.

**Solution:** Live market data feeds integrated with the ALM engine, recalculating NII/EVE sensitivity in real time as rates change, with WebSocket delivery to the dashboard.

**Market Data Integrations:**

```typescript
// src/market-data/providers/
// live-rates.provider.ts — FRED API (Federal Reserve)
// sofr.provider.ts — SOFR from FRED series SOFR
// treasury.provider.ts — US Treasury API
// pr-deposit-index.provider.ts — COSSEC deposit rate index (scraped)

@Injectable()
export class LiveRatesAggregator {
  private cache: Map<string, RateDataPoint> = new Map();

  @Cron('*/5 * * * *') // every 5 minutes during market hours
  async refreshRates() {
    const [sofr, treasury, prDeposit] = await Promise.all([
      this.sofrProvider.fetch(),
      this.treasuryProvider.fetchCurve(),
      this.prDepositProvider.fetch(),
    ]);

    const snapshot: RateSnapshot = { sofr, treasury, prDeposit, fetchedAt: new Date() };
    await this.redis.set('live_rates', JSON.stringify(snapshot), 'EX', 600);

    // Emit to WebSocket clients subscribed to rate updates
    this.gateway.emitRateUpdate(snapshot);
  }
}
```

**WebSocket Gateway (extending existing Socket.IO integration):**

```typescript
// src/alm-realtime/alm-realtime.gateway.ts
@WebSocketGateway({ namespace: '/alm-live', cors: true })
export class AlmRealtimeGateway {
  @WebSocketServer() server: Server;

  async emitInstitutionUpdate(institutionId: string, newRates: RateSnapshot) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });
    const realtimeAlm = this.almEngine.recalculateSensitivity(institution, newRates);

    this.server.to(`institution:${institutionId}`).emit('alm:update', {
      niiSensitivity200Up: realtimeAlm.niiSensitivity200Up,
      eveSensitivity200Up: realtimeAlm.eveSensitivity200Up,
      durationGap: realtimeAlm.durationGap,
      ratesUsed: newRates,
      calculatedAt: new Date(),
      alerts: this.checkThresholds(realtimeAlm, institution.almPolicy),
    });
  }
}
```

**Alert Threshold Engine:**

```typescript
// src/alm-realtime/threshold-checker.service.ts
const DEFAULT_THRESHOLDS = {
  durationGap: { warn: 2.5, breach: 3.0 },      // years
  niiSensitivity200Up: { warn: -15, breach: -25 }, // percent
  eveSensitivity200Up: { warn: -20, breach: -35 }, // percent
  lcr: { warn: 110, breach: 100 },               // percent (lower is worse)
};
```

**Success Metric:** ≥40% of Professional-tier subscribers have the real-time dashboard as their homepage (measured by first-load page).
**Engineering Estimate:** 3 weeks
**Priority:** P1 — engagement + retention

---

### Epic W3-6: Benchmarking and Peer Comparison

**Problem:** A duration gap of -2.3 years means nothing in isolation. It means everything when you learn that the sector median is -1.1 years and you are in the bottom quartile. Benchmarking data turns ALM numbers into competitive intelligence.

**Solution:** Anonymous peer comparison using the CooperativaBenchmark table (already seeded with Q3 2025 COSSEC data) plus incoming data from COSSEC PDF parser. Sector quartile rankings, peer comparison charts, and a COSSEC examination findings heatmap by institution size.

**Benchmarking API:**

```typescript
// GET /api/v1/benchmarks/peer-comparison/:institutionId
interface PeerComparisonResponse {
  institution: { id: string; name: string };
  metrics: Array<{
    metricName: string;
    metricNameEs: string;
    institutionValue: number;
    sectorMedian: number;
    sectorP25: number;
    sectorP75: number;
    quartile: 1 | 2 | 3 | 4;
    trend: 'IMPROVING' | 'STABLE' | 'DETERIORATING';
    peerGroupSize: number;        // N institutions in peer group
    anonymized: true;             // always true — no individual peer names exposed
  }>;
  overallQuartile: number;
  examFindingsHeatmap: Array<{
    assetSizeBucket: string;      // e.g., "$50M-$100M"
    findingCategory: string;
    frequencyPct: number;         // % of institutions in bucket with this finding
  }>;
}
```

**Peer Group Definition:**

```typescript
// Peer group = institutions within 2x or 0.5x total asset size
function getPeerGroup(totalAssets: number) {
  const lower = totalAssets * 0.5;
  const upper = totalAssets * 2.0;
  return { lowerBound: lower, upperBound: upper };
}
```

**COSSEC Findings Heatmap:** Aggregate `CossecExamFinding` records by asset size bucket and finding category. Display as a heat map on `/risk-analytics` page. No individual institution is named — frequency percentages only. This is the most defensible use of the COSSEC data because it creates a public goods data product that benefits the entire PR cooperativa sector while being exclusive to CERNIQ subscribers.

**Success Metric:** Benchmarking page viewed in ≥70% of active monthly sessions.
**Engineering Estimate:** 2 weeks
**Priority:** P2 — engagement and perceived value

---

### Epic W3-7: Enterprise Tier and API Access

**Problem:** Larger cooperativas ($200M+ assets) and COSSEC-adjacent entities (league associations, consulting groups) need API access, bulk report generation, custom module configuration, and dedicated SLAs.

**Solution:** An Enterprise tier at $2,500/month that unlocks API-first access with webhook callbacks, bulk report generation, custom module configuration, and a dedicated SLA channel.

**Enterprise API Shape:**

```typescript
// POST /api/v1/enterprise/reports/bulk
interface BulkReportRequest {
  institutions: Array<{
    institutionId?: string;        // existing institution
    balanceSheet?: AlmEngineInput; // ad-hoc data
    reportConfig?: {
      modules: string[];           // subset of 62 modules
      outputFormats: ('PDF' | 'JSON' | 'XLSX')[];
      lang: 'en' | 'es' | 'bilingual';
    };
  }>;
  webhookUrl?: string;             // called on completion
  webhookSecret?: string;
  priority: 'NORMAL' | 'HIGH';
}

interface BulkReportResponse {
  batchId: string;
  queued: number;
  estimatedCompletionSeconds: number;
  statusUrl: string;               // GET /enterprise/reports/batch/:batchId/status
}
```

**Webhook Delivery:**

```typescript
// src/enterprise/webhook-delivery.service.ts
async deliverWebhook(batchId: string, webhookUrl: string, secret: string) {
  const results = await this.getCompletedBatchResults(batchId);
  const payload = { batchId, completedAt: new Date(), results };
  const signature = this.signPayload(JSON.stringify(payload), secret);

  await this.httpService.post(webhookUrl, payload, {
    headers: {
      'X-CERNIQ-Signature': signature,
      'X-CERNIQ-Batch-ID': batchId,
    },
  }).toPromise();
}
```

**Success Metric:** 3 Enterprise accounts by Q4 2026. Enterprise ARR ≥$90K (3 × $2,500 × 12).
**Engineering Estimate:** 3 weeks
**Priority:** P2 — ARR ceiling raiser

---

## 4. PRODUCT DECISIONS AND TRADE-OFFS

### 4.1 Build vs. Buy Matrix

| Component | Decision | Rationale |
|---|---|---|
| AI/LLM Layer | **Buy** (Claude + GPT-4o API) | Model training infeasible; API costs justifiable at target ARR |
| PDF Generation | **Build** (existing, extend) | COSSEC/NCUA regulatory format requires custom control |
| Auth | **Buy** (Supabase) | Already integrated; switching cost > build cost |
| Email | **Buy** (Resend) | Low volume; deliverability > cost; already integrated |
| Queue/Workers | **Build** (BullMQ on existing Redis) | Already present; sufficient for Wave 03 volume |
| Billing | **Buy** (Stripe) | Already integrated; Wave 03 adds CPA tiers only |
| Market Data (SOFR/Treasury) | **Buy** (FRED API, free) | FRED is authoritative and free; no build needed |
| Observability | **Buy** (Railway native + Sentry) | Instrument don't build at this stage |
| Mobile App | **Defer** | See Section 4.4 |
| Form 5300 parser | **Build** | NCUA XML format is public spec; no vendor solves PR cooperativa specificity |
| White-Label PDF | **Build** (extend existing) | CPA firm branding requires custom control |

### 4.2 Technical Debt Backlog (Prioritized)

These items are Wave 02 residue that compound if not addressed before Wave 03 epics land on top of them.

**TD-001 — Priority: CRITICAL**
The `AlmEngineService` has grown to 3,200 lines. Before W3-1 (AI Advisor) integrates with it, the module needs to be decomposed into a proper module pattern:
```
AlmEngineModule
├── DurationGapService
├── NiiSensitivityService
├── EveService
├── LiquidityService (LCR/NSFR)
├── CapitalService
└── AlmEngineOrchestrator (coordinates above)
```
Estimated effort: 3 days. Risk if deferred: AI Advisor prompt context will be bloated with unstructured ALM output.

**TD-002 — Priority: HIGH**
Redis session keys are not namespaced. All keys are flat strings. With W3-1 adding conversation history caching and W3-5 adding real-time rate caching, key collisions become a live risk.
Fix: Establish key schema `cerniq:{domain}:{id}:{field}` and migrate existing callers.

**TD-003 — Priority: HIGH**
The `ProspectInstitution` model and `CooperativaBenchmark` model have no foreign key relationship. The COSSEC PDF parser (Section 2.1) requires a clean linkage.
Fix: Add `cooperativaId` FK on `CossecExamFinding` with fuzzy-match resolution service.

**TD-004 — Priority: MEDIUM**
All PDF generation runs synchronously on the NestJS main thread. Under CPA bulk ingestion (W3-2), concurrent PDF generation will block the event loop.
Fix: Move PDF generation to BullMQ worker with dedicated Railway worker dyno. Wave 02 batch report processor design (Section 2.3) covers this pattern.

**TD-005 — Priority: MEDIUM**
The `/ai-insights` page makes direct OpenAI API calls from the NestJS service without response caching. Identical ALM Q&A questions for the same institution hit the API every time.
Fix: Cache AI responses in Redis with key `cerniq:ai:response:{institutionId}:{questionHash}` and 1-hour TTL.

### 4.3 Architecture Evolution: When to Split the Monolith

The current NestJS monolith is appropriate through Wave 03. Split readiness criteria:

**Do NOT split before:**
- 100 paying institutions (operational complexity exceeds team bandwidth before this)
- Any single module consistently consuming >40% of Railway dyno CPU

**Consider splitting when:**
- PDF generation worker is already on a separate dyno (this happens in TD-004 fix)
- AI inference latency from the main API is impacting P95 response time for non-AI endpoints
- NCUA API calls are blocking cooperativa-facing endpoints (separate NCUA sync worker)

**Wave 03 target state (still monolith, better structured):**
```
Railway Deployment:
├── api (NestJS main — all HTTP endpoints)
├── worker-reports (BullMQ — PDF generation, batch reports)
├── worker-ai (BullMQ — AI Advisor queued tasks)
└── cron-parser (Python — COSSEC scraper, rate fetcher)

Vercel Deployment:
└── web (Next.js 16 — all pages)
```

The Python COSSEC parser is the only true microservice in Wave 03. Everything else is still NestJS modules within the monolith.

### 4.4 Mobile App Decision

**Decision: No native mobile app in Wave 03.**

**Rationale:**
- The primary user (cooperativa CFO) accesses CERNIQ at their desk, before board meetings, or during COSSEC exam prep. None of these workflows are mobile-first.
- The `/portal` page is already responsive. Mobile access is supported via browser.
- The CPA workflow (bulk CSV upload, multi-client management) is inherently desktop.
- Native app development would consume 3-4 weeks of engineering that has higher ROI in W3-1 through W3-7 epics.

**Revisit when:** Mobile usage on portal pages exceeds 30% of sessions (currently estimated <10%).

**Wave 04 candidate:** Native iOS/Android PWA wrapper for board members who need read-only report access on tablets during meetings.

### 4.5 Internationalization Beyond PR

**FL, NY, TX Hispanic Credit Unions — Wave 03 Scope:**
- The NCUA API integration (Section 2.2 + W3-3) technically enables US credit union onboarding from any state.
- Wave 03 does NOT include a GTM push into FL/NY/TX. That is a Wave 04 GTM motion.
- What Wave 03 DOES build: the data infrastructure to make that push possible (NCUA field mapping, Form 5300 parser, US-specific regulatory language in AI prompts).

**Language considerations for US expansion:**
The bilingual EN/ES system already covers the largest Hispanic credit union communities. No additional language support needed for Wave 03 target markets.

---

## 5. PRODUCT AGENT SWARM — 10 CLIS

These are the master prompts for the Product Swarm (10 CLIs within the 100-CLI fleet). Each CLI runs in its own tmux window with dedicated context, owns a specific domain, and coordinates through git worktrees under OMX control.

---

### CLI P-01: Product-Strategist

```
ROLE: Product-Strategist for CERNIQ — Wave 03 Strategic Intelligence

IDENTITY: You are a senior product strategist with deep expertise in fintech, regulated financial services, and Latin American financial markets. You have studied every ALM platform on the market, every COSSEC regulation, and every NCUA guidance letter from the past 5 years. You are Erwin's strategic thinking partner, not a task executor.

PRIMARY RESPONSIBILITIES:
1. Long-horizon thinking: Where is CERNIQ in 2 years? What does the competitive moat look like? What regulatory shifts could make or break the product?
2. Market positioning: Frame every feature decision in terms of how it widens or protects CERNIQ's moat in the 109-cooperativa market
3. Competitive intelligence synthesis: When Competitive-Monitor surfaces new entrants, you analyze strategic implications and recommend responses
4. OKR health checks: Every two weeks, assess whether Wave 03 OKRs are tracking and flag early warning signals
5. Build-vs-buy arbitration: When the engineering swarm debates build vs. buy, you provide the strategic input (not the technical input)

CONTEXT TO ALWAYS MAINTAIN:
- CERNIQ's moat = bilingual regulatory intelligence + COSSEC-specific data + 62-module ALM depth
- Primary buyer = cooperativa CFO (non-technical, Spanish-speaking, COSSEC-anxious)
- Distribution unlock = CPA channel (Wave 03 goal)
- Revenue target = $1M ARR by end of Wave 03 (Dec 2026)

TOOLS: Read from /docs/. Write strategic memos to /docs/strategy/. Git commit with message "strategist: [memo-name]"

OUTPUT FORMAT: Strategic memos, not task lists. Prose thinking, not bullet points. Maximum 2 pages per memo.

NEVER: Execute engineering tasks. Never write code. Never modify product specs directly — write a recommendation memo and flag for Product-Specwriter.
```

---

### CLI P-02: UX-Researcher

```
ROLE: UX-Researcher for CERNIQ — User Behavior Intelligence

IDENTITY: You are a senior UX researcher specializing in fintech products for non-technical financial professionals. You understand the gap between what CFOs say they want and what their behavior reveals.

PRIMARY RESPONSIBILITIES:
1. Analyze session data from Railway/Vercel logs and PostHog events (when available) to identify engagement patterns and drop-off points
2. Synthesize support tickets, demo feedback, and sales call notes into actionable UX findings
3. Identify the highest-friction points in: onboarding, first report generation, AI Advisor Q&A, CPA dashboard
4. Write user story maps for each Wave 03 epic before engineering begins
5. Define usability success criteria for new features (task completion rate, time-on-task, error rate)

ANALYSIS FRAMEWORK:
- Activation: What stops a new user from generating their first report within 7 days?
- Engagement: Which pages generate return visits? Which generate single-visit exits?
- Expansion: What triggers a user to upgrade from free to paid, or from Standard to Professional?
- Churn signals: What behaviors precede subscription cancellation?

DATA SOURCES (query from logs and DB):
SELECT page, event_type, COUNT(*), AVG(session_duration_ms)
FROM analytics_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY page, event_type ORDER BY COUNT(*) DESC;

OUTPUT FORMAT: UX Findings Reports (saved to /docs/ux/). Each report: finding, evidence, severity, recommended action.

NEVER: Make architectural decisions. Never write copy without flagging for review. Never assume user intent — ground every claim in data.
```

---

### CLI P-03: Feature-Specwriter

```
ROLE: Feature-Specwriter for CERNIQ — Implementation Specification Authority

IDENTITY: You are a senior product manager who writes airtight engineering specifications. You translate product decisions into unambiguous NestJS + Next.js implementation specs that a junior engineer can execute without asking clarifying questions.

PRIMARY RESPONSIBILITIES:
1. Convert product decisions (from Product-Strategist memos and UX-Researcher findings) into engineering specs
2. Write API shapes (request/response DTOs, HTTP methods, auth requirements, error codes)
3. Write Prisma schema additions with indexes, relations, and migration notes
4. Write acceptance criteria in Given/When/Then format
5. Write feature flag configurations for each new feature
6. Review engineering PRs against the spec and flag deviations

SPEC FORMAT (mandatory for each feature):
---
Feature: [Name]
Epic: [W3-X]
Priority: [P0/P1/P2]
Engineering Estimate: [N weeks]
Feature Flag: [flag_name]

Problem: [1 paragraph]
Solution: [1 paragraph]

API Endpoints:
  [HTTP Method] [Path]
  Auth: [Guard type]
  Request Body: [TypeScript interface]
  Response: [TypeScript interface]
  Error Codes: [list]

Schema Changes:
  [Prisma model additions]

Acceptance Criteria:
  GIVEN [context]
  WHEN [action]
  THEN [expected result]

Dependencies: [list of other epics or Wave 02 items that must complete first]
---

TOOLS: Read /docs/. Write specs to /docs/product/specs/. Never write application code — only spec files.
```

---

### CLI P-04: Roadmap-Tracker

```
ROLE: Roadmap-Tracker for CERNIQ — Wave 03 Progress Intelligence

IDENTITY: You are a program manager who cares obsessively about shipping dates and never accepts "it's almost done" without evidence.

PRIMARY RESPONSIBILITIES:
1. Maintain the Wave 03 progress dashboard in /docs/WAVE_03_STATUS.md
2. Every Monday at 9am AST: query git log across all worktrees to assess which features have new commits
3. Flag features with no commits for 3+ days as AT_RISK
4. Flag features with no commits for 7+ days as BLOCKED — escalate immediately
5. Track the Wave 02 gap items (COSSEC parser, NCUA API, Sample Reports) as P0 until all three show green
6. Maintain the Wave 03 timeline chart (update the ASCII Gantt in Vol8 Section 1.2)
7. Generate weekly status emails to Erwin — concise, metric-driven, no fluff

STATUS FILE FORMAT:
## Wave 03 Status — [DATE]

### Wave 02 Gaps (must close before Wave 03 velocity matters)
| Item | Owner | Status | Last Commit | Est. Completion |
|------|-------|--------|-------------|-----------------|
| COSSEC PDF Parser | P-05 | IN_PROGRESS | 2026-04-15 | 2026-04-25 |
| NCUA API | P-05 | NOT_STARTED | — | 2026-04-30 |
| Sample Report Gen | P-05 | NOT_STARTED | — | 2026-05-07 |

### Wave 03 Epics
| Epic | Status | % Complete | Blocker |
...

ESCALATION RULE: Any P0 item blocked for 48h → Slack Erwin directly with: blocker, impact, proposed unblock.

NEVER: Make product decisions. Never modify specs. Track and report only.
```

---

### CLI P-05: Competitive-Monitor

```
ROLE: Competitive-Monitor for CERNIQ — Market Intelligence

IDENTITY: You are an intelligence analyst who tracks every ALM software vendor, Puerto Rico fintech entrant, regulatory change, and pricing shift that could affect CERNIQ's market position.

PRIMARY RESPONSIBILITIES:
1. Weekly scan of known competitors: Plansmith, ALM First, Darling Consulting, Empyrean Solutions, QRM, Vericast, Baker Hill
2. Weekly scan for new entrants: search "ALM software credit union 2026", "cooperativa software Puerto Rico"
3. Track COSSEC regulatory releases and NCUA Letter to Credit Unions for regulatory tailwinds/headwinds
4. Monitor pricing changes: any competitor changing pricing is a strategic signal
5. Write competitive briefs when a significant development is detected

COMPETITIVE LANDSCAPE SUMMARY (maintain and update):
- Plansmith / Empyrean: Enterprise-grade, $50K+ ACV, English-only, no PR-specific data. CERNIQ's price/performance moat is strong here.
- ALM First: Consultancy-led, not SaaS. Expensive. No self-serve. CERNIQ disrupts this.
- Baker Hill: Broader fintech platform, ALM as one module. Not specialized. Less deep.
- No known competitor has: COSSEC-specific data, bilingual PR-native output, cooperativa-specific benchmarking.

THREAT LEVELS:
- HIGH: Any PR-based fintech startup targeting cooperativas with ALM tooling
- MEDIUM: Any US ALM vendor announcing Spanish-language support
- LOW: Existing enterprise vendors (switching cost for their clients is too high to be near-term threat)

OUTPUT: Competitive briefs to /docs/competitive/. Flag HIGH threats to Product-Strategist immediately.
```

---

### CLI P-06: Data-Analyst

```
ROLE: Data-Analyst for CERNIQ — Product Intelligence via PostgreSQL

IDENTITY: You are a product data analyst who lives in SQL and translates query results into product decisions. You are the team's source of truth on user behavior, conversion funnel performance, and feature adoption.

PRIMARY RESPONSIBILITIES:
1. Weekly product metrics report (activation, engagement, retention, expansion)
2. Conversion funnel analysis: demo → lead → trial → paid → expansion
3. Feature adoption queries: which features are used, by how many institutions, how often
4. Cohort analysis: are institutions activated in April 2026 more retained than March 2026 cohort?
5. Revenue analytics: MRR by tier, churn by tier, expansion MRR from upsells
6. Ad-hoc queries as requested by Product-Strategist or UX-Researcher

STANDARD QUERY LIBRARY (maintain and expand):

-- Activation metric: institutions generating first report within 7 days of signup
SELECT
  DATE_TRUNC('week', u.created_at) AS cohort_week,
  COUNT(DISTINCT u.institution_id) AS signups,
  COUNT(DISTINCT CASE WHEN r.created_at <= u.created_at + INTERVAL '7 days' THEN r.institution_id END) AS activated,
  ROUND(COUNT(DISTINCT CASE WHEN r.created_at <= u.created_at + INTERVAL '7 days' THEN r.institution_id END)::numeric / COUNT(DISTINCT u.institution_id) * 100, 1) AS activation_rate
FROM users u
LEFT JOIN generated_reports r ON r.institution_id = u.institution_id
GROUP BY 1 ORDER BY 1 DESC LIMIT 12;

-- Feature adoption: AI Advisor usage by tier
SELECT
  s.tier,
  COUNT(DISTINCT ae.institution_id) AS institutions_used_ai,
  COUNT(*) AS total_ai_queries,
  ROUND(AVG(ae.response_time_ms)) AS avg_response_ms
FROM analytics_events ae
JOIN subscriptions s ON s.institution_id = ae.institution_id
WHERE ae.event_type = 'AI_ADVISOR_QUERY'
  AND ae.created_at > NOW() - INTERVAL '30 days'
GROUP BY s.tier;

OUTPUT: Weekly metrics report to /docs/analytics/weekly/. Flag anomalies (>20% week-over-week change in any metric) immediately to Product-Strategist.

NEVER: Write application code. Never modify database schema. Read-only access to production DB (use read replica).
```

---

## 6. FEATURE FLAG STRATEGY

### 6.1 Feature Flag System Design

CERNIQ uses a lightweight feature flag system backed by Redis. No third-party vendor is needed at current scale. The architecture:

```typescript
// src/feature-flags/feature-flags.service.ts
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly redis: Redis) {}

  async isEnabled(flagName: string, context: FlagContext): Promise<boolean> {
    const config = await this.getConfig(flagName);
    if (!config || !config.enabled) return false;

    // Global kill switch
    if (config.killSwitch) return false;

    // Percentage rollout (deterministic by institutionId)
    if (config.rolloutPercentage < 100) {
      const hash = this.deterministicHash(context.institutionId + flagName);
      return (hash % 100) < config.rolloutPercentage;
    }

    // Tier-gated flags
    if (config.allowedTiers?.length > 0) {
      return config.allowedTiers.includes(context.subscriptionTier);
    }

    // Explicit allow-list
    if (config.allowedInstitutions?.length > 0) {
      return config.allowedInstitutions.includes(context.institutionId);
    }

    return true;
  }

  private deterministicHash(seed: string): number {
    // FNV-1a hash, deterministic for same seed
    let hash = 2166136261;
    for (const char of seed) {
      hash ^= char.charCodeAt(0);
      hash = (hash * 16777619) >>> 0;
    }
    return hash;
  }
}
```

**Flag configuration stored in Redis as JSON:**

```typescript
interface FeatureFlagConfig {
  enabled: boolean;
  killSwitch: boolean;
  rolloutPercentage: number;           // 0-100
  allowedTiers?: SubscriptionTier[];
  allowedInstitutions?: string[];      // explicit allow-list for beta
  description: string;
  ownedBy: string;                     // epic identifier
  createdAt: string;
  lastModifiedAt: string;
}
```

### 6.2 Wave 03 Flag Registry

| Flag Name | Epic | Initial Rollout | Target Rollout | Kill Switch Owner |
|---|---|---|---|---|
| `w3_ai_advisor_qa` | W3-1 | 5% (beta) | 100% (Jun 30) | P-04 |
| `w3_ai_narrative_gen` | W3-1 | 0% | 100% (Jul 31) | P-04 |
| `w3_ai_alerts` | W3-1 | 10% | 100% (Jun 30) | P-04 |
| `w3_cpa_dashboard` | W3-2 | 0% (invite-only) | CPA_TIER only | P-04 |
| `w3_cpa_bulk_ingest` | W3-2 | 0% | CPA_TIER only | P-04 |
| `w3_white_label_pdf` | W3-2 | 0% | CPA_TIER only | P-04 |
| `w3_ncua_onboarding` | W3-3 | 0% | 100% (Aug 31) | P-04 |
| `w3_exam_prep_suite` | W3-4 | 0% | PROFESSIONAL+ | P-04 |
| `w3_evidence_package` | W3-4 | 0% | PROFESSIONAL+ | P-04 |
| `w3_realtime_dashboard` | W3-5 | 10% | PROFESSIONAL+ | P-04 |
| `w3_rate_alerts` | W3-5 | 10% | 100% (Sep 30) | P-04 |
| `w3_peer_benchmarks` | W3-6 | 20% | 100% (Oct 31) | P-04 |
| `w3_exam_heatmap` | W3-6 | 0% | 100% (Nov 30) | P-04 |
| `w3_enterprise_api` | W3-7 | 0% | ENTERPRISE only | P-04 |
| `w3_webhooks` | W3-7 | 0% | ENTERPRISE only | P-04 |

### 6.3 Kill Switch Protocol

Any P0 feature flag can be kill-switched without a deploy. The Roadmap-Tracker (P-04) has Redis write access for flag configurations. Procedure:

```bash
# Emergency kill switch — executed by P-04 or Erwin
redis-cli SET feature_flags:w3_ai_advisor_qa '{"enabled":true,"killSwitch":true,...}'
```

This takes effect within 60 seconds (Redis TTL for flag cache). No deployment required.

**Kill switch triggers:**
- P95 response time on flagged endpoint exceeds 10s
- Error rate on flagged feature exceeds 5% in a 5-minute window
- Any data integrity concern raised by engineering or compliance
- Railway dyno CPU exceeds 85% sustained for 10 minutes

---

## 7. PRODUCT METRICS AND NORTH STAR KPIS

### 7.1 North Star Metric

**Reports Generated Per Month (RGPM)**

This is the single number that captures activation (you must generate a report), engagement (you generate more reports), value delivery (each report has direct ROI for the CFO), and usage depth (more report types = more module penetration).

**RGPM Target Ladder:**
- April 2026: 15 RGPM (Wave 02 gap closures drive first paid clients)
- June 2026: 50 RGPM (W3-1 AI Advisor drives engagement)
- September 2026: 150 RGPM (CPA channel adds bulk generation)
- December 2026: 400 RGPM ($1M ARR territory)

### 7.2 Full Metrics Framework

**Activation — "Time to First Report"**
- Definition: Institution generates their first ALM report within 7 days of account creation
- Target: 60% activation rate (from current estimated 40%)
- Measurement: `analytics_events` WHERE event_type = 'REPORT_GENERATED' AND created_at <= (user.created_at + 7 days)
- Lever: Sample report auto-generator (Section 2.3) removes friction. Pre-loaded data means "run your first report" requires one click.
- Sub-metric: "Demo-to-Signup" rate — visitors to /demo who create an account within 14 days. Target: 12%.

**Engagement — "Reports Per Active Institution Per Month"**
- Definition: Average RGPM per institution that was active (logged in) at least once that month
- Target Wave 03 end: 6 reports/institution/month (quarterly ALM is 4 base; additional = engagement)
- Measurement: Monthly cohort analysis via Data-Analyst CLI
- Lever: AI Advisor Q&A creates return visits independent of report generation cadence. Real-time dashboard creates daily engagement.

**Retention — "Monthly Active Institution Rate"**
- Definition: Percentage of subscribed institutions that generate ≥1 report in a given month
- Target: 85% monthly retention by December 2026
- Measurement: Count(distinct institution_id with ≥1 report in month) / Count(paid subscriptions)
- Benchmark: SaaS median for B2B fintech compliance tools is 75-80%. 85% is achievable with exam prep lock-in.
- Churn signals (flag for intervention): No login for 21 days, no report in 45 days, support ticket with "too complicated" language

**Expansion — "Upgrade Rate from Report-Only to Subscription"**
- Definition: Percentage of institutions that start on per-report pricing and convert to a subscription tier within 90 days
- Target: 30% conversion within 90 days
- Measurement: `subscriptions` table, tracking tier changes
- Lever: The report-only model is gated at 3 free sample reports (Wave 03: add hard limit + upgrade prompt). CTA: "You've generated 3 reports. Unlock unlimited reports + AI Advisor + exam prep for $199/month."

**Net Promoter Score (NPS)**
- Survey cadence: In-product NPS survey after 3rd report generated (proven engagement indicator)
- Target: NPS ≥ 45 by December 2026 (good for B2B fintech; >50 is exceptional)
- Channels: In-app modal (Typeform embed) + follow-up email at 90 days
- Bilingual: NPS survey in Spanish by default for PR cooperativas
- Qualitative: Free-text field "What would you tell a peer CFO about CERNIQ?" — these become testimonials

**Revenue Metrics (tracked weekly by Data-Analyst CLI):**
- MRR (total, by tier)
- New MRR (from new subscriptions)
- Expansion MRR (from upgrades)
- Churned MRR (from cancellations and downgrades)
- Net Revenue Retention (NRR) — target ≥110% by Wave 03 end

### 7.3 Metric Collection Infrastructure

**Analytics events table (already exists — extend with Wave 03 events):**

```sql
-- New event types for Wave 03 instrumentation
INSERT INTO event_type_registry (event_type, description, epic) VALUES
  ('AI_ADVISOR_QUERY',         'User submits question to AI Advisor',              'W3-1'),
  ('AI_NARRATIVE_GENERATED',   'AI narrative auto-generated for report',            'W3-1'),
  ('AI_ALERT_TRIGGERED',       'Rate/risk alert generated by AI system',           'W3-1'),
  ('CPA_CLIENT_ADDED',         'CPA firm adds new cooperativa client',              'W3-2'),
  ('BULK_INGEST_STARTED',      'CPA initiates bulk CSV upload',                    'W3-2'),
  ('BULK_INGEST_COMPLETED',    'Bulk CSV processing completed',                    'W3-2'),
  ('NCUA_IMPORT_STARTED',      'Credit union charter import initiated',             'W3-3'),
  ('NCUA_IMPORT_COMPLETED',    'NCUA data mapped and ALM run completed',            'W3-3'),
  ('EXAM_SCORE_VIEWED',        'Institution views exam readiness score',            'W3-4'),
  ('EVIDENCE_PACKAGE_DOWNLOADED', 'Evidence package ZIP downloaded',              'W3-4'),
  ('REALTIME_DASHBOARD_OPENED','Institution opens real-time ALM dashboard',         'W3-5'),
  ('RATE_ALERT_ACKNOWLEDGED',  'CFO acknowledges a real-time rate alert',           'W3-5'),
  ('PEER_COMPARISON_VIEWED',   'Benchmarking page loaded with peer data',           'W3-6'),
  ('ENTERPRISE_API_CALL',      'Enterprise API endpoint called',                   'W3-7'),
  ('WEBHOOK_DELIVERED',        'Enterprise webhook successfully delivered',          'W3-7'),
  ('SAMPLE_REPORT_LINK_OPENED','Prospect opens personalized sample report link',   'GAP'),
  ('NPS_SURVEY_SUBMITTED',     'NPS survey response recorded',                     'PLATFORM');
```

---

## 8. APPENDIX: SCHEMA ADDITIONS REFERENCE

Complete list of Prisma model additions and modifications for Wave 03. All additions require migrations — coordinate with DevOps Swarm (Vol. 4 Section E) before deployment.

```prisma
// Wave 03 Complete Schema Additions

model CossecExamFinding {
  id                  String    @id @default(cuid())
  cooperativaName     String
  cooperativaId       String?
  examYear            Int
  examQuarter         String?
  findingCategory     String
  findingText         String
  severity            String
  resolvedInNext      Boolean   @default(false)
  sourceUrl           String
  parsedAt            DateTime  @default(now())
  rawPdfHash          String

  prospectInstitution ProspectInstitution? @relation(fields: [cooperativaId], references: [id])
  @@index([cooperativaId])
  @@index([findingCategory, severity])
}

model CpaFirm {
  id               String                  @id @default(cuid())
  firmName         String
  licenseNumber    String?
  brandingLogoUrl  String?
  brandingColor    String                  @default("#1e3a5f")
  contactEmail     String                  @unique
  stripeCustomerId String?
  tier             String                  @default("CPA_STANDARD")
  createdAt        DateTime                @default(now())
  users            CpaFirmUser[]
  clients          CpaClientRelationship[]
  reports          GeneratedReport[]
}

model CpaFirmUser {
  id          String   @id @default(cuid())
  cpaFirmId   String
  userId      String
  role        String   @default("ANALYST") // ADMIN | ANALYST | READ_ONLY
  addedAt     DateTime @default(now())
  cpaFirm     CpaFirm  @relation(fields: [cpaFirmId], references: [id])
}

model CpaClientRelationship {
  id            String      @id @default(cuid())
  cpaFirmId     String
  institutionId String
  addedAt       DateTime    @default(now())
  active        Boolean     @default(true)
  cpaFirm       CpaFirm     @relation(fields: [cpaFirmId], references: [id])
  institution   Institution @relation(fields: [institutionId], references: [id])
  @@unique([cpaFirmId, institutionId])
}

model AiConversation {
  id            String         @id @default(cuid())
  institutionId String
  sessionId     String
  createdAt     DateTime       @default(now())
  messages      AiMessage[]
  institution   Institution    @relation(fields: [institutionId], references: [id])
  @@index([institutionId, createdAt])
}

model AiMessage {
  id               String         @id @default(cuid())
  conversationId   String
  role             String         // user | assistant
  content          String
  modelUsed        String?        // claude-claude-sonnet-4-6 | gpt-4o | llama3.1:70b
  responseTimeMs   Int?
  tokensUsed       Int?
  createdAt        DateTime       @default(now())
  conversation     AiConversation @relation(fields: [conversationId], references: [id])
}

model ExamReadinessScore {
  id               String      @id @default(cuid())
  institutionId    String
  overallScore     Float
  letterGrade      String
  categoryScores   Json        // Record<string, CategoryScore>
  generatedAt      DateTime    @default(now())
  almSnapshotId    String?
  institution      Institution @relation(fields: [institutionId], references: [id])
  @@index([institutionId, generatedAt])
}

model EnterpriseApiKey {
  id            String      @id @default(cuid())
  institutionId String
  keyHash       String      @unique
  label         String
  scopes        String[]    // READ_REPORTS | WRITE_DATA | BULK_GENERATE | WEBHOOKS
  lastUsedAt    DateTime?
  createdAt     DateTime    @default(now())
  revokedAt     DateTime?
  institution   Institution @relation(fields: [institutionId], references: [id])
}

model WebhookEndpoint {
  id             String      @id @default(cuid())
  institutionId  String
  url            String
  secret         String
  events         String[]    // REPORT_COMPLETED | BATCH_COMPLETED | ALERT_TRIGGERED
  active         Boolean     @default(true)
  createdAt      DateTime    @default(now())
  lastDeliveredAt DateTime?
  failureCount   Int         @default(0)
  institution    Institution @relation(fields: [institutionId], references: [id])
}

// Additions to existing models:
// Institution: + ncuaCharterNumber, regulatoryBody, state, lastNcuaSyncAt
// ProspectInstitution: + sampleReportUrl, sampleReportGeneratedAt, cossecFindingsCount, almRiskScore
// GeneratedReport: + cpaFirmId, whiteLabel, watermark, generatedBy (AI | MANUAL | BATCH)
// Subscription: + cpaFirmId (nullable — for CPA-managed subscriptions)
```

---

## WAVE 03 LAUNCH CHECKLIST

Before any Wave 03 epic ships to 100% rollout, all items below must be checked:

- [ ] Feature flag configured in Redis with correct initial rollout percentage
- [ ] Prisma migration applied and verified on Railway staging
- [ ] Bilingual copy reviewed by native Spanish speaker
- [ ] Analytics events instrumented and verified in staging
- [ ] Stripe billing updated if new tier or pricing is involved
- [ ] AI prompts reviewed for regulatory accuracy by ALM Swarm (Vol. 4 Section C)
- [ ] Performance test: P95 response time under 2x current load
- [ ] Kill switch tested: flag disabled in Redis → feature disappears within 60s
- [ ] Data-Analyst CLI has queries for the new feature's metrics
- [ ] Roadmap-Tracker STATUS file updated with launch date and success metrics

---

*CERNIQ Vol. 8 — Wave 03 Product Bible*
*Owner: Erwin Kiess-Alfonso / KLYTICS LLC*
*Classification: Internal Only*
*Next Review: May 1, 2026 (after Wave 02 gap sprint completion)*
*Superseded by: Vol. 9 (Wave 04 Product Bible) — expected Q1 2027*
