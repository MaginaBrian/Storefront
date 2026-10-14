import sqlite3
from datetime import datetime
from pathlib import Path

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
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  percent INTEGER NOT NULL,
  last_activity TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  external_id TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  location_id TEXT NOT NULL DEFAULT '',
  billing_same INTEGER NOT NULL DEFAULT 1,
  billing_address TEXT NOT NULL DEFAULT '',
  market TEXT NOT NULL DEFAULT 'Kenya',
  terms TEXT NOT NULL DEFAULT 'No payment terms',
  one_time_address INTEGER NOT NULL DEFAULT 0,
  submission TEXT NOT NULL DEFAULT 'auto',
  tax_id TEXT NOT NULL DEFAULT '',
  tax_settings TEXT NOT NULL DEFAULT 'Collect tax',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_detail (
  order_id INTEGER PRIMARY KEY,
  confirmation TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS order_address (
  order_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  line TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  billing_same INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_tags (
  order_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (order_id, tag)
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_id TEXT
);
CREATE TABLE IF NOT EXISTS draft_lines (
  id INTEGER PRIMARY KEY,
  draft_id TEXT NOT NULL,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  qty INTEGER NOT NULL,
  line_total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS draft_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  conditions TEXT
);
CREATE TABLE IF NOT EXISTS collection_products (
  collection_id INTEGER NOT NULL,
  product TEXT NOT NULL,
  PRIMARY KEY (collection_id, product)
);
CREATE TABLE IF NOT EXISTS collection_channels (
  collection_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  PRIMARY KEY (collection_id, channel)
);
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY,
  product TEXT NOT NULL,
  variant TEXT NOT NULL,
  sku TEXT,
  unavailable INTEGER NOT NULL DEFAULT 0,
  committed INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0,
  on_hand INTEGER NOT NULL DEFAULT 0,
  incoming INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY,
  supplier TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transfers (
  id INTEGER PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gift_cards (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  customer TEXT,
  balance INTEGER NOT NULL,
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

def link_drafts(db):
    for draft_id, order_id in (("D4", 1004), ("D2", 1002), ("D1", 1001)):
        db.execute("UPDATE drafts SET order_id = ? WHERE id = ? AND order_id IS NULL", (order_id, draft_id))


ORDER_PAGES = [
    {
        "id": 1004,
        "confirmation": "GYNE8JYXF",
        "customer": "Korom Festival",
        "created_at": "2026-09-30T15:14:00",
        "draft": "D4",
        "address": ("Korom Festival", "Westlands", "Nairobi", "Kenya"),
        "lines": [("Woven wristbands", 3500, 7900, 27650000)],
    },
    {
        "id": 1002,
        "confirmation": "K4P9MW2QX",
        "customer": "Hawkeye Media",
        "created_at": "2026-09-27T18:24:00",
        "draft": "D2",
        "address": ("Hawkeye Media", "Milimani", "Kisumu", "Kenya"),
        "lines": [("Press kits", 286, 2230, 637744)],
    },
    {
        "id": 1001,
        "confirmation": "B7NQ3L8VD",
        "customer": "Mwotaji Ltd",
        "created_at": "2026-09-27T18:10:00",
        "draft": "D1",
        "address": ("Mwotaji Ltd", "Industrial Area", "Nairobi", "Kenya"),
        "lines": [("Festival passes", 60956, 471, 28710252)],
    },
]


def add_event(db, order_id, body, kind="event", draft_id=None, created_at=None):
    when = created_at or datetime.now().replace(microsecond=0).isoformat()
    db.execute(
        "INSERT INTO order_events (order_id, created_at, kind, body, draft_id) VALUES (?, ?, ?, ?, ?)",
        (order_id, when, kind, body, draft_id),
    )


def ensure_order_details(db):
    for spec in ORDER_PAGES:
        if not db.execute("SELECT 1 FROM orders WHERE id = ?", (spec["id"],)).fetchone():
            continue
        if db.execute("SELECT 1 FROM order_detail WHERE order_id = ?", (spec["id"],)).fetchone():
            continue
        db.execute(
            "INSERT INTO order_detail (order_id, confirmation, note) VALUES (?, ?, '')",
            (spec["id"], spec["confirmation"]),
        )
        db.execute(
            "INSERT INTO order_address (order_id, name, line, city, country, billing_same) VALUES (?, ?, ?, ?, ?, 1)",
            (spec["id"], *spec["address"]),
        )
        db.executemany(
            "INSERT INTO order_lines (order_id, title, price, qty, line_total) VALUES (?, ?, ?, ?, ?)",
            [(spec["id"], title, price, qty, total) for title, price, qty, total in spec["lines"]],
        )
        when = spec["created_at"]
        draft = spec["draft"]
        customer = spec["customer"]
        add_event(db, spec["id"], f"You created this order for {customer} from draft order #{draft}.", draft_id=draft, created_at=when)
        add_event(db, spec["id"], f"Confirmation #{spec['confirmation']} was generated for this order.", created_at=when)
        add_event(db, spec["id"], "You added payment terms to this order.", created_at=when)


def attach_new_order(db, order):
    if db.execute("SELECT 1 FROM order_detail WHERE order_id = ?", (order["id"],)).fetchone():
        return
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    confirmation = "".join(alphabet[(order["id"] * (i + 3)) % len(alphabet)] for i in range(9))
    customer = db.execute("SELECT location FROM customers WHERE name = ?", (order["customer"],)).fetchone()
    city = customer["location"] if customer else "Nairobi"
    items = order["items"] or 1
    total = order["total"]
    price = total // items if items and total % items == 0 else total
    db.execute("INSERT INTO order_detail (order_id, confirmation, note) VALUES (?, ?, '')", (order["id"], confirmation))
    db.execute(
        "INSERT INTO order_address (order_id, name, line, city, country, billing_same) VALUES (?, ?, '', ?, 'Kenya', 1)",
        (order["id"], order["customer"], city),
    )
    db.execute(
        "INSERT INTO order_lines (order_id, title, price, qty, line_total) VALUES (?, 'Order items', ?, ?, ?)",
        (order["id"], price, items, total),
    )
    add_event(db, order["id"], f"You created this order for {order['customer']}.", created_at=order["created_at"])
    add_event(db, order["id"], f"Confirmation #{confirmation} was generated for this order.", created_at=order["created_at"])

DRAFT_LINES = {
    "D3": [("Stage passes", 32074, 1000, 32074000)],
}


def ensure_draft_lines(db):
    for draft_id, lines in DRAFT_LINES.items():
        if not db.execute("SELECT 1 FROM drafts WHERE id = ?", (draft_id,)).fetchone():
            continue
        if db.execute("SELECT 1 FROM draft_lines WHERE draft_id = ?", (draft_id,)).fetchone():
            continue
        db.executemany(
            "INSERT INTO draft_lines (draft_id, title, price, qty, line_total) VALUES (?, ?, ?, ?, ?)",
            [(draft_id, title, price, qty, total) for title, price, qty, total in lines],
        )

INVENTORY_ROWS = [
    ("A1544-3 (B1820) Rib fabric", "Teal", 35),
    ("A1544-3 (B1820) Rib fabric", "White", 50),
    ("A1544-3 (B1820) Rib fabric", "Black", 35),
    ("A1605 - (A1885) Rib fabric", "Light Grey", 35),
    ("A1605 - (A1885) Rib fabric", "Black", 35),
    ("A1605 - (A1885) Rib fabric", "White", 50),
    ("A1885 - Fabric", "Black", 29),
    ("A1885 - Fabric", "Light Grey", 25),
    ("A1885 - Fabric", "White", 50),
    ("B1820 - Fabric", "White", 2),
    ("B1820 - Fabric", "Black", 1),
]


def ensure_catalog(db):
    if not db.execute("SELECT COUNT(*) FROM collections").fetchone()[0]:
        db.execute("INSERT INTO collections (id, title, conditions) VALUES (1, 'Home page', NULL)")
        db.execute("INSERT INTO collection_products (collection_id, product) VALUES (1, 'Linen Overshirt')")
        db.executemany(
            "INSERT INTO collection_channels (collection_id, channel) VALUES (1, ?)",
            [("Online Store",), ("WhatsApp",)],
        )
    if not db.execute("SELECT COUNT(*) FROM inventory").fetchone()[0]:
        db.executemany(
            "INSERT INTO inventory (product, variant, sku, unavailable, committed, available, on_hand, incoming) VALUES (?, ?, NULL, 0, 0, ?, ?, 0)",
            [(product, variant, qty, qty) for product, variant, qty in INVENTORY_ROWS],
        )


PRODUCT_EDITOR = {
    "Linen Overshirt": ("Shirts", "Maison", "", "linen-overshirt"),
    "Leather Weekender": ("Bags", "Maison", "Black", "leather-weekender"),
    "Canvas Tote": ("Bags", "Maison", "", "canvas-tote"),
    "Brass Card Holder": ("Accessories", "Maison", "", "brass-card-holder"),
}


def ensure_product_editor(db):
    cols = {row[1] for row in db.execute("PRAGMA table_info(products)")}
    for name, decl in (
        ("description", "TEXT NOT NULL DEFAULT ''"),
        ("status", "TEXT NOT NULL DEFAULT 'active'"),
        ("category", "TEXT NOT NULL DEFAULT ''"),
        ("product_type", "TEXT NOT NULL DEFAULT ''"),
        ("vendor", "TEXT NOT NULL DEFAULT 'Maison'"),
        ("color", "TEXT NOT NULL DEFAULT ''"),
        ("handle", "TEXT NOT NULL DEFAULT ''"),
        ("media", "TEXT NOT NULL DEFAULT ''"),
    ):
        if name not in cols:
            db.execute(f"ALTER TABLE products ADD COLUMN {name} {decl}")
    db.execute(
        "CREATE TABLE IF NOT EXISTS product_tags (product_id INTEGER NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (product_id, tag))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS product_fields (product_id INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY (product_id, name))"
    )
    for title, (category, vendor, color, handle) in PRODUCT_EDITOR.items():
        db.execute(
            "UPDATE products SET category = ?, vendor = ?, color = ?, handle = ? WHERE title = ? AND category = ''",
            (category, vendor, color, handle, title),
        )
    if not db.execute("SELECT 1 FROM products WHERE title = 'Mwotaji - Vest'").fetchone():
        db.execute(
            "INSERT INTO products (title, price, stock, sold, description, status, category, product_type, vendor, color, handle, media) VALUES (?, ?, ?, 0, '', 'active', ?, '', ?, 'Black', ?, '')",
            ("Mwotaji - Vest", 30000, 8, "Vests in Activewear Vests & Jackets", "My Store", "mwotaji-vest"),
        )


def _add_col(db, table, name, decl):
    cols = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    if name not in cols:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")


def ensure_variant_pages(db):
    for name, decl in (
        ("price", "INTEGER NOT NULL DEFAULT 0"),
        ("weight", "INTEGER NOT NULL DEFAULT 1000"),
        ("location", "TEXT NOT NULL DEFAULT 'Nairobi'"),
        ("tracked", "INTEGER NOT NULL DEFAULT 1"),
        ("physical", "INTEGER NOT NULL DEFAULT 1"),
        ("continue_selling", "INTEGER NOT NULL DEFAULT 0"),
    ):
        _add_col(db, "inventory", name, decl)
    db.execute(
        "UPDATE inventory SET price = 148700 WHERE variant = 'Teal' AND product LIKE 'A1544%' AND price = 0"
    )
    for name, decl in (
        ("destination", "TEXT NOT NULL DEFAULT ''"),
        ("reference", "TEXT NOT NULL DEFAULT ''"),
        ("note", "TEXT NOT NULL DEFAULT ''"),
        ("terms", "TEXT NOT NULL DEFAULT ''"),
        ("currency", "TEXT NOT NULL DEFAULT 'KES'"),
        ("tags", "TEXT NOT NULL DEFAULT ''"),
        ("lines", "TEXT NOT NULL DEFAULT '[]'"),
    ):
        _add_col(db, "purchase_orders", name, decl)
    for name, decl in (
        ("reference", "TEXT NOT NULL DEFAULT ''"),
        ("note", "TEXT NOT NULL DEFAULT ''"),
        ("tags", "TEXT NOT NULL DEFAULT ''"),
        ("lines", "TEXT NOT NULL DEFAULT '[]'"),
        ("purchase_order", "TEXT NOT NULL DEFAULT ''"),
    ):
        _add_col(db, "transfers", name, decl)
    for name, decl in (
        ("note", "TEXT NOT NULL DEFAULT ''"),
        ("expires", "TEXT NOT NULL DEFAULT ''"),
    ):
        _add_col(db, "gift_cards", name, decl)


SEGMENTS = [
    (1, "Customers who have purchased at least once", "purchased", 100, "2026-09-27", "Shopify"),
    (2, "Email subscribers", "subscribers", 0, "2026-09-27", "Shopify"),
    (3, "Abandoned checkouts in the last 30 days", "abandoned", 0, "2026-09-27", "Shopify"),
    (4, "Customers who have purchased more than once", "repeat", 0, "2026-09-27", "Shopify"),
    (5, "Customers who haven't purchased", "never", 0, "2026-09-27", "Shopify"),
]


def ensure_customer_section(db):
    if not db.execute("SELECT COUNT(*) FROM segments").fetchone()[0]:
        db.executemany(
            "INSERT INTO segments (id, name, query, percent, last_activity, created_by) VALUES (?, ?, ?, ?, ?, ?)",
            SEGMENTS,
        )


def init_db():
    with connect() as db:
        db.executescript(SCHEMA)
        cols = [row[1] for row in db.execute("PRAGMA table_info(drafts)")]
        if "order_id" not in cols:
            db.execute("ALTER TABLE drafts ADD COLUMN order_id INTEGER")
        if db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]:
            link_drafts(db)
            ensure_order_details(db)
            ensure_draft_lines(db)
            ensure_catalog(db)
            ensure_product_editor(db)
            ensure_variant_pages(db)
            ensure_customer_section(db)
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
        link_drafts(db)
        ensure_order_details(db)
        ensure_draft_lines(db)
        ensure_catalog(db)
        ensure_product_editor(db)
        ensure_variant_pages(db)
        ensure_customer_section(db)

