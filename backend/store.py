from flask import Blueprint, jsonify, request

from db import connect, query

bp = Blueprint("store", __name__)


def money(cents):
    return f"KES {cents / 100:,.2f}"


@bp.get("/api/customers")
def customers():
    return jsonify(query("SELECT * FROM customers ORDER BY spent DESC"))


@bp.get("/api/discounts")
def discounts():
    return jsonify(query("SELECT * FROM discounts ORDER BY id"))


@bp.get("/api/content")
def content():
    return jsonify(query("SELECT * FROM pages ORDER BY id"))


@bp.get("/api/markets")
def markets():
    return jsonify(query("SELECT * FROM markets ORDER BY id"))


@bp.get("/api/growth")
def growth():
    return jsonify(query("SELECT * FROM campaigns ORDER BY id"))


@bp.get("/api/store")
def store():
    return jsonify(query("SELECT domain, theme, status FROM store WHERE id = 1")[0])


@bp.get("/api/agentic")
def agentic():
    return jsonify(query("SELECT conversations, resolved, handoff FROM agentic WHERE id = 1")[0])


@bp.get("/api/settings")
def settings():
    return jsonify(query("SELECT key, value, label FROM settings ORDER BY sort"))


@bp.patch("/api/settings")
def update_settings():
    body = request.json or {}
    allowed = {row["key"] for row in query("SELECT key FROM settings")}
    updates = {k: str(v).strip() for k, v in body.items() if k in allowed}
    if not updates:
        return jsonify(error="Nothing to update"), 400
    with connect() as db:
        for key, value in updates.items():
            db.execute("UPDATE settings SET value = ? WHERE key = ?", (value, key))
    return jsonify(query("SELECT key, value, label FROM settings ORDER BY sort"))


@bp.get("/api/dashboard")
def dashboard():
    kpis = query("SELECT label, value, note, good, tone FROM kpis ORDER BY sort")
    for kpi in kpis:
        kpi["good"] = bool(kpi["good"])
    recent = []
    for order in query("SELECT id, customer, created_at, total, fulfillment FROM orders ORDER BY created_at DESC LIMIT 4"):
        recent.append({
            "id": order["id"],
            "customer": order["customer"],
            "date": order["created_at"][:10],
            "amount": money(order["total"]),
            "status": "Fulfilled" if order["fulfillment"] == "fulfilled" else "Unfulfilled",
        })
    top = []
    for product in query("SELECT title, sold, price FROM products ORDER BY sold DESC LIMIT 4"):
        top.append({
            "title": product["title"],
            "sold": product["sold"],
            "sales": money(product["price"] * product["sold"]),
        })
    return jsonify(
        kpis=kpis,
        channels=query("SELECT name, orders, sales, delta, view FROM channels"),
        week=[[row["day"], row["amount"]] for row in query("SELECT day, amount FROM week ORDER BY sort")],
        recent=recent,
        top=top,
    )


@bp.get("/api/analytics")
def analytics():
    return jsonify(
        channels=query("SELECT name, orders, sales, delta, view FROM channels"),
        week=[[row["day"], row["amount"]] for row in query("SELECT day, amount FROM week ORDER BY sort")],
    )


@bp.get("/api/search")
def search():
    term = str(request.args.get("q") or "").strip()
    if len(term) < 2:
        return jsonify([])
    like = f"%{term}%"
    hits = []
    for row in query("SELECT id, customer FROM orders WHERE customer LIKE ? OR CAST(id AS TEXT) LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "orders", "label": f"Order #{row['id']} · {row['customer']}", "order": row["id"]})
    for row in query("SELECT id, customer FROM drafts WHERE customer LIKE ? OR id LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "drafts", "label": f"Draft #{row['id']} · {row['customer']}", "draft": row["id"]})
    for row in query("SELECT title FROM products WHERE title LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "products", "label": row["title"], "product": row["title"]})
    for row in query("SELECT id, title FROM collections WHERE title LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "collections", "label": row["title"], "collection": row["id"]})
    for row in query("SELECT id, product, variant FROM inventory WHERE product LIKE ? OR variant LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "inventory", "label": f"{row['product']} · {row['variant']}", "item": row["id"]})
    for row in query("SELECT name FROM customers WHERE name LIKE ? OR email LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "customers", "label": row["name"], "customer": row["name"]})
    return jsonify(hits)

