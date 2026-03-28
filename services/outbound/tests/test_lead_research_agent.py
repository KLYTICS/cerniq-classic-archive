"""Tests for LeadResearchAgent — seed data loading and filtering."""

import os
import tempfile
import csv
import pytest
from agents.lead_research_agent import LeadResearchAgent


@pytest.fixture
def seed_csv():
    """Create a temp CSV with test cooperativa data."""
    rows = [
        {"institution": "CoopAhorro Mayaguez", "institution_type": "cooperativa", "location": "Mayaguez", "estimated_assets": "250000000", "region": "West", "contact_role": "CFO", "public_data_source": "cossec"},
        {"institution": "CoopCredit Ponce", "institution_type": "cooperativa", "location": "Ponce", "estimated_assets": "180000000", "region": "South", "contact_role": "CFO", "public_data_source": "cossec"},
        {"institution": "Federal Credit Bayamon", "institution_type": "credit_union", "location": "Bayamon", "estimated_assets": "50000000", "region": "Metro", "contact_role": "Director Financiero", "public_data_source": "ncua"},
        {"institution": "CoopOriental Humacao", "institution_type": "cooperativa", "location": "Humacao", "estimated_assets": "320000000", "region": "East", "contact_role": "CFO", "public_data_source": "cossec"},
    ]
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
        path = f.name
    yield path
    os.unlink(path)


@pytest.fixture
def agent(seed_csv):
    return LeadResearchAgent(csv_path=seed_csv)


class TestLoadSeedData:
    def test_loads_all_rows(self, agent):
        leads = agent.load_seed_data()
        assert len(leads) == 4

    def test_parses_institution_name(self, agent):
        leads = agent.load_seed_data()
        names = [l["institution"] for l in leads]
        assert "CoopAhorro Mayaguez" in names

    def test_parses_assets_as_int(self, agent):
        leads = agent.load_seed_data()
        assert leads[0]["estimated_assets"] == 250_000_000
        assert isinstance(leads[0]["estimated_assets"], int)

    def test_handles_missing_csv(self):
        agent = LeadResearchAgent(csv_path="/nonexistent/path.csv")
        leads = agent.load_seed_data()
        assert leads == []


class TestFiltering:
    def test_filter_by_region(self, agent):
        leads = agent.load_seed_data()
        west = agent.filter_by_region(leads, "West")
        assert len(west) == 1
        assert west[0]["institution"] == "CoopAhorro Mayaguez"

    def test_filter_by_region_case_insensitive(self, agent):
        leads = agent.load_seed_data()
        assert len(agent.filter_by_region(leads, "west")) == 1
        assert len(agent.filter_by_region(leads, "WEST")) == 1

    def test_filter_by_asset_threshold(self, agent):
        leads = agent.load_seed_data()
        large = agent.filter_by_asset_threshold(leads, 200_000_000)
        assert len(large) == 2  # Mayaguez (250M) + Oriental (320M)

    def test_filter_returns_empty_for_high_threshold(self, agent):
        leads = agent.load_seed_data()
        assert agent.filter_by_asset_threshold(leads, 999_000_000) == []


class TestExpandContacts:
    def test_expands_to_5_roles(self, agent):
        leads = [{"institution": "TestCoop", "contact_role": "CFO"}]
        expanded = agent.expand_contacts(leads)
        assert len(expanded) == 5
        roles = {l["contact_role"] for l in expanded}
        assert "CFO" in roles
        assert "Presidente" in roles
        assert "Controller" in roles

    def test_preserves_institution_data(self, agent):
        leads = [{"institution": "TestCoop", "region": "Metro", "estimated_assets": 100}]
        expanded = agent.expand_contacts(leads)
        assert all(l["institution"] == "TestCoop" for l in expanded)
        assert all(l["estimated_assets"] == 100 for l in expanded)


class TestGenerateLeads:
    def test_generate_all(self, agent):
        leads = agent.generate_leads()
        assert len(leads) == 4

    def test_generate_filtered_by_region(self, agent):
        leads = agent.generate_leads(region="Metro")
        assert len(leads) == 1
        assert leads[0]["region"] == "Metro"

    def test_generate_filtered_by_min_assets(self, agent):
        leads = agent.generate_leads(min_assets=200_000_000)
        assert len(leads) == 2

    def test_generate_combined_filters(self, agent):
        leads = agent.generate_leads(region="East", min_assets=100_000_000)
        assert len(leads) == 1
        assert leads[0]["institution"] == "CoopOriental Humacao"
