from pathlib import Path

from flask import Flask, send_from_directory
from flask_cors import CORS

from catalog import bp as catalog_bp
from db import init_db
from drafts import bp as drafts_bp
from orders import bp as orders_bp
from store import bp as store_bp

DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = Flask(__name__)
CORS(app)
app.register_blueprint(orders_bp)
app.register_blueprint(drafts_bp)
app.register_blueprint(catalog_bp)
app.register_blueprint(store_bp)
init_db()


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/")
def index():
    if (DIST / "index.html").is_file():
        return send_from_directory(DIST, "index.html")
    return {"ok": True}


@app.get("/<path:path>")
def frontend(path):
    if path == "api" or path.startswith("api/"):
        return {"error": "Not found"}, 404
    target = DIST / path
    if path and target.is_file():
        return send_from_directory(DIST, path)
    if (DIST / "index.html").is_file():
        return send_from_directory(DIST, "index.html")
    return {"error": "Not found"}, 404


if __name__ == "__main__":
    app.run(port=5000, debug=True)
