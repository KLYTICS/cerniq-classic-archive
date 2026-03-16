"""
CERNIQ Outbound Engine — Lead Research Agent

Generates and manages lead lists from seed data and external sources.
"""

import csv
import logging
from typing import Optional

from config import config

logger = logging.getLogger(__name__)


class LeadResearchAgent:
    """Loads and manages the cooperativa lead pipeline."""

    def __init__(self, csv_path: Optional[str] = None):
        self.csv_path = csv_path or config.SEED_CSV_PATH

    def load_seed_data(self) -> list[dict]:
        """Load cooperativa leads from the seed CSV."""
        leads = []
        try:
            with open(self.csv_path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    leads.append({
                        "institution": row["institution"],
                        "institution_type": row.get("institution_type", "cooperativa"),
                        "location": row.get("location", ""),
                        "estimated_assets": int(row.get("estimated_assets", 0)),
                        "public_data_source": row.get("public_data_source", "cossec"),
                        "contact_role": row.get("contact_role", "CFO"),
                        "region": row.get("region", ""),
                    })
            logger.info(f"Loaded {len(leads)} leads from seed CSV")
        except FileNotFoundError:
            logger.error(f"Seed CSV not found: {self.csv_path}")
        return leads

    def filter_by_region(self, leads: list[dict], region: str) -> list[dict]:
        """Filter leads by PR region (Metro, East, West, North, South, Central, Islands)."""
        return [l for l in leads if l.get("region", "").lower() == region.lower()]

    def filter_by_asset_threshold(self, leads: list[dict], min_assets: int) -> list[dict]:
        """Filter leads to institutions above an asset threshold."""
        return [l for l in leads if l.get("estimated_assets", 0) >= min_assets]

    def expand_contacts(self, leads: list[dict]) -> list[dict]:
        """Expand each institution into multiple buyer personas.

        From 1 institution, generate contacts for:
        CFO, Director Financiero, Controller, Risk Officer, President/CEO
        """
        roles = ["CFO", "Director Financiero", "Controller", "Risk Officer", "Presidente"]
        expanded = []
        for lead in leads:
            for role in roles:
                expanded.append({**lead, "contact_role": role})
        return expanded

    def generate_leads(self, region: Optional[str] = None, min_assets: int = 0) -> list[dict]:
        """Main entry: load, filter, and return leads."""
        leads = self.load_seed_data()
        if region:
            leads = self.filter_by_region(leads, region)
        if min_assets > 0:
            leads = self.filter_by_asset_threshold(leads, min_assets)
        logger.info(f"Generated {len(leads)} leads (region={region}, min_assets={min_assets})")
        return leads
