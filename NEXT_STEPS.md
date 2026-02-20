# NEXT STEPS - SpendCheck Execution Plan

## IMMEDIATE ACTION (Today - Next 48 Hours)

### ✅ Decision Made: **Spend Leak Analyzer for Mid-Market CFOs**

**Why this beats the portfolio tool:**
- Higher buyer (CFO vs student)
- Real money (recovered spend vs interview prep)
- Measurable ROI ($50K-$500K found)
- Fast implementation (uploads, not integrations)
- Lower competition (niche problem)

---

## STEP 1: Customer Development (Start NOW)

### Today (2 hours)

**LinkedIn Outreach (Send 10 messages):**

Target search:
```
Title: CFO OR "VP Finance" OR Controller OR "Head of Procurement"
Company size: 201-2000 employees
Industry: SaaS, Tech, Professional Services
Connection: 2nd degree (for warm intros)
```

**Message Template:**
```
Hi [Name],

Quick question: When was the last time you caught a duplicate vendor payment or billing error? How did you find it?

I'm researching how finance teams handle vendor audits. Would love 10 minutes this week if you're open to sharing your process.

Thanks,
[Your Name]
```

**Send to 10 people today.**

### Tomorrow (Book Calls)

**Goal:** Book 5-10 interviews over next 7 days

**Interview script highlights:**
- "Tell me about your last billing error incident"
- "How much was it? Did you recover it?"
- "What tools do you use for vendor audits?"
- "If I could find $X in leaks in 2 weeks from uploads only, would you try it?"

**Success criteria:**
- ✅ 3+ people say "yes, I'd try it"
- ✅ 2+ people would pay $2K+ for pilot
- ✅ Consistent pain (duplicates, renewals, zombie subs mentioned)

---

## STEP 2: Build (If Validation = GO)

### Week 1-2: MVP Build

**Core Features to Build:**

1. **Auth** ✅ (Already have this)
2. **File Upload** 
   - CSV parser for AP exports
   - PDF parser for contracts
   - Vendor name normalization (fuzzy matching)

3. **Leak Detectors**
   - Duplicate payment detector
   - Auto-renew risk detector  
   - Price drift detector

4. **Leak Report Generator**
   - Formatted text report
   - JSON export
   - Copy to clipboard
   - PDF download

5. **Landing Page + Waitlist**
   - Clear headline + value prop
   - Waitlist form (email, role, company size, top pain)
   - Testimonial placeholder

### Stack Decision: **Keep Next.js + Switch Backend to Node/Python**

**Why:**
- Faster AI/LLM integration (PDF parsing, clause extraction)
- More libraries for document processing
- Easier to hire for vs Rust

**New Stack:**
```
Frontend: Next.js 14 + Bun (keep as-is)
Backend: Node.js (NestJS) OR Python (FastAPI)
DB: Supabase (Postgres)
Storage: Supabase Storage
Deploy: Fly.io
Queue: Upstash Redis (for async jobs)
AI: OpenAI/Anthropic for PDF extraction
```

### Migration Plan

**Option A: Keep Rust, Add Workers**
- Keep Rust backend for API
- Add Python workers for PDF parsing
- Use Redis queue to connect them

**Option B: Full Node/Python Rewrite**
- Faster iteration
- More libraries
- Port auth logic (~2 hours)

**Recommendation:** **Option B (Node.js)** for speed to market.

---

## STEP 3: Deploy to Staging (Fly.io + Supabase)

### Supabase Setup (15 minutes)

```bash
# 1. Create project at supabase.com (free tier)
# 2. Create tables via SQL editor:

-- Waitlist
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  company VARCHAR(255),
  role VARCHAR(100),
  company_size VARCHAR(50),
  top_pain TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploads
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  file_name VARCHAR(255),
  file_type VARCHAR(50),
  file_url TEXT,
  status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Findings
CREATE TABLE findings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  vendor VARCHAR(255),
  issue_type VARCHAR(100),
  amount NUMERIC(12,2),
  evidence TEXT,
  confidence VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id UUID REFERENCES workspaces(id),
  total_analyzed NUMERIC(12,2),
  total_found NUMERIC(12,2),
  findings_count INT,
  report_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

# 3. Get connection string from Settings > Database
# 4. Create storage bucket: "uploads"
```

### Fly.io Deploy (30 minutes)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Create fly.toml
cat > fly.toml <<EOF
app = "spendcheck"

[build]
  builder = "heroku/buildpacks:20"

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]
  
  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
EOF

# Deploy
fly launch
fly secrets set DATABASE_URL=<supabase-url>
fly secrets set SUPABASE_KEY=<key>
fly deploy

# URL: https://spendcheck.fly.dev
```

**Total cost:** ~$5-10/month (scales to 1000s of users)

---

## STEP 4: Demo + Pilot Offer

### Demo Flow (30 seconds)

1. Visit staging URL
2. Click "Load Demo Data"
3. Upload sample AP CSV
4. Click "Run Analysis"
5. View leak report ($47K found)
6. Copy formatted memo

### Pilot Offer Script

**For Tier A leads from interviews:**

```
Based on our call, I think we can find meaningful leaks in your vendor spend.

Here's what I'm offering:
- Upload your AP exports + contracts (we handle CSV/PDF)
- We'll deliver a leak report in 7 days
- If we don't find at least $10K in actionable leaks, you don't pay

Cost: $2,500 for the audit

If it works, we can discuss monthly monitoring ($1K-$3K/mo).

Interested? I can get you started this week.
```

**Goal:** Convert 2-3 pilot customers in first 30 days.

---

## TIMELINE

### Week 1 (Now)
- **Mon-Tue:** Send 30 LinkedIn messages
- **Wed-Fri:** Conduct 5-10 interviews
- **Decision:** GO/NO-GO based on validation rule

### Week 2-3 (If GO)
- Build MVP (upload, parsing, detectors, report)
- Deploy to Fly.io staging
- Create demo data

### Week 4
- Offer pilots to Tier A leads
- Run 3-5 pilots
- Iterate based on feedback

### Week 5-6
- Convert pilots to paid contracts
- Build v2 features (monitoring, team access)
- Launch waitlist funnel

---

## LOCAL TESTING PLAN

### Test 1: File Upload
```bash
# Start local server
bun run dev

# Upload test CSV (sample AP export)
curl -X POST http://localhost:3000/api/upload \
  -F file=@test_ap_export.csv \
  -H "Authorization: Bearer <token>"

# Verify: File appears in Supabase storage
# Verify: Upload record in database
```

### Test 2: Duplicate Detection
```bash
# Create test data with known duplicates
# Invoice #1001, $5000, 2024-01-15, Acme Inc
# Invoice #1001, $5000, 2024-01-15, Acme LLC

# Run detector
POST /api/analyze/run

# Expected output:
# Finding: Duplicate payment, $5000, HIGH confidence
# Evidence: Same invoice, amount, date, vendor variation
```

### Test 3: Report Generation
```bash
# Generate report
POST /api/report/generate
{
  "workspace_id": "...",
  "findings": [...]
}

# Verify output:
# - Executive summary
# - Leak inventory table
# - Recovery plan
# - Formatted text for copy/paste
# - JSON download
```

---

## SUCCESS METRICS (First 30 Days)

### Validation Phase (Week 1)
- ✅ 10 interviews completed
- ✅ 5+ Tier A/B leads
- ✅ 3+ pilot commitments

### Build Phase (Week 2-3)
- ✅ MVP deployed to staging
- ✅ Demo flow working (<60 sec)
- ✅ Tests passing (detectors + parsing)

### Pilot Phase (Week 4)
- ✅ 3 pilots started
- ✅ 2/3 pilots find >$10K in leaks
- ✅ 1 testimonial

### Launch Phase (Week 5-6)
- ✅ 50+ waitlist signups
- ✅ 2 paid contracts closed
- ✅ Case study published

---

## IF VALIDATION FAILS

**Pivot options:**

1. **Different ICP:** Try RIA/advisors or crypto allocators
2. **Different wedge:** Focus on SaaS spend only (narrower)
3. **Different outcome:** "Renewal calendar" instead of "leak detector"
4. **Return to portfolio tool:** But with tight ICP (still students, not vague)

**Decision rule:** If <3 Tier A leads after 15 interviews, pivot or pause.

---

## RECOMMENDED PATH FORWARD

### Today (2 hours)
1. ✅ Send 10 LinkedIn messages using script above
2. ✅ Create waitlist page (basic, 1 hour)
3. ✅ Set up Supabase project

### Tomorrow
1. Book follow-up calls with respondents
2. Prepare interview guide
3. Start building CSV parser + duplicate detector

### This Week
1. Complete 5-7 interviews
2. Score leads (A/B/C)
3. Make GO/NO-GO decision Friday

### Next Week (If GO)
1. Build MVP (upload + detectors + report)
2. Deploy to Fly.io
3. Create demo flow

---

## FINAL RECOMMENDATION

**Do this, in this order:**

1. **Customer development first** (no more building without validation)
2. **Tight wedge** (spend leak analyzer, NOT platform)
3. **Fast deploy** (Fly.io + Supabase = $30/mo, scales)
4. **Pilot revenue** (2-3 paid pilots in 30 days)
5. **Iterate based on real usage** (not guesses)

**If interviews say "yes, I'd pay for this"** → Build it.
**If interviews say "interesting but..."** → Pivot or refine.

Stop building features. Start finding customers who will pay.

---

**Status:** Awaiting customer interviews. Do not build until validation = GO.
