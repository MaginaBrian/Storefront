import json
import re
import secrets
from datetime import date

from flask import Blueprint, jsonify, request

from db import connect, query

bp = Blueprint("store", __name__)


def money(cents):
    return f"KES {cents / 100:,.2f}"


@bp.get("/api/customers")
def customers():
    return jsonify(query("SELECT * FROM customers ORDER BY spent DESC"))


def customer_name(body):
    first = str(body.get("first_name") or "").strip()
    last = str(body.get("last_name") or "").strip()
    return str(body.get("name") or f"{first} {last}").strip()


def insert_customer(db, body):
    name = customer_name(body)
    if not name:
        return None
    email = str(body.get("email") or "").strip()
    location = str(body.get("location") or body.get("city") or "Nairobi").strip() or "Nairobi"
    cur = db.execute(
        """INSERT INTO customers (
            name, email, location, orders, spent, phone, language, subscribed, sms, whatsapp, note, tags, address, tax_settings
        ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            name[:120],
            email,
            location,
            str(body.get("phone") or "").strip(),
            str(body.get("language") or "English").strip() or "English",
            1 if body.get("email_marketing") else 0,
            1 if body.get("sms") else 0,
            1 if body.get("whatsapp") else 0,
            str(body.get("note") or "").strip(),
            str(body.get("tags") or "").strip(),
            str(body.get("address") or "").strip(),
            body.get("tax_settings") if body.get("tax_settings") in ("Collect tax", "Don't collect tax") else "Collect tax",
        ),
    )
    return dict(db.execute("SELECT * FROM customers WHERE id = ?", (cur.lastrowid,)).fetchone())


@bp.post("/api/customers")
def create_customer():
    body = request.json or {}
    rows = body.get("customers") if isinstance(body.get("customers"), list) else [body]
    saved = []
    with connect() as db:
        for item in rows:
            row = insert_customer(db, item or {})
            if row:
                saved.append(row)
    if not saved:
        return jsonify(error="Enter a customer name."), 400
    return jsonify(saved[0] if len(saved) == 1 and "customers" not in body else saved), 201


def customers_for(rule):
    where = {
        "purchased": "orders >= 1",
        "repeat": "orders > 1",
        "never": "orders = 0",
        "subscribers": "subscribed = 1",
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
            "INSERT INTO segments (name, query, percent, last_activity, created_by) VALUES (?, 'custom', 0, ?, 'Piacì')",
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


DISCOUNT_KINDS = (
    "Amount off products", "Buy X get Y", "Amount off order", "Free shipping",
    "Percentage", "Fixed amount",
)


def discount_fields(body):
    kind = str(body.get("kind") or "").strip()
    if kind not in DISCOUNT_KINDS:
        kind = "Amount off products"
    method = "automatic" if body.get("method") == "automatic" else "code"
    title = str(body.get("title") or "").strip()
    code = title if method == "automatic" else str(body.get("code") or "").strip().upper()
    value = str(body.get("value") or "").strip()
    if kind == "Free shipping" and not value:
        value = "Shipping"
    config = body.get("config") if isinstance(body.get("config"), dict) else {}
    if not code:
        message = "Enter a title customers will see." if method == "automatic" else "Enter a discount code."
        return None, message
    if kind != "Free shipping" and not value:
        return None, "Enter a discount value."
    return {
        "code": code[:40],
        "kind": kind,
        "value": value[:80],
        "method": method,
        "config": json.dumps(config),
    }, None


@bp.get("/api/discounts")
def discounts():
    return jsonify(query("SELECT * FROM discounts ORDER BY id"))


@bp.get("/api/discounts/<int:discount_id>")
def discount(discount_id):
    rows = query("SELECT * FROM discounts WHERE id = ?", (discount_id,))
    if not rows:
        return jsonify(error="Discount not found"), 404
    return jsonify(rows[0])


@bp.post("/api/discounts")
def create_discount():
    fields, error = discount_fields(request.json or {})
    if error:
        return jsonify(error=error), 400
    with connect() as db:
        cur = db.execute(
            """INSERT INTO discounts (code, kind, value, status, uses, method, config)
               VALUES (?, ?, ?, 'active', 0, ?, ?)""",
            (fields["code"], fields["kind"], fields["value"], fields["method"], fields["config"]),
        )
        discount_id = cur.lastrowid
    return jsonify(query("SELECT * FROM discounts WHERE id = ?", (discount_id,))[0]), 201


@bp.patch("/api/discounts/<int:discount_id>")
def update_discount(discount_id):
    if not query("SELECT id FROM discounts WHERE id = ?", (discount_id,)):
        return jsonify(error="Discount not found"), 404
    fields, error = discount_fields(request.json or {})
    if error:
        return jsonify(error=error), 400
    with connect() as db:
        db.execute(
            "UPDATE discounts SET code = ?, kind = ?, value = ?, method = ?, config = ? WHERE id = ?",
            (fields["code"], fields["kind"], fields["value"], fields["method"], fields["config"], discount_id),
        )
    return jsonify(query("SELECT * FROM discounts WHERE id = ?", (discount_id,))[0])


@bp.get("/api/files")
def files():
    return jsonify(query("SELECT * FROM files ORDER BY id DESC"))


@bp.post("/api/files")
def create_file():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a file name or URL."), 400
    kind = str(body.get("kind") or "File").strip() or "File"
    with connect() as db:
        cur = db.execute(
            "INSERT INTO files (name, kind, source, created_at) VALUES (?, ?, ?, ?)",
            (name[:180], kind[:40], str(body.get("source") or "").strip()[:300], date.today().isoformat()),
        )
        file_id = cur.lastrowid
    return jsonify(query("SELECT * FROM files WHERE id = ?", (file_id,))[0]), 201


@bp.get("/api/metaobjects")
def metaobjects():
    entries = query("SELECT * FROM meta_entries ORDER BY id")
    definitions = query("SELECT * FROM meta_definitions ORDER BY id")
    active = sum(1 for row in entries if row["status"] == "active")
    return jsonify(
        entries=entries,
        definitions=definitions,
        available=active,
        active=active,
        draft=sum(1 for row in entries if row["status"] == "draft"),
        web_pages=0,
    )


@bp.post("/api/metaobjects/definitions")
def create_definition():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a definition name."), 400
    with connect() as db:
        cur = db.execute(
            "INSERT INTO meta_definitions (name, type) VALUES (?, ?)",
            (name[:80], str(body.get("type") or "Custom").strip()[:40] or "Custom"),
        )
        definition_id = cur.lastrowid
    return jsonify(query("SELECT * FROM meta_definitions WHERE id = ?", (definition_id,))[0]), 201


@bp.get("/api/menus")
def menus():
    return jsonify(query("SELECT * FROM menus ORDER BY id"))


@bp.post("/api/menus")
def create_menu():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    items = str(body.get("items") or "").strip()
    if not name:
        return jsonify(error="Enter a menu name."), 400
    with connect() as db:
        cur = db.execute("INSERT INTO menus (name, items) VALUES (?, ?)", (name[:80], items[:200]))
        menu_id = cur.lastrowid
    return jsonify(query("SELECT * FROM menus WHERE id = ?", (menu_id,))[0]), 201


@bp.get("/api/blog-posts")
def blog_posts():
    return jsonify(query("SELECT * FROM blog_posts ORDER BY id DESC"))


@bp.post("/api/blog-posts")
def create_blog_post():
    body = request.json or {}
    title = str(body.get("title") or "").strip()
    if not title:
        return jsonify(error="Enter a title."), 400
    with connect() as db:
        cur = db.execute(
            "INSERT INTO blog_posts (title, body, blog, created_at) VALUES (?, ?, ?, ?)",
            (title[:140], str(body.get("body") or "").strip()[:4000], "News", date.today().isoformat()),
        )
        post_id = cur.lastrowid
    return jsonify(query("SELECT * FROM blog_posts WHERE id = ?", (post_id,))[0]), 201


@bp.get("/api/catalog-items")
def catalog_items():
    return jsonify(query("SELECT * FROM catalog_items ORDER BY id"))


@bp.get("/api/market-catalogs")
def market_catalogs():
    return jsonify(query("SELECT * FROM market_catalogs ORDER BY id DESC"))


@bp.post("/api/market-catalogs")
def create_market_catalog():
    body = request.json or {}
    title = str(body.get("title") or "").strip()
    if not title:
        return jsonify(error="Enter a catalog title."), 400
    market = str(body.get("market") or "Kenya").strip() or "Kenya"
    with connect() as db:
        cur = db.execute(
            "INSERT INTO market_catalogs (title, market, created_at) VALUES (?, ?, ?)",
            (title[:120], market[:40], date.today().isoformat()),
        )
        catalog_id = cur.lastrowid
    return jsonify(query("SELECT * FROM market_catalogs WHERE id = ?", (catalog_id,))[0]), 201


def rollout_fields(body):
    name = str(body.get("name") or "").strip() or "New rollout"
    note = str(body.get("note") or "").strip()
    status = body.get("status") if body.get("status") in ("draft", "scheduled") else "scheduled"
    config = body.get("config") if isinstance(body.get("config"), dict) else {}
    return name[:120], note[:500], status, json.dumps(config)


@bp.get("/api/rollouts")
def rollouts():
    return jsonify(query("SELECT * FROM rollouts ORDER BY id DESC"))


@bp.get("/api/rollouts/<int:rollout_id>")
def rollout(rollout_id):
    rows = query("SELECT * FROM rollouts WHERE id = ?", (rollout_id,))
    if not rows:
        return jsonify(error="Rollout not found"), 404
    return jsonify(rows[0])


@bp.post("/api/rollouts")
def create_rollout():
    name, note, status, config = rollout_fields(request.json or {})
    with connect() as db:
        cur = db.execute(
            "INSERT INTO rollouts (name, note, created_at, status, config) VALUES (?, ?, ?, ?, ?)",
            (name, note, date.today().isoformat(), status, config),
        )
        rollout_id = cur.lastrowid
    return jsonify(query("SELECT * FROM rollouts WHERE id = ?", (rollout_id,))[0]), 201


@bp.patch("/api/rollouts/<int:rollout_id>")
def update_rollout(rollout_id):
    if not query("SELECT id FROM rollouts WHERE id = ?", (rollout_id,)):
        return jsonify(error="Rollout not found"), 404
    name, note, status, config = rollout_fields(request.json or {})
    with connect() as db:
        db.execute(
            "UPDATE rollouts SET name = ?, note = ?, status = ?, config = ? WHERE id = ?",
            (name, note, status, config, rollout_id),
        )
    return jsonify(query("SELECT * FROM rollouts WHERE id = ?", (rollout_id,))[0])


@bp.get("/api/content")
def content():
    return jsonify(query("SELECT * FROM pages ORDER BY id"))


@bp.get("/api/markets")
def markets():
    return jsonify(query("SELECT * FROM markets ORDER BY id"))


@bp.post("/api/markets")
def create_market():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a market name."), 400
    currency = str(body.get("currency") or "USD").strip().upper()[:8] or "USD"
    with connect() as db:
        existing = db.execute("SELECT id FROM markets WHERE name = ?", (name,)).fetchone()
        if existing:
            return jsonify(query("SELECT * FROM markets WHERE id = ?", (existing["id"],))[0])
        cur = db.execute(
            "INSERT INTO markets (name, currency, status) VALUES (?, ?, 'active')",
            (name[:80], currency),
        )
        market_id = cur.lastrowid
    return jsonify(query("SELECT * FROM markets WHERE id = ?", (market_id,))[0]), 201


@bp.patch("/api/markets/<int:market_id>")
def update_market(market_id):
    body = request.json or {}
    found = query("SELECT * FROM markets WHERE id = ?", (market_id,))
    if not found:
        return jsonify(error="Market not found"), 404
    name = str(body.get("name") or found[0]["name"]).strip() or found[0]["name"]
    status = body.get("status") if body.get("status") in ("active", "draft") else found[0]["status"]
    with connect() as db:
        db.execute("UPDATE markets SET name = ?, status = ? WHERE id = ?", (name[:80], status, market_id))
    return jsonify(query("SELECT * FROM markets WHERE id = ?", (market_id,))[0])


@bp.get("/api/growth")
def growth():
    return jsonify(query("SELECT * FROM campaigns ORDER BY id"))


@bp.get("/api/campaigns")
def marketing_campaigns():
    return jsonify(query("SELECT id, name, status, created_at FROM marketing_campaigns ORDER BY created_at DESC"))


@bp.get("/api/campaigns/<campaign_id>")
def marketing_campaign(campaign_id):
    rows = query("SELECT id, name, status, created_at FROM marketing_campaigns WHERE id = ?", (campaign_id,))
    if not rows:
        return jsonify(error="Campaign not found"), 404
    return jsonify(rows[0])


@bp.post("/api/campaigns")
def create_marketing_campaign():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a campaign name."), 400
    cid = str(body.get("id") or "").strip().lower()
    if not re.fullmatch(r"[a-f0-9]{6}", cid):
        cid = secrets.token_hex(3)
    with connect() as db:
        if db.execute("SELECT id FROM marketing_campaigns WHERE id = ?", (cid,)).fetchone():
            return jsonify(error="That campaign id is already in use."), 409
        db.execute(
            "INSERT INTO marketing_campaigns (id, name, status, created_at) VALUES (?, ?, 'draft', ?)",
            (cid, name[:140], date.today().isoformat()),
        )
    return jsonify(query("SELECT id, name, status, created_at FROM marketing_campaigns WHERE id = ?", (cid,))[0]), 201


@bp.patch("/api/campaigns/<campaign_id>")
def update_marketing_campaign(campaign_id):
    found = query("SELECT * FROM marketing_campaigns WHERE id = ?", (campaign_id,))
    if not found:
        return jsonify(error="Campaign not found"), 404
    name = str((request.json or {}).get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a campaign name."), 400
    with connect() as db:
        db.execute("UPDATE marketing_campaigns SET name = ? WHERE id = ?", (name[:140], campaign_id))
    return jsonify(query("SELECT id, name, status, created_at FROM marketing_campaigns WHERE id = ?", (campaign_id,))[0])


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


@bp.get("/api/reports")
def reports():
    return jsonify(query("SELECT * FROM reports ORDER BY id"))


@bp.post("/api/reports")
def create_report():
    body = request.json or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Enter a report name."), 400
    category = str(body.get("category") or "Sales").strip() or "Sales"
    with connect() as db:
        cur = db.execute(
            "INSERT INTO reports (name, category, last_viewed, created_by) VALUES (?, ?, ?, 'Piacì')",
            (name[:140], category[:40], date.today().isoformat()),
        )
        report_id = cur.lastrowid
    return jsonify(query("SELECT * FROM reports WHERE id = ?", (report_id,))[0]), 201


@bp.delete("/api/reports/<int:report_id>")
def delete_report(report_id):
    if not query("SELECT id FROM reports WHERE id = ?", (report_id,)):
        return jsonify(error="Report not found"), 404
    with connect() as db:
        db.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    return jsonify(ok=True)


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
    for row in query("SELECT id, name FROM menus WHERE name LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "menus", "label": row["name"], "menu": row["id"]})
    for row in query("SELECT name FROM meta_entries WHERE name LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "metaobjects", "label": row["name"], "entry": row["name"]})
    for row in query("SELECT name FROM markets WHERE name LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "markets", "label": row["name"], "market": row["name"]})
    for row in query("SELECT id, name FROM reports WHERE name LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "reports", "label": row["name"], "report": row["id"]})
    return jsonify(hits)

