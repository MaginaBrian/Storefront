import sqlite3
from datetime import date, datetime
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

DB_PATH = Path(__file__).resolve().parent / "storefront.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL,
  customer TEXT NOT NULL,
  fulfill_by TEXT,
  channel TEXT NOT NULL,
  total INTEGER NOT NULL,
  payment TEXT NOT NULL,
  fulfillment TEXT NOT NULL,
  items INTEGER NOT NULL,
  delivery_status TEXT,
  delivery_method TEXT
);
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  po TEXT,
  created_at TEXT NOT NULL,
  customer TEXT NOT NULL,
  status TEXT NOT NULL,
  total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  sold INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  location TEXT NOT NULL,
  orders INTEGER NOT NULL,
  spent INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS discounts (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL,
  uses INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  reach INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS channels (
  name TEXT PRIMARY KEY,
  orders INTEGER NOT NULL,
  sales INTEGER NOT NULL,
  delta REAL NOT NULL,
  view TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS week (
  day TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  sort INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS kpis (
  label TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  note TEXT NOT NULL,
  good INTEGER NOT NULL,
  tone TEXT NOT NULL,
  sort INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  sort INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS store (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  domain TEXT NOT NULL,
  theme TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS agentic (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  conversations INTEGER NOT NULL,
  resolved INTEGER NOT NULL,
  handoff INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS checkouts (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL
);
"""


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def query(sql, args=()):
    with connect() as db:
        return [dict(row) for row in db.execute(sql, args)]


def init_db():
    with connect() as db:
        db.executescript(SCHEMA)
        if db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]:
            return
        db.executemany(
            "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (1004, "2026-09-30T15:14:00", "Korom Festival", None, "Draft Orders", 27650000, "pending", "unfulfilled", 7900, None, "Shipping"),
                (1002, "2026-09-27T18:24:00", "Hawkeye Media", None, "Draft Orders", 637744, "paid", "fulfilled", 2230, None, "Shipping"),
                (1001, "2026-09-27T18:10:00", "Mwotaji Ltd", None, "Draft Orders", 28710252, "paid", "fulfilled", 471, None, "Shipping"),
            ],
        )
        db.executemany(
            "INSERT INTO drafts (id, po, created_at, customer, status, total) VALUES (?, ?, ?, ?, ?, ?)",
            [
                ("D4", None, "2026-09-30T15:14:00", "Korom Festival", "completed", 27650000),
                ("D3", "note", "2026-09-29T20:23:00", "Korom Festival", "completed", 32074000),
                ("D2", None, "2026-09-27T18:24:00", "Hawkeye Media", "completed", 637744),
                ("D1", None, "2026-09-27T18:10:00", "Mwotaji Ltd", "completed", 28710252),
            ],
        )
        db.executemany(
            "INSERT INTO products (id, title, price, stock, sold) VALUES (?, ?, ?, ?, ?)",
            [
                (1, "Linen Overshirt", 890000, 14, 48),
                (2, "Leather Weekender", 2450000, 5, 35),
                (3, "Canvas Tote", 300000, 30, 22),
                (4, "Brass Card Holder", 150000, 40, 60),
            ],
        )
        db.executemany(
            "INSERT INTO customers (id, name, email, location, orders, spent) VALUES (?, ?, ?, ?, ?, ?)",
            [
                (1, "Korom Festival", "hello@koromfestival.co.ke", "Nairobi", 2, 59724000),
                (2, "Hawkeye Media", "accounts@hawkeyemedia.co.ke", "Kisumu", 1, 637744),
                (3, "Mwotaji Ltd", "orders@mwotaji.co.ke", "Mombasa", 1, 28710252),
                (4, "Amani Wekesa", "amani@example.com", "Nairobi", 1, 850000),
                (5, "Zuri Otieno", "zuri@example.com", "Nakuru", 1, 3200000),
                (6, "Kofi Mwangi", "kofi@example.com", "Eldoret", 1, 452000),
                (7, "Neema Achieng", "neema@example.com", "Nairobi", 1, 1299900),
            ],
        )
        db.executemany(
            "INSERT INTO discounts (id, code, kind, value, status, uses) VALUES (?, ?, ?, ?, ?, ?)",
            [
                (1, "WELCOME10", "Percentage", "10%", "active", 42),
                (2, "FREESHIP", "Free shipping", "Shipping", "active", 18),
                (3, "WEEKEND", "Fixed amount", "KES 500", "scheduled", 0),
            ],
        )
        db.executemany(
            "INSERT INTO pages (id, title, status, updated_at) VALUES (?, ?, ?, ?)",
            [
                (1, "Home page", "visible", "2026-10-02"),
                (2, "About", "visible", "2026-09-18"),
                (3, "Contact", "hidden", "2026-08-30"),
            ],
        )
        db.executemany(
            "INSERT INTO markets (id, name, currency, status) VALUES (?, ?, ?, ?)",
            [
                (1, "Kenya", "KES", "active"),
                (2, "Uganda", "UGX", "active"),
                (3, "Tanzania", "TZS", "draft"),
            ],
        )
        db.executemany(
            "INSERT INTO campaigns (id, name, channel, status, reach) VALUES (?, ?, ?, ?, ?)",
            [
                (1, "WhatsApp restock", "WhatsApp", "active", 2400),
                (2, "Winback email", "Email", "active", 860),
                (3, "Instagram launch", "Instagram", "scheduled", 0),
            ],
        )
        db.executemany(
            "INSERT INTO channels (name, orders, sales, delta, view) VALUES (?, ?, ?, ?, ?)",
            [
                ("Online Store", 540, 283400, 12.5, "store"),
                ("Agentic", 250, 157800, 9.8, "agentic"),
                ("WhatsApp", 1200, 501200, -15.3, "growth"),
                ("In person", 400, 225600, 11.7, "analytics"),
                ("Instagram", 400, 225600, -11.7, "analytics"),
            ],
        )
        db.executemany(
            "INSERT INTO week (day, amount, sort) VALUES (?, ?, ?)",
            [("Sun", 22, 0), ("Mon", 45, 1), ("Tue", 80, 2), ("Wed", 52, 3), ("Thu", 38, 4), ("Fri", 70, 5), ("Sat", 100, 6)],
        )
        db.executemany(
            "INSERT INTO kpis (label, value, note, good, tone, sort) VALUES (?, ?, ?, ?, ?, ?)",
            [
                ("Total sales", "KES 630.9K", "12.5% this month", 1, "green", 0),
                ("Orders", "1,540", "no change", 1, "amber", 1),
                ("New customers", "310", "3.1% this month", 0, "violet", 2),
                ("Low stock", "8 items", "3 critical", 0, "red", 3),
            ],
        )
        db.executemany(
            "INSERT INTO settings (key, value, label, sort) VALUES (?, ?, ?, ?)",
            [
                ("store_name", "Maison", "Store name", 0),
                ("email", "hello@maison.co.ke", "Contact email", 1),
                ("currency", "KES", "Currency", 2),
                ("timezone", "Africa/Nairobi", "Timezone", 3),
            ],
        )
        db.execute("INSERT INTO store (id, domain, theme, status) VALUES (1, 'maison.co.ke', 'Dawn', 'Published')")
        db.execute("INSERT INTO agentic (id, conversations, resolved, handoff) VALUES (1, 128, 96, 12)")


init_db()


def money(cents):
    return f"KES {cents / 100:,.2f}"


@app.get("/api/overview")
def overview():
    orders = query("SELECT total, fulfillment, payment FROM orders")
    return jsonify(
        sessions=4,
        orders=len(orders),
        conversion=100,
        total_sales=sum(o["total"] for o in orders),
        currency="KES",
        to_fulfill=sum(o["fulfillment"] == "unfulfilled" for o in orders),
        to_capture=sum(o["payment"] != "paid" for o in orders),
    )


@app.get("/api/orders/summary")
def orders_summary():
    today = date.today().isoformat()
    orders = query("SELECT created_at, items, fulfillment, delivery_status FROM orders")
    todays = [o for o in orders if o["created_at"].startswith(today)]
    return jsonify(
        orders=len(todays),
        items=sum(o["items"] for o in todays),
        reversals=0,
        fulfilled=sum(o["fulfillment"] == "fulfilled" for o in todays),
        delivered=sum(o["delivery_status"] == "delivered" for o in todays),
        unfulfilled=sum(o["fulfillment"] == "unfulfilled" for o in orders),
    )


@app.get("/api/orders")
def orders():
    return jsonify(query("SELECT * FROM orders ORDER BY created_at DESC"))


@app.post("/api/orders")
def create_order():
    body = request.json or {}
    customer = str(body.get("customer") or "").strip()
    if not customer:
        return jsonify(error="Customer is required"), 400
    try:
        total = int(body.get("total") or 0)
        items = int(body.get("items") or 1)
    except (TypeError, ValueError):
        return jsonify(error="Total and items must be numbers"), 400
    if total < 0 or items < 1:
        return jsonify(error="Total and items must be positive"), 400
    channel = body.get("channel") if body.get("channel") in ("Draft Orders", "Online Store", "Agentic") else "Online Store"
    payment = "paid" if body.get("payment") == "paid" else "pending"
    created = datetime.now().replace(microsecond=0).isoformat()
    with connect() as db:
        next_id = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
        db.execute(
            "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, NULL, ?, ?, ?, 'unfulfilled', ?, NULL, 'Shipping')",
            (next_id, created, customer, channel, total, payment, items),
        )
        existing = db.execute("SELECT id FROM customers WHERE name = ?", (customer,)).fetchone()
        if existing:
            db.execute("UPDATE customers SET orders = orders + 1, spent = spent + ? WHERE id = ?", (total, existing["id"]))
        else:
            db.execute(
                "INSERT INTO customers (name, email, location, orders, spent) VALUES (?, '', 'Nairobi', 1, ?)",
                (customer, total),
            )
        row = dict(db.execute("SELECT * FROM orders WHERE id = ?", (next_id,)).fetchone())
    return jsonify(row), 201


@app.get("/api/drafts")
def drafts():
    return jsonify(query("SELECT * FROM drafts ORDER BY created_at DESC"))


@app.post("/api/drafts")
def create_draft():
    body = request.json or {}
    customer = str(body.get("customer") or "").strip()
    if not customer:
        return jsonify(error="Customer is required"), 400
    try:
        total = int(body.get("total") or 0)
    except (TypeError, ValueError):
        return jsonify(error="Total must be a number"), 400
    if total < 0:
        return jsonify(error="Total must be positive"), 400
    created = datetime.now().replace(microsecond=0).isoformat()
    po = str(body.get("po") or "").strip() or None
    with connect() as db:
        nums = [int(row["id"][1:]) for row in db.execute("SELECT id FROM drafts") if str(row["id"])[1:].isdigit()]
        draft_id = f"D{max(nums, default=0) + 1}"
        db.execute(
            "INSERT INTO drafts (id, po, created_at, customer, status, total) VALUES (?, ?, ?, ?, 'open', ?)",
            (draft_id, po, created, customer, total),
        )
        row = dict(db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone())
    return jsonify(row), 201


@app.get("/api/checkouts")
def checkouts():
    return jsonify(query("SELECT * FROM checkouts ORDER BY created_at DESC"))


@app.get("/api/products")
def products():
    return jsonify(query("SELECT * FROM products ORDER BY id"))


@app.post("/api/products")
def add_product():
    body = request.json or {}
    title = str(body.get("title") or "").strip()
    if not title:
        return jsonify(error="Title is required"), 400
    try:
        price = int(body.get("price") or 0)
        stock = int(body.get("stock") or 0)
    except (TypeError, ValueError):
        return jsonify(error="Price and stock must be numbers"), 400
    if price < 0 or stock < 0:
        return jsonify(error="Price and stock must be positive"), 400
    with connect() as db:
        cur = db.execute(
            "INSERT INTO products (title, price, stock, sold) VALUES (?, ?, ?, 0)",
            (title, price, stock),
        )
        row = dict(db.execute("SELECT * FROM products WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(row), 201


@app.get("/api/customers")
def customers():
    return jsonify(query("SELECT * FROM customers ORDER BY spent DESC"))


@app.get("/api/discounts")
def discounts():
    return jsonify(query("SELECT * FROM discounts ORDER BY id"))


@app.get("/api/content")
def content():
    return jsonify(query("SELECT * FROM pages ORDER BY id"))


@app.get("/api/markets")
def markets():
    return jsonify(query("SELECT * FROM markets ORDER BY id"))


@app.get("/api/growth")
def growth():
    return jsonify(query("SELECT * FROM campaigns ORDER BY id"))


@app.get("/api/store")
def store():
    return jsonify(query("SELECT domain, theme, status FROM store WHERE id = 1")[0])


@app.get("/api/agentic")
def agentic():
    return jsonify(query("SELECT conversations, resolved, handoff FROM agentic WHERE id = 1")[0])


@app.get("/api/settings")
def settings():
    return jsonify(query("SELECT key, value, label FROM settings ORDER BY sort"))


@app.patch("/api/settings")
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


@app.get("/api/dashboard")
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


@app.get("/api/analytics")
def analytics():
    return jsonify(
        channels=query("SELECT name, orders, sales, delta, view FROM channels"),
        week=[[row["day"], row["amount"]] for row in query("SELECT day, amount FROM week ORDER BY sort")],
    )


@app.get("/api/search")
def search():
    term = str(request.args.get("q") or "").strip()
    if len(term) < 2:
        return jsonify([])
    like = f"%{term}%"
    hits = []
    for row in query("SELECT id, customer FROM orders WHERE customer LIKE ? OR CAST(id AS TEXT) LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "orders", "label": f"Order #{row['id']} · {row['customer']}"})
    for row in query("SELECT id, customer FROM drafts WHERE customer LIKE ? OR id LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "drafts", "label": f"Draft #{row['id']} · {row['customer']}"})
    for row in query("SELECT title FROM products WHERE title LIKE ? LIMIT 5", (like,)):
        hits.append({"view": "products", "label": row["title"]})
    for row in query("SELECT name FROM customers WHERE name LIKE ? OR email LIKE ? LIMIT 5", (like, like)):
        hits.append({"view": "customers", "label": row["name"]})
    return jsonify(hits)


if __name__ == "__main__":
    app.run(port=5000, debug=True)
