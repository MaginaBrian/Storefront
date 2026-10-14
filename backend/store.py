from datetime import date

from flask import Blueprint, jsonify, request

from db import connect, query

bp = Blueprint("store", __name__)


def money(cents):
    return f"KES {cents / 100:,.2f}"


@bp.get("/api/customers")
def customers():
    return jsonify(query("SELECT * FROM customers ORDER BY spent DESC"))


def customers_for(rule):
    where = {
        "purchased": "orders >= 1",
        "repeat": "orders > 1",
        "never": "orders = 0",
    }.get(rule)
    if not where:
        return []
    return query(f"SELECT * FROM customers WHERE {where} ORDER BY spent DESC")


@bp.get("/api/segments")
def segments():
    return jsonify(query("SELECT * FROM segments ORDER BY id"))


@bp.get("/api/segments/<int:segment_id>")
def segment_detail(segment_id):
    found = query("SELECT * FROM segments WHERE id = ?", (segment_id,))
    if not found:
        return jsonify(error="Segment not found"), 404
    segment = found[0]
    return jsonify(segment=segment, customers=customers_for(segment["query"]))


@bp.post("/api/segments")
def create_segment():
    name = str((request.json or {}).get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a segment name."), 400
    with connect() as db:
        cur = db.execute(
            "INSERT INTO segments (name, query, percent, last_activity, created_by) VALUES (?, 'custom', 0, ?, 'Maison')",
            (name[:120], date.today().isoformat()),
        )
        segment_id = cur.lastrowid
    return jsonify(query("SELECT * FROM segments WHERE id = ?", (segment_id,))[0]), 201


@bp.get("/api/companies")
def companies():
    return jsonify(query("SELECT * FROM companies ORDER BY id DESC"))


@bp.post("/api/companies")
def create_company():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a company name."), 400
    submission = body.get("submission") if body.get("submission") in ("auto", "draft") else "auto"
    tax_settings = body.get("tax_settings") if body.get("tax_settings") in ("Collect tax", "Don't collect tax") else "Collect tax"
    terms = str(body.get("terms") or "No payment terms").strip() or "No payment terms"
    with connect() as db:
        cur = db.execute(
            """INSERT INTO companies (
                name, external_id, contact, address, city, location_id, billing_same, billing_address,
                market, terms, one_time_address, submission, tax_id, tax_settings, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                name[:120],
                str(body.get("external_id") or "").strip()[:80],
                str(body.get("contact") or "").strip()[:120],
                str(body.get("address") or "").strip()[:200],
                str(body.get("city") or "").strip()[:80],
                str(body.get("location_id") or "").strip()[:80],
                1 if body.get("billing_same", True) else 0,
                str(body.get("billing_address") or "").strip()[:200],
                str(body.get("market") or "Kenya").strip()[:40] or "Kenya",
                terms[:40],
                1 if body.get("one_time_address") else 0,
                submission,
                str(body.get("tax_id") or "").strip()[:40],
                tax_settings,
                date.today().isoformat(),
            ),
        )
        company_id = cur.lastrowid
    return jsonify(query("SELECT * FROM companies WHERE id = ?", (company_id,))[0]), 201


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
    for row in query("SELECT id, name FROM segments WHERE name LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "customers", "label": row["name"], "segment": row["id"]})
    for row in query("SELECT id, name FROM companies WHERE name LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "companies", "label": row["name"], "company": row["id"]})
    return jsonify(hits)

