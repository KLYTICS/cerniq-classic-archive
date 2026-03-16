# CERNIQ Demo Script -- FirstBank PR Meeting

**Presenter:** Pablo
**Target:** FirstBank Puerto Rico (or PR financial institution)
**Duration:** 20 minutes
**URL:** https://app.cerniq.com/pablo (or localhost:3001/pablo for staging)

---

## Pre-Meeting Setup (5 min before)

1. Open browser to `https://app.cerniq.com/pablo?mode=sales`
2. Verify demo loads with Banco Comunidad PR preset ($1.2B)
3. Have PDF sample report ready as backup (downloads/sample-report-es.pdf)
4. Test bilingual toggle works (EN / ES)
5. If presenting to FirstBank specifically, use `https://app.cerniq.com/demo?preset=firstbank&mode=sales` for $12.8B asset size

---

## Act 1: The Problem (3 min)

**Opening line:** "Every quarter, your team spends 2-3 weeks building the ALM report that your board and COSSEC require. We built CERNIQ to turn that into 5 minutes."

**Talking points:**
- Regulatory pressure: COSSEC requires quarterly ALM reports for all PR cooperativas; OFI and FDIC require comparable analysis for banks
- Current process: Excel -> manual calculations -> Word formatting -> board review cycle
- Risk: Manual processes introduce errors in duration gap and NII sensitivity calculations
- Cost: 40-80 analyst hours per quarter x $75/hr = $3,000-$6,000 per report cycle
- For a $12.8B institution like FirstBank: the reporting burden scales with complexity, not asset size

**Pause for reaction.** Let the room acknowledge the pain before showing the solution.

---

## Act 2: Live Demo (10 min)

### Step 1: Institution Setup (2 min)
- Show the pre-filled institution profile
- Point out: asset size, institution type, regulatory framework (COSSEC/OFI)
- "Notice how the system already knows Puerto Rico's regulatory requirements"
- For FirstBank: "At $12.8B, you have more complex balance sheet positions -- CERNIQ handles the full spectrum"

### Step 2: Data Processing (1 min)
- Click through the 4-stage processing pipeline
- Highlight the progress: seeding -> calculations -> validation -> report generation
- "Your team's 3-week process compressed to under 60 seconds"
- Watch for the green checkmarks -- each represents a calculation engine completing

### Step 3: Results Dashboard (4 min)

Walk through each metric deliberately. Do not rush this section.

- **Duration Gap:** +1.8 years, asset-sensitive position
  - "This means in a rising rate environment, your assets reprice faster than liabilities -- positive for NII"
  - Ask: "What is your current duration gap target range?"

- **LCR:** 118.1% (above 100% regulatory minimum)
  - "Your liquidity position exceeds regulatory minimums -- we flag when it is getting close"
  - Ask: "Do you track LCR monthly or quarterly?"

- **NII Sensitivity:** -$1.2M at +200bps
  - "Under a 200 basis point shock, we estimate $1.2M impact -- this is the number your board needs"
  - For FirstBank context: scale to their actual NII base

- **Risk Score:** Show the color-coded risk badges
  - "Red/yellow/green at a glance -- no more reading 40 pages to find the answer"
  - Ask: "What keeps you up at night about your risk position?"

- **COSSEC Compliance:** 4/4 ratios passed
  - "All four compliance checkpoints pass -- this is what your regulator wants to see"

### Step 4: Report Generation (3 min)
- Generate the bilingual PDF (show both EN and ES versions)
- "Board gets English, COSSEC gets Spanish -- same data, both generated automatically"
- Highlight sections in the PDF:
  - Executive summary (first page -- the board only reads this)
  - Balance sheet snapshot (verifiable data)
  - Stress test results (the meat of the analysis)
  - Recommendations (actionable, not generic)
- "This is a board-ready document. Print it, present it, file it with regulators"

---

## Act 3: ROI & Pricing (5 min)

**Transition:** "Let me show you what this means financially."

### Cost Comparison

| Current Process | With CERNIQ |
|----------------|-------------|
| 40-80 analyst hours/quarter | < 1 hour/quarter |
| $3,000-$6,000/report | $750 pilot OR $299/mo |
| 2-3 week turnaround | Same-day delivery |
| English only (manual ES translation) | Bilingual automatically |
| Manual Excel (error-prone) | Automated + auditable |

### Pricing Options
1. **Pilot Report ($750):** One complete bilingual ALM report to evaluate
2. **Platform ($299/mo):** Unlimited quarterly reports + dashboard access
3. **Partner ($499/mo):** For advisory firms managing multiple institutions

### ROI Calculation
- Current cost: $6,000/quarter x 4 = $24,000/year
- CERNIQ cost: $299/mo x 12 = $3,588/year
- **Annual savings: $20,412 (85% reduction)**
- Plus: reduced error risk, faster board delivery, bilingual compliance

**For FirstBank specifically:**
- At their scale, internal ALM reporting likely costs $50,000-$100,000/year in analyst time
- Even at the Platform tier, ROI is 10x+

---

## Act 4: Close (2 min)

**Ask:** "Would you like to run the pilot with your actual data? We can have a board-ready report in 48 hours."

**Next steps to offer:**
1. Upload their actual balance sheet data (CSV format)
2. Generate a real report with their numbers
3. Present to their board as a side-by-side comparison
4. Convert to recurring if approved

**Leave-behind:** Email the bilingual PDF sample report

**Calendar:** "Can we block 30 minutes next week to review the pilot report together?"

---

## Objection Handling

| Objection | Response |
|-----------|----------|
| "We already have an ALM system" | "CERNIQ complements existing tools -- we are focused on the report generation bottleneck, not replacing your risk engine" |
| "Data security concerns" | "SOC 2 Type II roadmap, data encrypted at rest and in transit, US-hosted, PR-based company" |
| "Need IT approval" | "Upload is a simple CSV -- no integration required. We can start with a pilot using anonymized data" |
| "Price is too high" | "At $299/mo, you are paying less than 5 analyst hours. The pilot at $750 lets you evaluate before committing" |
| "COSSEC might not accept it" | "Our reports follow COSSEC format guidelines -- we can customize the output to match their exact requirements" |
| "We need to see it with our data" | "That is exactly what the $750 pilot is for. Real data, real report, real evaluation" |
| "Let me think about it" | "Absolutely. Can I send you the sample report in Spanish so you can share it with your team?" |

---

## Demo Environment Presets

| Preset URL | Institution | Assets | Best For |
|------------|------------|--------|----------|
| `/pablo` | Banco Comunidad PR | $1.2B | General bank demo |
| `/demo?preset=firstbank` | FirstBank Puerto Rico | $12.8B | FirstBank meeting |
| `/demo?preset=credit_union` | Cooperativa del Pueblo | $180M | Credit union pitch |
| `/demo?preset=cooperativa` | CoopAhorro San Juan | $250M | Cooperativa pitch |
| `/demo?preset=family_office` | Caribbean Family Capital | $45M | Family office pitch |

Add `&mode=sales` to any URL for the sales companion sidebar with talking points, flagging, and elapsed timer.

---

## Technical Notes

- Demo auto-registers a temporary user account -- no login required
- PDF generation requires the backend to be running (Node + Go services)
- If the backend is down, have the pre-generated PDF backup ready
- The sales mode sidebar is only visible to the presenter -- it does not appear in screen shares if you share only the main content area
- Timer starts when processing begins -- aim for demo completion under 60 seconds
