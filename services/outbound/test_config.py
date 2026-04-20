import importlib
import sys

import pytest


def _reload_config_module(monkeypatch):
    monkeypatch.setattr("dotenv.load_dotenv", lambda *args, **kwargs: None)
    sys.modules.pop("config", None)
    return importlib.import_module("config")


def test_config_requires_outbound_database_url(monkeypatch):
    monkeypatch.delenv("OUTBOUND_DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="OUTBOUND_DATABASE_URL is required."):
        _reload_config_module(monkeypatch)


def test_config_uses_outbound_database_url(monkeypatch):
    monkeypatch.setenv(
        "OUTBOUND_DATABASE_URL",
        "postgresql://localhost:5432/cerniq_outbound",
    )

    module = _reload_config_module(monkeypatch)

    assert module.config.DATABASE_URL == "postgresql://localhost:5432/cerniq_outbound"
