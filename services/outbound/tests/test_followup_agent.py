"""Tests for FollowupAgent — automated follow-up sequence logic."""

import pytest
from datetime import datetime, timedelta
from agents.followup_agent import FollowupAgent


@pytest.fixture
def agent():
    return FollowupAgent()


def make_log(lead_id, msg_type, days_ago):
    return {
        "lead_id": lead_id,
        "message_type": msg_type,
        "sent_at": (datetime.now() - timedelta(days=days_ago)).isoformat(),
    }


class TestGetDueFollowups:
    def test_cold_email_due_for_followup_1_after_3_days(self, agent):
        leads = [{"id": 1, "stage": "contacted"}]
        log = [make_log(1, "cold", days_ago=4)]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 1
        assert due[0]["followup_sequence"] == 1

    def test_cold_email_not_due_before_3_days(self, agent):
        leads = [{"id": 1, "stage": "contacted"}]
        log = [make_log(1, "cold", days_ago=1)]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 0

    def test_followup_1_due_for_followup_2_after_7_days(self, agent):
        leads = [{"id": 1, "stage": "contacted"}]
        log = [
            make_log(1, "cold", days_ago=10),
            make_log(1, "followup_1", days_ago=8),
        ]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 1
        assert due[0]["followup_sequence"] == 2

    def test_no_followup_after_followup_2(self, agent):
        leads = [{"id": 1, "stage": "contacted"}]
        log = [
            make_log(1, "cold", days_ago=15),
            make_log(1, "followup_1", days_ago=12),
            make_log(1, "followup_2", days_ago=5),
        ]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 0

    def test_skip_replied_leads(self, agent):
        leads = [{"id": 1, "stage": "replied"}]
        log = [make_log(1, "cold", days_ago=10)]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 0

    def test_skip_demo_booked_leads(self, agent):
        leads = [{"id": 1, "stage": "demo_booked"}]
        log = [make_log(1, "cold", days_ago=10)]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 0

    def test_skip_closed_leads(self, agent):
        for stage in ("closed_won", "closed_lost"):
            leads = [{"id": 1, "stage": stage}]
            log = [make_log(1, "cold", days_ago=10)]
            due = agent.get_due_followups(leads, log)
            assert len(due) == 0, f"Should skip {stage}"

    def test_skip_never_contacted(self, agent):
        leads = [{"id": 1, "stage": "new"}]
        log = []  # No outreach history
        due = agent.get_due_followups(leads, log)
        assert len(due) == 0

    def test_multiple_leads_mixed(self, agent):
        leads = [
            {"id": 1, "stage": "contacted"},  # Due for followup_1
            {"id": 2, "stage": "replied"},      # Skip
            {"id": 3, "stage": "contacted"},    # Not yet due
        ]
        log = [
            make_log(1, "cold", days_ago=5),
            make_log(2, "cold", days_ago=5),
            make_log(3, "cold", days_ago=1),
        ]
        due = agent.get_due_followups(leads, log)
        assert len(due) == 1
        assert due[0]["id"] == 1


class TestFollowupMessage:
    def test_sequence_1_message(self, agent):
        lead = {"institution": "CoopTest", "contact_role": "CFO"}
        msg = agent.followup_message(lead, sequence=1)
        assert "CoopTest" in msg
        assert "CFO" in msg
        assert "seguimiento" in msg.lower()

    def test_sequence_2_is_final(self, agent):
        lead = {"institution": "CoopTest", "contact_role": "CFO"}
        msg = agent.followup_message(lead, sequence=2)
        assert "última" in msg.lower()
        assert "calendly" in msg.lower()
