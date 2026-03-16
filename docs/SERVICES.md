# CERNIQ Outbound Sales Engine

> Documentation for the autonomous sales pipeline in `services/outbound/`.

---

## Overview

The outbound engine is a **Python/FastAPI** microservice that automates lead generation, enrichment, and outreach for CERNIQ's go-to-market strategy targeting Puerto Rico cooperativas and credit unions.

---

## Architecture

```
┌──────────────────────────────────────────┐
│           Orchestration Layer            │
│          (agents.yaml config)            │
├────────┬────────┬────────┬──────────────┤
│ Lead   │Enrich- │Messag- │  Outreach    │
│Research│ ment   │ ing    │  Agent       │
│ Agent  │ Agent  │ Agent  │              │
├────────┼────────┼────────┼──────────────┤
│  CRM   │Follow- │        │              │
│ Agent  │ up     │        │              │
│        │ Agent  │        │              │
├────────┴────────┴────────┴──────────────┤
│           Pipelines                      │
│  Lead Ingestion  │  Daily Outreach      │
├──────────────────┴──────────────────────┤
│           Scheduler (Cron)              │
└──────────────────────────────────────────┘
```

---

## Agents (`agents/`)

| Agent | File | Purpose |
|-------|------|---------|
| **Lead Research** | `lead_research_agent.py` | Discovers and qualifies potential cooperativa leads from public sources |
| **Enrichment** | `enrichment_agent.py` | Enriches leads with public data (COSSEC filings, NCUA data, LinkedIn) |
| **Messaging** | `messaging_agent.py` | Generates personalized email copy based on institution profile |
| **Outreach** | `outreach_agent.py` | Sends emails and manages delivery/bounce tracking |
| **CRM** | `crm_agent.py` | Updates pipeline status, logs interactions, manages deal flow |
| **Follow-up** | `followup_agent.py` | Schedules and sends follow-up sequences based on engagement |

---

## Pipelines (`pipelines/`)

### Lead Ingestion Pipeline (`lead_ingestion_pipeline.py`)
1. Read seed CSV (`data/puerto_rico_cooperativas_seed.csv`)
2. Deduplicate against existing leads
3. Enrich with public data
4. Score and prioritize
5. Insert into prospect pipeline

### Daily Outreach Pipeline (`daily_outreach_pipeline.py`)
1. Query prospects ready for outreach
2. Generate personalized messaging
3. Send via outreach agent
4. Log results
5. Schedule follow-ups

---

## Email Templates (`templates/`)

| Template | Purpose |
|----------|---------|
| `cold_email.txt` | Initial cold outreach with value prop |
| `followup_email.txt` | Follow-up after no response |
| `final_email.txt` | Last-touch "breakup" email |

---

## Configuration

### `config.py`
Application configuration:
- Database connection
- Email provider settings
- Rate limits for outreach
- Agent behavior parameters

### `orchestration/agents.yaml`
YAML-based agent orchestration config:
- Agent roles and responsibilities
- Execution order
- Inter-agent data flow
- Retry policies

---

## Database (`database/schema.sql`)
Outbound-specific schema (supplements main Prisma schema):
- Prospect tracking tables
- Email delivery logs
- Engagement metrics

---

## Seed Data (`data/`)

### `puerto_rico_cooperativas_seed.csv`
Seed dataset of Puerto Rico cooperativas with:
- Institution name
- Location
- Contact information
- Estimated total assets
- Data source (COSSEC, NCUA, manual)

---

## Running the Outbound Engine

```bash
cd services/outbound

# Install
pip install -r requirements.txt

# Run API server
python app.py

# Run lead ingestion
python -m pipelines.lead_ingestion_pipeline

# Run daily outreach
python -m pipelines.daily_outreach_pipeline
```

### Requirements
- Python 3.10+
- Dependencies in `requirements.txt`

---

## Integration with Main Platform

The outbound engine is designed to run independently but shares data with the main platform:
- Prospects created here can become Leads in the main `leads` table
- Report URLs from the main platform are used in outreach emails
- CRM agent syncs status back to `prospect_institutions` table
