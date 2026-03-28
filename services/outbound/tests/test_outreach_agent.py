"""Tests for OutreachAgent — email dispatch with daily limits and dry-run mode."""

import pytest
from agents.outreach_agent import OutreachAgent


@pytest.fixture
def agent():
    """Agent with no SMTP credentials → dry-run mode."""
    a = OutreachAgent()
    a.smtp_user = ""
    a.smtp_password = ""
    a.daily_limit = 5
    return a


class TestDryRunMode:
    def test_sends_in_dry_run_when_no_credentials(self, agent):
        result = agent.send_email("test@coop.pr", "Test Subject", "Test Body")
        assert result["success"] is True
        assert result["dry_run"] is True
        assert result["recipient"] == "test@coop.pr"

    def test_increments_daily_counter(self, agent):
        assert agent.daily_sent == 0
        agent.send_email("a@test.com", "S", "B")
        assert agent.daily_sent == 1
        agent.send_email("b@test.com", "S", "B")
        assert agent.daily_sent == 2


class TestDailyLimit:
    def test_rejects_after_daily_limit(self, agent):
        agent.daily_limit = 2
        agent.send_email("a@test.com", "S", "B")
        agent.send_email("b@test.com", "S", "B")
        result = agent.send_email("c@test.com", "S", "B")
        assert result["success"] is False
        assert result["error"] == "daily_limit_reached"

    def test_reset_counter(self, agent):
        agent.daily_sent = 50
        agent.reset_daily_counter()
        assert agent.daily_sent == 0


class TestBatchSend:
    def test_sends_batch(self, agent):
        messages = [
            {"recipient": "a@test.com", "subject": "S1", "body": "B1"},
            {"recipient": "b@test.com", "subject": "S2", "body": "B2"},
            {"recipient": "c@test.com", "subject": "S3", "body": "B3"},
        ]
        results = agent.send_batch(messages)
        assert len(results) == 3
        assert all(r["success"] for r in results)
        assert agent.daily_sent == 3

    def test_batch_respects_daily_limit(self, agent):
        agent.daily_limit = 2
        messages = [
            {"recipient": f"{i}@test.com", "subject": "S", "body": "B"}
            for i in range(5)
        ]
        results = agent.send_batch(messages)
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        assert len(successes) == 2
        assert len(failures) == 3
        assert all(f["error"] == "daily_limit_reached" for f in failures)
