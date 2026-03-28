"""Tests for EnrichmentAgent — lead scoring and email pattern generation."""

import pytest
from agents.enrichment_agent import EnrichmentAgent


@pytest.fixture
def agent():
    return EnrichmentAgent()


class TestEnrich:
    def test_fallback_to_pattern_email(self, agent):
        lead = {"institution": "CoopAhorro Ponce", "contact_role": "CFO"}
        result = agent.enrich(lead)
        assert result["email"] is not None
        assert "@" in result["email"]
        assert result["enrichment_source"] == "pattern"

    def test_preserves_existing_lead_data(self, agent):
        lead = {"institution": "TestCoop", "estimated_assets": 200_000_000, "contact_role": "CFO"}
        result = agent.enrich(lead)
        assert result["institution"] == "TestCoop"
        assert result["estimated_assets"] == 200_000_000

    def test_batch_enrichment(self, agent):
        leads = [
            {"institution": "CoopA", "contact_role": "CFO"},
            {"institution": "CoopB", "contact_role": "Director"},
        ]
        results = agent.enrich_batch(leads)
        assert len(results) == 2
        assert all("email" in r or "enrichment_error" in r for r in results)


class TestEmailPattern:
    def test_cfo_gets_finanzas_email(self, agent):
        lead = {"institution": "CoopAhorro Ponce", "contact_role": "CFO"}
        email = agent._generate_email_pattern(lead)
        assert email.startswith("finanzas@")

    def test_director_gets_director_email(self, agent):
        lead = {"institution": "CoopAhorro Ponce", "contact_role": "Director Financiero"}
        email = agent._generate_email_pattern(lead)
        assert email.startswith("director@")

    def test_other_roles_get_info_email(self, agent):
        lead = {"institution": "CoopAhorro Ponce", "contact_role": "Presidente"}
        email = agent._generate_email_pattern(lead)
        assert email.startswith("info@")

    def test_strips_cooperativa_prefix(self, agent):
        lead = {"institution": "Cooperativa de Ahorro y Crédito de Ponce", "contact_role": "CFO"}
        email = agent._generate_email_pattern(lead)
        assert "cooperativa" not in email.lower().split("@")[1]

    def test_empty_institution_returns_none(self, agent):
        lead = {"institution": "", "contact_role": "CFO"}
        assert agent._generate_email_pattern(lead) is None


class TestLeadScoring:
    def test_base_score_is_50(self, agent):
        lead = {"estimated_assets": 100_000_000}
        score = agent.score_lead(lead)
        assert 40 <= score <= 60

    def test_large_institution_scores_higher(self, agent):
        small = agent.score_lead({"estimated_assets": 30_000_000})
        large = agent.score_lead({"estimated_assets": 350_000_000})
        assert large > small

    def test_metro_region_bonus(self, agent):
        metro = agent.score_lead({"estimated_assets": 100_000_000, "region": "Metro"})
        rural = agent.score_lead({"estimated_assets": 100_000_000, "region": "Islands"})
        assert metro > rural

    def test_cfo_role_bonus(self, agent):
        cfo = agent.score_lead({"estimated_assets": 100_000_000, "contact_role": "CFO"})
        generic = agent.score_lead({"estimated_assets": 100_000_000, "contact_role": "Receptionist"})
        assert cfo > generic

    def test_enriched_lead_scores_higher(self, agent):
        bare = agent.score_lead({"estimated_assets": 100_000_000})
        enriched = agent.score_lead({"estimated_assets": 100_000_000, "email": "cfo@coop.pr", "linkedin": "linkedin.com/in/cfo"})
        assert enriched > bare

    def test_score_clamped_1_to_100(self, agent):
        # Max everything
        score = agent.score_lead({
            "estimated_assets": 500_000_000,
            "region": "Metro",
            "contact_role": "CFO",
            "email": "x",
            "linkedin": "x",
        })
        assert score <= 100
        # Min everything
        score = agent.score_lead({"estimated_assets": 10_000_000})
        assert score >= 1
