"""
CERNIQ Outbound Engine — FastAPI Entrypoint

REST API for managing the outbound pipeline, leads, and metrics.
"""

import logging
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

from agents.lead_research_agent import LeadResearchAgent
from agents.enrichment_agent import EnrichmentAgent
from agents.messaging_agent import MessagingAgent
from agents.crm_agent import CRMAgent
from pipelines.daily_outreach_pipeline import run_daily_outreach
from pipelines.lead_ingestion_pipeline import ingest_from_csv

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="CERNIQ Outbound Engine",
    description="Automated outbound sales pipeline for cooperativa ALM reporting",
    version="1.0.0",
    docs_url="/docs",
)


# ── Models ──────────────────────────────────────────────

class LeadInput(BaseModel):
    institution: str
    institution_type: str = "cooperativa"
    contact_name: Optional[str] = None
    role: str = "CFO"
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    location: str = ""
    region: str = ""
    estimated_assets: int = 0


class StageUpdate(BaseModel):
    stage: str


class OutreachRequest(BaseModel):
    region: Optional[str] = None
    min_assets: int = 0
    lang: str = "es"
    dry_run: bool = True


class MessagePreview(BaseModel):
    institution: str
    contact_role: str = "CFO"
    estimated_assets: int = 0
    lang: str = "es"


# ── In-memory store (replace with DB in production) ─────

_leads: list[dict] = []
_lead_id_counter = 0


# ── Endpoints ───────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "CERNIQ Outbound Engine",
        "version": "1.0.0",
        "wedge": "Bilingual ALM reporting for cooperativas and credit unions",
        "endpoints": ["/docs", "/leads", "/outreach/run", "/outreach/preview", "/metrics"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}


# ── Lead Management ─────────────────────────────────────

@app.post("/leads/add")
def add_lead(lead: LeadInput):
    global _lead_id_counter
    _lead_id_counter += 1
    entry = {"id": _lead_id_counter, "stage": "new", **lead.model_dump()}
    _leads.append(entry)
    return {"lead_id": _lead_id_counter, "status": "created"}


@app.get("/leads")
def list_leads(stage: Optional[str] = None, region: Optional[str] = None):
    result = _leads
    if stage:
        result = [l for l in result if l.get("stage") == stage]
    if region:
        result = [l for l in result if l.get("region", "").lower() == region.lower()]
    return {"total": len(result), "leads": result}


@app.patch("/leads/{lead_id}/stage")
def update_lead_stage(lead_id: int, update: StageUpdate):
    crm = CRMAgent()
    crm._in_memory_leads = _leads
    result = crm.update_stage(lead_id, update.stage)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ── Outreach ─────────────────────────────────────────────

@app.post("/outreach/run")
def trigger_outreach(req: OutreachRequest):
    """Run the daily outreach pipeline."""
    result = run_daily_outreach(
        region=req.region,
        min_assets=req.min_assets,
        lang=req.lang,
        dry_run=req.dry_run,
    )
    return result


@app.post("/outreach/preview")
def preview_message(req: MessagePreview):
    """Preview a generated outreach message."""
    messaging = MessagingAgent()
    lead = {
        "institution": req.institution,
        "contact_role": req.contact_role,
        "estimated_assets": req.estimated_assets,
    }
    return messaging.generate_cold_email(lead, lang=req.lang)


# ── Seed Data ────────────────────────────────────────────

@app.post("/leads/seed")
def seed_leads():
    """Load cooperativa seed data into the pipeline."""
    global _lead_id_counter
    research = LeadResearchAgent()
    seeds = research.load_seed_data()
    added = 0
    for seed in seeds:
        # Check for duplicates
        existing = [l for l in _leads if l.get("institution") == seed["institution"]]
        if not existing:
            _lead_id_counter += 1
            _leads.append({"id": _lead_id_counter, "stage": "new", **seed})
            added += 1
    return {"status": "seeded", "added": added, "total": len(_leads)}


@app.post("/leads/ingest-csv")
def ingest_csv(path: Optional[str] = None):
    """Ingest leads from a CSV file."""
    result = ingest_from_csv(csv_path=path)
    if result.get("leads"):
        global _lead_id_counter
        for lead in result["leads"]:
            _lead_id_counter += 1
            _leads.append({"id": _lead_id_counter, **lead})
    return {"status": result["status"], "parsed": result["parsed"], "total_in_memory": len(_leads)}


# ── Metrics ──────────────────────────────────────────────

@app.get("/metrics")
def pipeline_metrics():
    """Get pipeline metrics across all leads."""
    crm = CRMAgent()
    return crm.get_pipeline_metrics(_leads)


@app.get("/metrics/regions")
def region_metrics():
    """Get lead counts by region."""
    regions: dict[str, int] = {}
    for lead in _leads:
        region = lead.get("region", "Unknown")
        regions[region] = regions.get(region, 0) + 1
    return {"regions": regions, "total": len(_leads)}
