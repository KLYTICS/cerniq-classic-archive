"""
CERNIQ Outbound Engine — Lead Ingestion Pipeline

Bulk import from CSV into database.
"""

import csv
import logging
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from config import config

logger = logging.getLogger(__name__)


def ingest_from_csv(
    csv_path: str | None = None,
    db_connection=None,
) -> dict:
    """Load leads from CSV and insert into the database.

    If no DB connection is provided, returns the parsed leads
    for in-memory use.
    """
    csv_path = csv_path or config.SEED_CSV_PATH

    leads = []
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                lead = {
                    "institution": row["institution"],
                    "institution_type": row.get("institution_type", "cooperativa"),
                    "location": row.get("location", ""),
                    "estimated_assets": int(row.get("estimated_assets", 0)),
                    "contact_role": row.get("contact_role", "CFO"),
                    "region": row.get("region", ""),
                    "source": row.get("public_data_source", "cossec"),
                    "language": "es",  # Default for PR cooperativas
                    "stage": "new",
                    "created_at": datetime.now().isoformat(),
                }
                leads.append(lead)
    except FileNotFoundError:
        logger.error(f"CSV not found: {csv_path}")
        return {"status": "error", "error": "file_not_found", "path": csv_path}

    logger.info(f"Parsed {len(leads)} leads from CSV")

    if db_connection:
        inserted = _insert_to_db(db_connection, leads)
        return {"status": "completed", "parsed": len(leads), "inserted": inserted}

    return {"status": "completed", "parsed": len(leads), "leads": leads}


def _insert_to_db(conn, leads: list[dict]) -> int:
    """Insert leads into PostgreSQL.

    Uses ON CONFLICT to avoid duplicating by institution name.
    """
    inserted = 0
    try:
        cursor = conn.cursor()
        for lead in leads:
            cursor.execute(
                """
                INSERT INTO leads (institution, institution_type, location, estimated_assets,
                                   role, region, source, language, stage)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                """,
                (
                    lead["institution"],
                    lead["institution_type"],
                    lead["location"],
                    lead["estimated_assets"],
                    lead["contact_role"],
                    lead["region"],
                    lead["source"],
                    lead["language"],
                    lead["stage"],
                ),
            )
            inserted += cursor.rowcount
        conn.commit()
        cursor.close()
    except Exception as e:
        logger.error(f"DB insertion error: {e}")
        conn.rollback()

    logger.info(f"Inserted {inserted} leads into database")
    return inserted


def generate_insert_sql(leads: list[dict]) -> str:
    """Generate SQL INSERT statements for manual execution."""
    lines = []
    for lead in leads:
        vals = (
            lead["institution"].replace("'", "''"),
            lead["institution_type"],
            lead["location"].replace("'", "''"),
            lead["estimated_assets"],
            lead["contact_role"],
            lead.get("region", ""),
            lead.get("source", "cossec"),
            lead.get("language", "es"),
            "new",
        )
        lines.append(
            f"INSERT INTO leads (institution, institution_type, location, estimated_assets, "
            f"role, region, source, language, stage) "
            f"VALUES ('{vals[0]}', '{vals[1]}', '{vals[2]}', {vals[3]}, "
            f"'{vals[4]}', '{vals[5]}', '{vals[6]}', '{vals[7]}', '{vals[8]}');"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = ingest_from_csv()
    print(f"Ingestion result: {result['status']} — {result['parsed']} leads parsed")
