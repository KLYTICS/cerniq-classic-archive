"""
CERNIQ Outbound Engine — CRM Agent

Manages pipeline stages, metrics, and lead lifecycle.
"""

import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Valid pipeline stages in order
PIPELINE_STAGES = [
    "new",
    "contacted",
    "replied",
    "demo_booked",
    "proposal",
    "negotiating",
    "closed_won",
    "closed_lost",
]


class CRMAgent:
    """Manages the lead pipeline and produces sales metrics."""

    def __init__(self, db=None):
        """Initialize with optional database connection.

        If no DB, operates in-memory for testing.
        """
        self.db = db
        self._in_memory_leads: list[dict] = []

    def update_stage(self, lead_id: int, stage: str) -> dict:
        """Move a lead to a new pipeline stage.

        Validates the stage is a known value.
        """
        if stage not in PIPELINE_STAGES:
            return {"success": False, "error": f"Invalid stage: {stage}. Valid: {PIPELINE_STAGES}"}

        if self.db:
            # Parameterized query for production
            query = "UPDATE leads SET stage = %s, updated_at = NOW() WHERE id = %s"
            params = (stage, lead_id)
            logger.info(f"Lead {lead_id} → {stage}")
            return {"success": True, "lead_id": lead_id, "stage": stage, "query": query, "params": params}
        else:
            # In-memory mode
            for lead in self._in_memory_leads:
                if lead.get("id") == lead_id:
                    lead["stage"] = stage
                    lead["updated_at"] = datetime.now().isoformat()
                    logger.info(f"Lead {lead_id} → {stage}")
                    return {"success": True, "lead_id": lead_id, "stage": stage}
            return {"success": False, "error": f"Lead {lead_id} not found"}

    def add_note(self, lead_id: int, note: str) -> dict:
        """Append a timestamped note to a lead."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        formatted = f"[{timestamp}] {note}"

        if self.db:
            query = """
            UPDATE leads
            SET notes = COALESCE(notes, '') || E'\\n' || %s,
                updated_at = NOW()
            WHERE id = %s
            """
            return {"success": True, "query": query, "params": (formatted, lead_id)}
        else:
            for lead in self._in_memory_leads:
                if lead.get("id") == lead_id:
                    lead["notes"] = (lead.get("notes", "") + "\n" + formatted).strip()
                    return {"success": True}
            return {"success": False, "error": f"Lead {lead_id} not found"}

    def get_pipeline_metrics(self, leads: Optional[list[dict]] = None) -> dict:
        """Calculate pipeline metrics from a list of leads.

        Returns stage counts, conversion rate, and pipeline value.
        """
        if leads is None:
            leads = self._in_memory_leads

        total = len(leads)
        if total == 0:
            return {"total": 0, "stages": {}, "conversion_rate": "0%", "pipeline_value": 0}

        stage_counts = {}
        for lead in leads:
            stage = lead.get("stage", "new")
            stage_counts[stage] = stage_counts.get(stage, 0) + 1

        closed_won = stage_counts.get("closed_won", 0)
        conversion_rate = f"{(closed_won / total * 100):.1f}%" if total > 0 else "0%"

        # Expected deal value per active lead: $750/report
        active_stages = {"contacted", "replied", "demo_booked", "proposal", "negotiating"}
        active_count = sum(stage_counts.get(s, 0) for s in active_stages)
        pipeline_value = active_count * 750

        return {
            "total": total,
            "stages": stage_counts,
            "conversion_rate": conversion_rate,
            "closed_won": closed_won,
            "active_pipeline": active_count,
            "pipeline_value": pipeline_value,
        }
