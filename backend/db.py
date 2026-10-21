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
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
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
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_entries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  swatch TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS meta_definitions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  items TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blog_posts (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  blog TEXT NOT NULL DEFAULT 'News',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_catalogs (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  market TEXT NOT NULL DEFAULT 'Kenya',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rollouts (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  config TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS catalog_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  detail TEXT NOT NULL,
  price INTEGER NOT NULL,
  dest TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  last_viewed TEXT,
  created_by TEXT NOT NULL DEFAULT 'Shopify'
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

def add_event(db, order_id, body, kind="event", draft_id=None, created_at=None):
    when = created_at or datetime.now().replace(microsecond=0).isoformat()
    db.execute(
        "INSERT INTO order_events (order_id, created_at, kind, body, draft_id) VALUES (?, ?, ?, ?, ?)",
        (order_id, when, kind, body, draft_id),
    )


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


def _add_col(db, table, name, decl):
    cols = {row[1] for row in db.execute(f"PRAGMA table_info({table})")}
    if name not in cols:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {decl}")


def migrate(db):
    draft_cols = [row[1] for row in db.execute("PRAGMA table_info(drafts)")]
    if "order_id" not in draft_cols:
        db.execute("ALTER TABLE drafts ADD COLUMN order_id INTEGER")
    for name, decl in (
        ("note", "TEXT NOT NULL DEFAULT ''"),
        ("tags", "TEXT NOT NULL DEFAULT ''"),
        ("discount", "INTEGER NOT NULL DEFAULT 0"),
        ("shipping", "INTEGER NOT NULL DEFAULT 0"),
        ("currency", "TEXT NOT NULL DEFAULT 'KES'"),
    ):
        _add_col(db, "drafts", name, decl)
    product_cols = {row[1] for row in db.execute("PRAGMA table_info(products)")}
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
        if name not in product_cols:
            db.execute(f"ALTER TABLE products ADD COLUMN {name} {decl}")
    db.execute(
        "CREATE TABLE IF NOT EXISTS product_tags (product_id INTEGER NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (product_id, tag))"
    )
    db.execute(
        "CREATE TABLE IF NOT EXISTS product_fields (product_id INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY (product_id, name))"
    )
    for name, decl in (
        ("price", "INTEGER NOT NULL DEFAULT 0"),
        ("weight", "INTEGER NOT NULL DEFAULT 1000"),
        ("location", "TEXT NOT NULL DEFAULT 'Nairobi'"),
        ("tracked", "INTEGER NOT NULL DEFAULT 1"),
        ("physical", "INTEGER NOT NULL DEFAULT 1"),
        ("continue_selling", "INTEGER NOT NULL DEFAULT 0"),
    ):
        _add_col(db, "inventory", name, decl)
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
    for name, decl in (
        ("phone", "TEXT NOT NULL DEFAULT ''"),
        ("language", "TEXT NOT NULL DEFAULT 'English'"),
        ("subscribed", "INTEGER NOT NULL DEFAULT 1"),
        ("sms", "INTEGER NOT NULL DEFAULT 0"),
        ("whatsapp", "INTEGER NOT NULL DEFAULT 0"),
        ("note", "TEXT NOT NULL DEFAULT ''"),
        ("tags", "TEXT NOT NULL DEFAULT ''"),
        ("address", "TEXT NOT NULL DEFAULT ''"),
        ("tax_settings", "TEXT NOT NULL DEFAULT 'Collect tax'"),
    ):
        _add_col(db, "customers", name, decl)
    _add_col(db, "discounts", "method", "TEXT NOT NULL DEFAULT 'code'")
    _add_col(db, "discounts", "config", "TEXT NOT NULL DEFAULT '{}'")
    _add_col(db, "rollouts", "status", "TEXT NOT NULL DEFAULT 'draft'")
    _add_col(db, "rollouts", "config", "TEXT NOT NULL DEFAULT '{}'")
    for name, decl in (
        ("phone", "TEXT NOT NULL DEFAULT ''"),
        ("email", "TEXT NOT NULL DEFAULT ''"),
        ("address", "TEXT NOT NULL DEFAULT ''"),
    ):
        _add_col(db, "drafts", name, decl)
    _add_col(db, "draft_lines", "size", "TEXT NOT NULL DEFAULT ''")
    _add_col(db, "draft_lines", "color", "TEXT NOT NULL DEFAULT ''")
    _add_col(db, "order_lines", "size", "TEXT NOT NULL DEFAULT ''")
    _add_col(db, "order_lines", "color", "TEXT NOT NULL DEFAULT ''")


def init_db():
    with connect() as db:
        db.executescript(SCHEMA)
        migrate(db)
