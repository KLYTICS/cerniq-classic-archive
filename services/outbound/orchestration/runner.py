"""
CERNIQ Outbound Engine — Orchestration Runner

Executes agent handoff sequences defined in agents.yaml.
"""

import logging
import sys
import os

import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from agents.lead_research_agent import LeadResearchAgent
from agents.enrichment_agent import EnrichmentAgent
from agents.messaging_agent import MessagingAgent
from agents.outreach_agent import OutreachAgent
from agents.followup_agent import FollowupAgent
from agents.crm_agent import CRMAgent

logger = logging.getLogger(__name__)

# Map agent names to classes
AGENT_REGISTRY = {
    "lead_research": LeadResearchAgent,
    "enrichment": EnrichmentAgent,
    "messaging": MessagingAgent,
    "outreach": OutreachAgent,
    "followup": FollowupAgent,
    "crm": CRMAgent,
}


def load_contracts(path: str = None) -> dict:
    """Load agent contracts from YAML."""
    if path is None:
        path = os.path.join(os.path.dirname(__file__), "agents.yaml")
    with open(path, "r") as f:
        return yaml.safe_load(f)


def run_pipeline(pipeline_name: str, contracts: dict = None) -> dict:
    """Execute a named pipeline from the contracts.

    Instantiates agents in sequence and passes data through the chain.
    """
    if contracts is None:
        contracts = load_contracts()

    pipeline = contracts.get("pipelines", {}).get(pipeline_name)
    if not pipeline:
        return {"error": f"Pipeline '{pipeline_name}' not found"}

    sequence = pipeline.get("sequence", [])
    config = pipeline.get("config", {})
    dry_run = config.get("dry_run", True)
    lang = config.get("language", "es")
    max_emails = config.get("max_emails", 50)

    logger.info(f"Running pipeline: {pipeline_name} (sequence={sequence}, dry_run={dry_run})")

    # Pipeline state passed between agents
    state = {
        "leads": [],
        "enriched": [],
        "messages": [],
        "results": [],
        "metrics": {},
    }

    for step in sequence:
        agent_class = AGENT_REGISTRY.get(step)
        if not agent_class:
            logger.warning(f"Unknown agent: {step}, skipping")
            continue

        agent = agent_class()
        logger.info(f"  → Running agent: {step}")

        if step == "lead_research":
            state["leads"] = agent.generate_leads()

        elif step == "enrichment":
            state["enriched"] = agent.enrich_batch(state["leads"])
            # Score all leads
            for lead in state["enriched"]:
                lead["score"] = agent.score_lead(lead)
            state["enriched"].sort(key=lambda x: x["score"], reverse=True)

        elif step == "messaging":
            for lead in state["enriched"][:max_emails]:
                msg = agent.generate_cold_email(lead, lang=lang)
                state["messages"].append({**msg, "lead": lead})

        elif step == "outreach":
            for msg in state["messages"]:
                email = msg.get("lead", {}).get("email")
                if not email:
                    continue
                if dry_run:
                    logger.info(f"  [DRY RUN] → {email}: {msg['subject']}")
                    state["results"].append({"recipient": email, "dry_run": True})
                else:
                    result = agent.send_email(email, msg["subject"], msg["body"])
                    state["results"].append(result)

        elif step == "followup":
            # Follow-up needs outreach_log from DB; stub for now
            logger.info("  Follow-up check: would query outreach_log table")

        elif step == "crm":
            state["metrics"] = agent.get_pipeline_metrics(state.get("enriched", []))

    summary = {
        "pipeline": pipeline_name,
        "agents_executed": sequence,
        "leads_loaded": len(state["leads"]),
        "enriched": len(state["enriched"]),
        "messages_generated": len(state["messages"]),
        "emails_sent": len(state["results"]),
        "metrics": state["metrics"],
        "dry_run": dry_run,
    }

    logger.info(f"Pipeline complete: {summary}")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    contracts = load_contracts()

    print("\n=== Agent Contracts ===")
    for dept, info in contracts.get("departments", {}).items():
        print(f"  {dept}: {info.get('name')} → hands off to {info.get('handoff_to', 'end')}")

    print("\n=== Running Daily Outreach Pipeline ===")
    result = run_pipeline("daily_outreach", contracts)
    print(f"\nResult: {result}")
