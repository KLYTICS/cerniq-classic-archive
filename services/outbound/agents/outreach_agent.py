"""
CERNIQ Outbound Engine — Outreach Agent

Dispatches emails via SMTP or pluggable providers (SendGrid, SES, Resend).
"""

import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from config import config

logger = logging.getLogger(__name__)


class OutreachAgent:
    """Handles email dispatch through SMTP or API-based providers."""

    def __init__(self):
        self.smtp_host = config.SMTP_HOST
        self.smtp_port = config.SMTP_PORT
        self.smtp_user = config.SMTP_USER
        self.smtp_password = config.SMTP_PASSWORD
        self.from_email = config.FROM_EMAIL
        self.from_name = config.FROM_NAME
        self.daily_sent = 0
        self.daily_limit = config.DAILY_EMAIL_LIMIT

    def send_email(
        self,
        recipient: str,
        subject: str,
        body: str,
        reply_to: Optional[str] = None,
    ) -> dict:
        """Send a single email via SMTP.

        Returns status dict with success/failure info.
        """
        if self.daily_sent >= self.daily_limit:
            logger.warning(f"Daily email limit reached ({self.daily_limit})")
            return {"success": False, "error": "daily_limit_reached"}

        if not self.smtp_user or not self.smtp_password:
            logger.info(f"[DRY RUN] Would send to {recipient}: {subject}")
            self.daily_sent += 1
            return {"success": True, "dry_run": True, "recipient": recipient}

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = recipient
            if reply_to:
                msg["Reply-To"] = reply_to

            # Plain text body
            msg.attach(MIMEText(body, "plain", "utf-8"))

            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)

            self.daily_sent += 1
            logger.info(f"Email sent to {recipient} ({self.daily_sent}/{self.daily_limit})")
            return {"success": True, "recipient": recipient}

        except smtplib.SMTPException as e:
            logger.error(f"SMTP error sending to {recipient}: {e}")
            return {"success": False, "error": str(e), "recipient": recipient}
        except Exception as e:
            logger.error(f"Unexpected error sending to {recipient}: {e}")
            return {"success": False, "error": str(e), "recipient": recipient}

    def send_batch(self, messages: list[dict]) -> list[dict]:
        """Send multiple emails. Each message dict should have:
        recipient, subject, body
        """
        results = []
        for msg in messages:
            result = self.send_email(
                recipient=msg["recipient"],
                subject=msg["subject"],
                body=msg["body"],
                reply_to=msg.get("reply_to"),
            )
            results.append(result)
        return results

    def reset_daily_counter(self):
        """Reset the daily send counter (called by scheduler at midnight)."""
        self.daily_sent = 0
