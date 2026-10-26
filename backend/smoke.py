"""CI check: the API answers, and the built admin is served when dist exists."""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("STOREFRONT_DB", "/tmp/piaci-ci.db")

from app import app  # noqa: E402


def main():
    client = app.test_client()
    health = client.get("/api/health")
    assert health.status_code == 200, health.status_code
    assert health.get_json()["ok"] is True
    orders = client.get("/api/orders")
    assert orders.status_code == 200, orders.status_code
    assert isinstance(orders.get_json(), list)
    index = ROOT.parent / "frontend" / "dist" / "index.html"
    if index.is_file():
        page = client.get("/")
        assert page.status_code == 200, page.status_code
        assert b'id="root"' in page.data
        asset = client.get("/does-not-exist")
        assert asset.status_code == 200
        missing = client.get("/api/does-not-exist")
        assert missing.status_code == 404
    created = client.post("/api/integrations/cosine", json={
        "ref": "CC-9001",
        "customer": "MWOTAJI",
        "contact": "Muli",
        "email": "mwotaji@cosinecreate.com",
        "phone": "+254710314337",
        "created_at": "2026-10-25T18:00:00+00:00",
        "lines": [
            {"title": "Oversized T-shirt", "size": "L", "color": "Black", "qty": 2, "price": 0},
            {"title": "B1976 (kg)", "size": "", "color": "Black", "qty": 3, "price": 126700},
        ],
    })
    assert created.status_code == 201, created.status_code
    body = created.get_json()
    assert body["total"] == 380100
    assert body["items"] == 5
    assert body["external_ref"] == "CC-9001"
    again = client.post("/api/integrations/cosine", json={
        "ref": "CC-9001",
        "customer": "MWOTAJI",
        "email": "mwotaji@cosinecreate.com",
        "phone": "+254710314337",
        "lines": [{"title": "Oversized T-shirt", "size": "M", "color": "Black", "qty": 4, "price": 0}],
    })
    assert again.status_code == 200
    assert again.get_json()["items"] == 4
    assert again.get_json()["total"] == 0
    removed = client.delete("/api/integrations/cosine/CC-9001")
    assert removed.status_code == 200
    assert removed.get_json()["removed"] is True
    print("smoke ok")


if __name__ == "__main__":
    main()
