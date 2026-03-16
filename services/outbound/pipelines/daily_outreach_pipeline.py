"""
CERNIQ Outbound Engine — Daily Outreach Pipeline

Orchestrates the daily flow: load leads → enrich → generate message → send.
"""

import logging
import sys
import os

# Allow imports from parent directory
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agents.lead_research_agent import LeadResearchAgent
from agents.enrichment_agent import EnrichmentAgent
from agents.messaging_agent import MessagingAgent
from agents.outreach_agent import OutreachAgent
from agents.followup_agent import FollowupAgent
from agents.crm_agent import CRMAgent

logger = logging.getLogger(__name__)


def run_daily_outreach(
    region: str | None = None,
    min_assets: int = 0,
    lang: str = "es",
    dry_run: bool = True,
) -> dict:
    """Execute the daily outreach pipeline.

    Steps:
    1. Load leads from seed data
    2. Filter by region/assets
    3. Enrich with contact info
    4. Score and sort by priority
    5. Generate personalized messages
    6. Send emails (or dry-run)

    Returns summary of actions taken.
    """
    research = LeadResearchAgent()
    enrichment = EnrichmentAgent()
    messaging = MessagingAgent()
    outreach = OutreachAgent()
    crm = CRMAgent()

    # 1. Load and filter leads
    leads = research.generate_leads(region=region, min_assets=min_assets)
    logger.info(f"Pipeline: {len(leads)} leads loaded")

    if not leads:
        return {"status": "no_leads", "sent": 0}

    # 2. Enrich
    enriched = enrichment.enrich_batch(leads)

    # 3. Score and sort
    scored = []
    for lead in enriched:
        lead["score"] = enrichment.score_lead(lead)
        scored.append(lead)
    scored.sort(key=lambda x: x["score"], reverse=True)

    # 4. Generate messages and send
    sent = 0
    skipped = 0
    errors = 0
    results = []

    for lead in scored:
        email = lead.get("email")
        if not email:
            skipped += 1
            continue

        # Generate message
        msg = messaging.generate_cold_email(lead, lang=lang)

        if dry_run:
            logger.info(f"[DRY RUN] To: {email} | Subject: {msg['subject']} | Score: {lead['score']}")
            sent += 1
            results.append({
                "institution": lead["institution"],
                "email": email,
                "subject": msg["subject"],
                "score": lead["score"],
                "dry_run": True,
            })
        else:
            result = outreach.send_email(
                recipient=email,
                subject=msg["subject"],
                body=msg["body"],
            )
            if result.get("success"):
                sent += 1
            else:
                errors += 1
            results.append(result)

    summary = {
        "status": "completed",
        "total_leads": len(leads),
        "enriched": len(enriched),
        "sent": sent,
        "skipped": skipped,
        "errors": errors,
        "dry_run": dry_run,
    }

    logger.info(f"Pipeline complete: {summary}")
    return summary


def run_followup_pipeline(
    leads: list[dict],
    outreach_log: list[dict],
    lang: str = "es",
    dry_run: bool = True,
) -> dict:
    """Execute the follow-up pipeline.

    Checks all contacted leads and sends follow-ups where due.
    """
    followup = FollowupAgent()
    messaging = MessagingAgent()
    outreach = OutreachAgent()

    due = followup.get_due_followups(leads, outreach_log)

    sent = 0
    for lead in due:
        sequence = lead.get("followup_sequence", 1)
        msg = messaging.generate_followup(lead, sequence=sequence, lang=lang)

        email = lead.get("email")
        if not email:
            continue

        if dry_run:
            logger.info(f"[DRY RUN] Follow-up {sequence} to {email}")
            sent += 1
        else:
            result = outreach.send_email(
                recipient=email,
                subject=msg["subject"],
                body=msg["body"],
            )
            if result.get("success"):
                sent += 1

    return {"status": "completed", "followups_due": len(due), "sent": sent, "dry_run": dry_run}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_daily_outreach(dry_run=True)
    print(f"\nPipeline result: {result}")
