# CERNIQ Outbound Engine

Automated outbound sales pipeline for cooperativa ALM reporting outreach.

## Architecture

```
services/outbound/
├── app.py                          # FastAPI entrypoint
├── config.py                       # Environment configuration
├── agents/
│   ├── lead_research_agent.py      # Load and filter cooperativa leads
│   ├── enrichment_agent.py         # Add contact data + score leads
│   ├── messaging_agent.py          # Generate bilingual outreach messages
│   ├── outreach_agent.py           # Email dispatch (SMTP / SendGrid / SES)
│   ├── followup_agent.py           # Automated day-3 and day-7 follow-ups
│   └── crm_agent.py                # Pipeline stage management + metrics
├── pipelines/
│   ├── daily_outreach_pipeline.py  # Daily: load → enrich → message → send
│   └── lead_ingestion_pipeline.py  # Bulk CSV import to database
├── templates/                      # Bilingual email templates
│   ├── cold_email.txt
│   ├── followup_email.txt
│   └── final_email.txt
├── data/
│   └── puerto_rico_cooperativas_seed.csv   # 109 cooperativas seed dataset
├── database/
│   └── schema.sql                  # PostgreSQL schema for leads + outreach log
├── scheduler/
│   └── cron_jobs.py                # Cron-style automation runner
└── orchestration/
    ├── agents.yaml                 # Multi-agent contract definitions
    └── runner.py                   # YAML-driven pipeline executor
```

## Quick Start

```bash
# Install dependencies
cd services/outbound
pip install -r requirements.txt

# Run the API server
uvicorn app:app --host 0.0.0.0 --port 8099 --reload

# Or run the daily pipeline directly
python pipelines/daily_outreach_pipeline.py

# Or run the orchestration runner
python orchestration/runner.py
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Health check |
| POST | `/leads/add` | Add a single lead |
| GET | `/leads` | List leads (filter by stage, region) |
| PATCH | `/leads/{id}/stage` | Update lead pipeline stage |
| POST | `/leads/seed` | Load cooperativa seed data |
| POST | `/leads/ingest-csv` | Bulk import from CSV |
| POST | `/outreach/run` | Execute outreach pipeline |
| POST | `/outreach/preview` | Preview a generated message |
| GET | `/metrics` | Pipeline metrics |
| GET | `/metrics/regions` | Lead counts by PR region |

## Pipeline Stages

```
new → contacted → replied → demo_booked → proposal → negotiating → closed_won
                                                                  → closed_lost
```

## Seed Dataset

The `data/puerto_rico_cooperativas_seed.csv` contains 109 Puerto Rico cooperativas sourced from the Liga de Cooperativas directory and COSSEC registry. Each institution can be expanded into 3-5 buyer personas (CFO, Director Financiero, Controller, Risk Officer, President) for 500+ contact targets.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SMTP_HOST` | smtp.gmail.com | SMTP server |
| `SMTP_PORT` | 587 | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASSWORD` | — | SMTP password |
| `FROM_EMAIL` | erwin@cerniq.com | Sender email |
| `HUNTER_API_KEY` | — | Hunter.io API key |
| `APOLLO_API_KEY` | — | Apollo.io API key |
| `DAILY_EMAIL_LIMIT` | 50 | Max emails per day |
| `OUTBOUND_DATABASE_URL` | local postgres | Database connection |

## Relationship to backend-node/src/leads

The existing NestJS `leads/` module handles inbound lead capture, demo requests, and CRM pipeline for the web app. This outbound engine handles automated proactive prospecting and outreach sequences. Both write to compatible data structures and can share the same database.
