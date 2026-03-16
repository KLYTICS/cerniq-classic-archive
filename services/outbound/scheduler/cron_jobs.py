"""
CERNIQ Outbound Engine — Scheduler

Automates daily outreach and follow-up pipelines via cron-style scheduling.
"""

import logging
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

try:
    import schedule
except ImportError:
    schedule = None

from pipelines.daily_outreach_pipeline import run_daily_outreach, run_followup_pipeline

logger = logging.getLogger(__name__)


def daily_outreach_job():
    """Run at 9:00 AM AST — send cold outreach to new leads."""
    logger.info("=== Daily Outreach Job Started ===")
    try:
        result = run_daily_outreach(dry_run=True)  # Start in dry-run mode
        logger.info(f"Daily outreach completed: {result}")
    except Exception as e:
        logger.error(f"Daily outreach failed: {e}")


def followup_job():
    """Run at 10:00 AM AST — check and send follow-ups."""
    logger.info("=== Follow-up Job Started ===")
    # In production, load leads and outreach_log from database
    logger.info("Follow-up job: would check database for due follow-ups")


def weekly_report_job():
    """Run Monday at 8:00 AM — generate pipeline metrics report."""
    logger.info("=== Weekly Report Job Started ===")
    # In production, generate and email weekly pipeline metrics
    logger.info("Weekly report: would generate pipeline metrics")


def start_scheduler():
    """Initialize and run the outbound scheduler."""
    if schedule is None:
        logger.error("schedule library not installed. Run: pip install schedule")
        return

    logger.info("Starting CERNIQ Outbound Scheduler...")

    # Daily jobs
    schedule.every().day.at("09:00").do(daily_outreach_job)
    schedule.every().day.at("10:00").do(followup_job)

    # Weekly job
    schedule.every().monday.at("08:00").do(weekly_report_job)

    logger.info("Scheduled jobs:")
    logger.info("  - Daily outreach: 09:00 AM")
    logger.info("  - Follow-up check: 10:00 AM")
    logger.info("  - Weekly report: Monday 08:00 AM")

    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    start_scheduler()
