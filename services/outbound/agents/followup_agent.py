"""
CERNIQ Outbound Engine — Follow-Up Agent

Manages automated follow-up sequences at configurable intervals.
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from config import config

logger = logging.getLogger(__name__)


class FollowupAgent:
    """Determines which leads need follow-ups and generates the messages."""

    def __init__(self):
        self.followup_1_days = config.FOLLOWUP_1_DAYS
        self.followup_2_days = config.FOLLOWUP_2_DAYS

    def get_due_followups(self, leads: list[dict], outreach_log: list[dict]) -> list[dict]:
        """Identify leads that are due for follow-up.

        Rules:
        - No response after FOLLOWUP_1_DAYS → send followup_1
        - No response after FOLLOWUP_2_DAYS → send followup_2 (final)
        - Already replied or demo_booked → skip
        """
        due = []
        now = datetime.now()

        for lead in leads:
            lead_id = lead.get("id")
            stage = lead.get("stage", "new")

            # Skip leads that have progressed
            if stage in ("replied", "demo_booked", "proposal", "negotiating", "closed_won", "closed_lost"):
                continue

            # Get outreach history for this lead
            history = [
                log for log in outreach_log
                if log.get("lead_id") == lead_id
            ]

            if not history:
                continue  # Never contacted, not a follow-up candidate

            # Sort by sent date
            history.sort(key=lambda x: x.get("sent_at", ""), reverse=True)
            last_sent = history[0]
            last_sent_at = last_sent.get("sent_at")

            if isinstance(last_sent_at, str):
                last_sent_at = datetime.fromisoformat(last_sent_at)

            days_since = (now - last_sent_at).days
            sent_types = {h.get("message_type") for h in history}

            if "followup_2" in sent_types:
                # Already sent final follow-up, no more
                continue
            elif "followup_1" in sent_types and days_since >= self.followup_2_days:
                due.append({**lead, "followup_sequence": 2})
            elif "cold" in sent_types and "followup_1" not in sent_types and days_since >= self.followup_1_days:
                due.append({**lead, "followup_sequence": 1})

        logger.info(f"Found {len(due)} leads due for follow-up")
        return due

    def followup_message(self, lead: dict, sequence: int = 1) -> str:
        """Generate a follow-up message body (legacy interface)."""
        institution = lead.get("institution", "Cooperativa")
        role = lead.get("contact_role", "CFO")

        if sequence == 1:
            return f"""Estimado/a {role},

Le escribo como seguimiento.

CERNIQ ayuda a instituciones como {institution} a pasar de datos crudos de balance general a un informe ALM listo para la junta — a través de un simple flujo de carga.

¿Tiene 15 minutos esta semana para una demostración rápida?

Saludos cordiales,
Erwin Kiess
CERNIQ
"""
        else:
            return f"""Estimado/a {role},

Esta es mi última nota sobre el informe ALM para {institution}.

Si en el futuro necesita generar informes ALM más rápido, estamos aquí para ayudar.

https://calendly.com/cerniq/demo

Saludos,
Erwin Kiess
CERNIQ
"""
