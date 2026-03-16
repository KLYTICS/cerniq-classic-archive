"""
CERNIQ Outbound Engine — Enrichment Agent

Adds missing contact data (email, phone, LinkedIn) to leads.
Supports pluggable enrichment backends.
"""

import logging
import re
from typing import Optional

from config import config

logger = logging.getLogger(__name__)


class EnrichmentAgent:
    """Enriches leads with contact details from various sources."""

    def __init__(self):
        self.hunter_key = config.HUNTER_API_KEY
        self.apollo_key = config.APOLLO_API_KEY
        self.clearbit_key = config.CLEARBIT_API_KEY

    def enrich(self, lead: dict) -> dict:
        """Enrich a single lead with contact information.

        Tries enrichment backends in order of preference.
        Falls back to pattern-based email generation.
        """
        enriched = {**lead}

        # Try API-based enrichment first
        if self.hunter_key:
            result = self._enrich_hunter(lead)
            if result:
                enriched.update(result)
                return enriched

        if self.apollo_key:
            result = self._enrich_apollo(lead)
            if result:
                enriched.update(result)
                return enriched

        # Fallback: pattern-based email generation
        enriched["email"] = self._generate_email_pattern(lead)
        enriched["linkedin"] = None
        enriched["enrichment_source"] = "pattern"

        return enriched

    def enrich_batch(self, leads: list[dict]) -> list[dict]:
        """Enrich multiple leads."""
        enriched = []
        for lead in leads:
            try:
                enriched.append(self.enrich(lead))
            except Exception as e:
                logger.error(f"Enrichment failed for {lead.get('institution')}: {e}")
                enriched.append({**lead, "enrichment_error": str(e)})
        logger.info(f"Enriched {len(enriched)} leads")
        return enriched

    def _generate_email_pattern(self, lead: dict) -> Optional[str]:
        """Generate a probable email address from institution name.

        Common patterns for PR cooperativas:
        - info@cooperativa.com
        - financiero@cooperativa.com
        """
        institution = lead.get("institution", "")
        # Extract key name part
        name = institution.lower()
        name = re.sub(r"cooperativa de ahorro y cr[eé]dito\s*(de\s*)?", "", name)
        name = re.sub(r"[^a-z0-9\s]", "", name)
        name = name.strip().replace(" ", "")

        if not name:
            return None

        domain = f"coop{name[:12]}.com"
        role = lead.get("contact_role", "CFO").lower()

        if role in ("cfo", "controller"):
            return f"finanzas@{domain}"
        elif "director" in role:
            return f"director@{domain}"
        else:
            return f"info@{domain}"

    def _enrich_hunter(self, lead: dict) -> Optional[dict]:
        """Enrich via Hunter.io API. Placeholder for integration."""
        # TODO: Integrate Hunter.io domain search
        # import requests
        # resp = requests.get(
        #     "https://api.hunter.io/v2/domain-search",
        #     params={"domain": domain, "api_key": self.hunter_key}
        # )
        logger.debug("Hunter enrichment not yet configured")
        return None

    def _enrich_apollo(self, lead: dict) -> Optional[dict]:
        """Enrich via Apollo.io API. Placeholder for integration."""
        # TODO: Integrate Apollo people search
        logger.debug("Apollo enrichment not yet configured")
        return None

    def score_lead(self, lead: dict) -> int:
        """Score a lead 1-100 based on fit signals.

        Scoring factors:
        - Asset size (larger = higher score)
        - Region (Metro = premium)
        - Role (CFO/VP = higher)
        - Enrichment completeness
        """
        score = 50  # Base score

        # Asset size bonus
        assets = lead.get("estimated_assets", 0)
        if assets >= 300_000_000:
            score += 20
        elif assets >= 150_000_000:
            score += 10
        elif assets < 50_000_000:
            score -= 10

        # Region bonus
        region = lead.get("region", "")
        if region == "Metro":
            score += 10
        elif region in ("East", "North"):
            score += 5

        # Role bonus
        role = lead.get("contact_role", "")
        if role in ("CFO", "VP Finanzas"):
            score += 10
        elif role in ("Director Financiero", "Gerente Financiero"):
            score += 5

        # Enrichment bonus
        if lead.get("email"):
            score += 5
        if lead.get("linkedin"):
            score += 5

        return min(max(score, 1), 100)
