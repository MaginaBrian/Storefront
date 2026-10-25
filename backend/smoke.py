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
    print("smoke ok")


if __name__ == "__main__":
    main()
