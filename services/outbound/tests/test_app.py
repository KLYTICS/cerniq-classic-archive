"""Tests for the FastAPI outbound engine endpoints."""

import pytest
from fastapi.testclient import TestClient
from app import app


@pytest.fixture
def client():
    return TestClient(app)


class TestHealthAndRoot:
    def test_root_returns_service_info(self, client):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["service"] == "CERNIQ Outbound Engine"
        assert "endpoints" in data

    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestLeadManagement:
    def test_add_lead(self, client):
        lead = {
            "institution": "CoopTest",
            "institution_type": "cooperativa",
            "contact_name": "Ana Rivera",
            "role": "CFO",
            "email": "ana@cooptest.com",
            "location": "Mayaguez",
            "region": "West",
            "estimated_assets": 150_000_000,
        }
        response = client.post("/leads/add", json=lead)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "created"
        assert data["lead_id"] > 0

    def test_list_leads(self, client):
        # Add a lead first
        client.post("/leads/add", json={"institution": "ListTest", "institution_type": "cooperativa"})
        response = client.get("/leads")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert isinstance(data["leads"], list)

    def test_list_leads_filter_by_stage(self, client):
        response = client.get("/leads?stage=new")
        assert response.status_code == 200

    def test_seed_leads(self, client):
        response = client.post("/leads/seed")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "seeded"
        assert "added" in data
        assert "total" in data


class TestOutreach:
    def test_preview_message(self, client):
        preview = {
            "institution": "CoopAhorro Ponce",
            "contact_role": "CFO",
            "estimated_assets": 200_000_000,
            "lang": "es",
        }
        response = client.post("/outreach/preview", json=preview)
        assert response.status_code == 200
        data = response.json()
        assert "subject" in data
        assert "body" in data
        assert "CoopAhorro Ponce" in data["subject"]

    def test_preview_english(self, client):
        preview = {
            "institution": "Federal Credit Union",
            "lang": "en",
        }
        response = client.post("/outreach/preview", json=preview)
        assert response.status_code == 200
        assert "Federal Credit Union" in response.json()["subject"]


class TestMetrics:
    def test_pipeline_metrics(self, client):
        response = client.get("/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "total" in data

    def test_region_metrics(self, client):
        response = client.get("/metrics/regions")
        assert response.status_code == 200
        data = response.json()
        assert "regions" in data
        assert "total" in data
