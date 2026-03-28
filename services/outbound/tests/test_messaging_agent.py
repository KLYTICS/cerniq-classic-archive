"""Tests for MessagingAgent — bilingual outreach email generation."""

import pytest
from agents.messaging_agent import MessagingAgent


@pytest.fixture
def agent():
    return MessagingAgent()


@pytest.fixture
def sample_lead():
    return {
        "institution": "CoopAhorro Mayaguez",
        "contact_role": "CFO",
        "estimated_assets": 250_000_000,
    }


class TestColdEmail:
    def test_spanish_cold_email(self, agent, sample_lead):
        result = agent.generate_cold_email(sample_lead, lang="es")
        assert result["lang"] == "es"
        assert result["type"] == "cold"
        assert "CoopAhorro Mayaguez" in result["subject"]
        assert "Informe ALM" in result["subject"]
        assert "CFO" in result["body"]
        assert "$250M" in result["body"]

    def test_english_cold_email(self, agent, sample_lead):
        result = agent.generate_cold_email(sample_lead, lang="en")
        assert result["lang"] == "en"
        assert "Free ALM Report" in result["subject"]
        assert "CoopAhorro Mayaguez" in result["subject"]
        assert "$250M" in result["body"]

    def test_cold_email_without_assets(self, agent):
        lead = {"institution": "Test Coop", "contact_role": "Director"}
        result = agent.generate_cold_email(lead, lang="en")
        assert "At $0M" not in result["body"]
        assert "Test Coop" in result["body"]

    def test_cold_email_default_lang_is_spanish(self, agent, sample_lead):
        result = agent.generate_cold_email(sample_lead)
        assert result["lang"] == "es"

    def test_cold_email_includes_cerniq_branding(self, agent, sample_lead):
        result = agent.generate_cold_email(sample_lead, lang="en")
        assert "CERNIQ" in result["body"]
        assert "Erwin Kiess" in result["body"]

    def test_cold_email_returns_dict_with_required_keys(self, agent, sample_lead):
        result = agent.generate_cold_email(sample_lead, lang="en")
        assert "subject" in result
        assert "body" in result
        assert "type" in result
        assert "lang" in result


class TestFollowup:
    def test_followup_sequence_1_spanish(self, agent, sample_lead):
        result = agent.generate_followup(sample_lead, sequence=1, lang="es")
        assert result["type"] == "followup_1"
        assert "Re:" in result["subject"]
        assert "seguimiento" in result["body"].lower()

    def test_followup_sequence_1_english(self, agent, sample_lead):
        result = agent.generate_followup(sample_lead, sequence=1, lang="en")
        assert "Re:" in result["subject"]
        assert "following up" in result["body"].lower()

    def test_followup_sequence_2_is_final(self, agent, sample_lead):
        result = agent.generate_followup(sample_lead, sequence=2, lang="es")
        assert result["type"] == "followup_2"
        assert "última" in result["body"].lower() or "último" in result["subject"].lower()

    def test_final_english_includes_calendly(self, agent, sample_lead):
        result = agent.generate_followup(sample_lead, sequence=2, lang="en")
        assert "calendly" in result["body"].lower()

    def test_followup_personalizes_institution(self, agent, sample_lead):
        result = agent.generate_followup(sample_lead, sequence=1, lang="en")
        assert "CoopAhorro Mayaguez" in result["body"]


class TestLegacyInterface:
    def test_generate_email_returns_string(self, agent, sample_lead):
        result = agent.generate_email(sample_lead, lang="en")
        assert isinstance(result, str)
        assert "CERNIQ" in result

    def test_generate_email_default_spanish(self, agent, sample_lead):
        result = agent.generate_email(sample_lead)
        assert "Estimado" in result
