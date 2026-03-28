"""Tests for CRMAgent — pipeline management and metrics."""

import pytest
from agents.crm_agent import CRMAgent, PIPELINE_STAGES


@pytest.fixture
def agent():
    crm = CRMAgent()
    crm._in_memory_leads = [
        {"id": 1, "institution": "CoopAhorro Mayaguez", "stage": "new", "notes": ""},
        {"id": 2, "institution": "CoopCredit Ponce", "stage": "contacted", "notes": ""},
        {"id": 3, "institution": "Federal Credit Bayamon", "stage": "demo_booked", "notes": ""},
        {"id": 4, "institution": "CoopAhorro San Juan", "stage": "closed_won", "notes": ""},
        {"id": 5, "institution": "CoopOriente Humacao", "stage": "closed_lost", "notes": ""},
    ]
    return crm


class TestUpdateStage:
    def test_valid_stage_transition(self, agent):
        result = agent.update_stage(1, "contacted")
        assert result["success"] is True
        assert result["stage"] == "contacted"

    def test_invalid_stage_rejected(self, agent):
        result = agent.update_stage(1, "invalid_stage")
        assert result["success"] is False
        assert "Invalid stage" in result["error"]

    def test_nonexistent_lead_rejected(self, agent):
        result = agent.update_stage(999, "contacted")
        assert result["success"] is False
        assert "not found" in result["error"]

    def test_all_valid_stages_accepted(self, agent):
        for stage in PIPELINE_STAGES:
            result = agent.update_stage(1, stage)
            assert result["success"] is True, f"Stage '{stage}' should be valid"

    def test_stage_updates_timestamp(self, agent):
        agent.update_stage(1, "contacted")
        lead = next(l for l in agent._in_memory_leads if l["id"] == 1)
        assert "updated_at" in lead


class TestAddNote:
    def test_append_note_to_existing(self, agent):
        agent._in_memory_leads[0]["notes"] = "Initial note"
        result = agent.add_note(1, "Follow-up call scheduled")
        assert result["success"] is True
        lead = agent._in_memory_leads[0]
        assert "Follow-up call scheduled" in lead["notes"]
        assert "Initial note" in lead["notes"]

    def test_first_note_on_empty(self, agent):
        result = agent.add_note(1, "First contact via email")
        assert result["success"] is True
        lead = agent._in_memory_leads[0]
        assert "First contact via email" in lead["notes"]

    def test_note_has_timestamp(self, agent):
        agent.add_note(1, "Demo completed")
        lead = agent._in_memory_leads[0]
        # Timestamp format: [YYYY-MM-DD HH:MM]
        assert "[202" in lead["notes"]

    def test_note_on_nonexistent_lead(self, agent):
        result = agent.add_note(999, "Ghost note")
        assert result["success"] is False


class TestPipelineMetrics:
    def test_metrics_with_mixed_stages(self, agent):
        metrics = agent.get_pipeline_metrics()
        assert metrics["total"] == 5
        assert metrics["closed_won"] == 1
        assert metrics["conversion_rate"] == "20.0%"

    def test_pipeline_value_calculation(self, agent):
        metrics = agent.get_pipeline_metrics()
        # contacted(1) + demo_booked(1) = 2 active × $750
        assert metrics["active_pipeline"] == 2
        assert metrics["pipeline_value"] == 1500

    def test_empty_pipeline_metrics(self, agent):
        metrics = agent.get_pipeline_metrics([])
        assert metrics["total"] == 0
        assert metrics["conversion_rate"] == "0%"
        assert metrics["pipeline_value"] == 0

    def test_all_closed_won(self):
        leads = [{"stage": "closed_won"} for _ in range(5)]
        agent = CRMAgent()
        metrics = agent.get_pipeline_metrics(leads)
        assert metrics["conversion_rate"] == "100.0%"
        assert metrics["pipeline_value"] == 0  # No active pipeline

    def test_all_active_stages(self):
        leads = [
            {"stage": "contacted"},
            {"stage": "replied"},
            {"stage": "demo_booked"},
            {"stage": "proposal"},
            {"stage": "negotiating"},
        ]
        agent = CRMAgent()
        metrics = agent.get_pipeline_metrics(leads)
        assert metrics["active_pipeline"] == 5
        assert metrics["pipeline_value"] == 3750
