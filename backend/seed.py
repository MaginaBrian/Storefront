"""Load the Maison test store into SQLite.

The app creates an empty database on startup. This script is how you put
the dummy store back so the screens have something to click through.

    python seed.py           replace every row with the test store
    python seed.py --clear   delete every row and leave the tables

Money is integer cents. A price of 30000 is KES 300.00.
"""

import argparse

from db import DB_PATH, add_event, connect, init_db

ORDERS = [
    (1004, "2026-09-30T15:14:00", "Korom Festival", None, "Draft Orders", 27650000, "pending", "unfulfilled", 7900, None, "Shipping"),
    (1002, "2026-09-27T18:24:00", "Hawkeye Media", None, "Draft Orders", 637744, "paid", "fulfilled", 2230, None, "Shipping"),
    (1001, "2026-09-27T18:10:00", "Mwotaji Ltd", None, "Draft Orders", 28710252, "paid", "fulfilled", 471, None, "Shipping"),
]

DRAFTS = [
    ("D4", None, "2026-09-30T15:14:00", "Korom Festival", "completed", 27650000, 1004),
    ("D3", "note", "2026-09-29T20:23:00", "Korom Festival", "completed", 32074000, None),
    ("D2", None, "2026-09-27T18:24:00", "Hawkeye Media", "completed", 637744, 1002),
    ("D1", None, "2026-09-27T18:10:00", "Mwotaji Ltd", "completed", 28710252, 1001),
]

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

PRODUCTS = [
    (1, "Linen Overshirt", 890000, 14, 48, "Shirts", "Maison", "", "linen-overshirt"),
    (2, "Leather Weekender", 2450000, 5, 35, "Bags", "Maison", "Black", "leather-weekender"),
    (3, "Canvas Tote", 300000, 30, 22, "Bags", "Maison", "", "canvas-tote"),
    (4, "Brass Card Holder", 150000, 40, 60, "Accessories", "Maison", "", "brass-card-holder"),
    (5, "Mwotaji - Vest", 30000, 8, 0, "Vests in Activewear Vests & Jackets", "My Store", "Black", "mwotaji-vest"),
]

CUSTOMERS = [
    (1, "Korom Festival", "hello@koromfestival.co.ke", "Nairobi", 2, 59724000),
    (2, "Hawkeye Media", "accounts@hawkeyemedia.co.ke", "Kisumu", 1, 637744),
    (3, "Mwotaji Ltd", "orders@mwotaji.co.ke", "Mombasa", 1, 28710252),
    (4, "Amani Wekesa", "amani@example.com", "Nairobi", 1, 850000),
    (5, "Zuri Otieno", "zuri@example.com", "Nakuru", 1, 3200000),
    (6, "Kofi Mwangi", "kofi@example.com", "Eldoret", 1, 452000),
    (7, "Neema Achieng", "neema@example.com", "Nairobi", 1, 1299900),
]

INVENTORY = [
    ("A1544-3 (B1820) Rib fabric", "Teal", 35, 148700),
    ("A1544-3 (B1820) Rib fabric", "White", 50, 0),
    ("A1544-3 (B1820) Rib fabric", "Black", 35, 0),
    ("A1605 - (A1885) Rib fabric", "Light Grey", 35, 0),
    ("A1605 - (A1885) Rib fabric", "Black", 35, 0),
    ("A1605 - (A1885) Rib fabric", "White", 50, 0),
    ("A1885 - Fabric", "Black", 29, 0),
    ("A1885 - Fabric", "Light Grey", 25, 0),
    ("A1885 - Fabric", "White", 50, 0),
    ("B1820 - Fabric", "White", 2, 0),
    ("B1820 - Fabric", "Black", 1, 0),
]

CATALOG_ITEMS = [
    ("A1544-3 (B1820) Rib fabric", "3 variants", 148700, "inventory"),
    ("A1605 - (A1885) Rib fabric", "3 variants", 146800, "inventory"),
    ("A1885 - Fabric", "3 variants", 118000, "inventory"),
    ("B1820 - Fabric", "4 variants", 2813600, "inventory"),
    ("Drawstrings", "4 variants", 9800, ""),
    ('Elastic waistbands 0.5"', "2 variants", 240000, ""),
    ('Elastic waistbands 1"', "2 variants", 290000, ""),
    ('Elastic waistbands 1.25"', "2 variants", 400000, ""),
    ('Elastic waistbands 1.5"', "2 variants", 440000, ""),
    ('Elastic waistbands 2"', "2 variants", 570000, ""),
    ("Groove bucket hat", "Green", 39000, ""),
    ("Groove denim cap", "Black", 42900, ""),
    ("Groove visor hat", "Gray", 41340, ""),
    ("Mwotaji - Crop Turn-up Tee", "2 variants", 30000, "products"),
    ("Mwotaji - Hoodie", "2 variants", 50000, "products"),
    ("Mwotaji - Oversized Tee", "2 variants", 30000, "products"),
    ("Mwotaji - Sweatpant", "2 variants", 60000, "products"),
    ("Mwotaji - Sweatshirt", "2 variants", 50000, "products"),
    ("Mwotaji - Vest", "2 variants", 30000, "products"),
    ("Polyester thread 40S/2", "4 variants", 12000, ""),
    ("Sample woven wristbands", "Multicolor", 7080, ""),
    ("Woven wristbands", "", 3500, ""),
]

SEGMENTS = [
    (1, "Customers who have purchased at least once", "purchased", 100, "2026-09-27", "Storefront"),
    (2, "Email subscribers", "subscribers", 0, "2026-09-27", "Storefront"),
    (3, "Abandoned checkouts in the last 30 days", "abandoned", 0, "2026-09-27", "Storefront"),
    (4, "Customers who have purchased more than once", "repeat", 0, "2026-09-27", "Storefront"),
    (5, "Customers who haven't purchased", "never", 0, "2026-09-27", "Storefront"),
]

COLORS = [
    (1, "Off White", "Color", "#f3efe6", "active"),
    (2, "Beige", "Color", "#e4d2b0", "active"),
    (3, "Multicolor", "Color", "linear-gradient(135deg,#f4efe6,#e4d2b0,#9aa0a6,#5c6370)", "active"),
    (4, "Gray", "Color", "#8d939c", "active"),
    (5, "Black", "Color", "#1c1c1c", "active"),
    (6, "White", "Color", "#ffffff", "active"),
    (7, "Teal", "Color", "#7ec8c3", "active"),
    (8, "Light Grey", "Color", "#d5d8de", "active"),
    (9, "Navy", "Color", "#243056", "active"),
]

MENUS = [
    (1, "Main menu", "Home, Catalog, Contact"),
    (2, "Footer menu", "Search"),
    (3, "Customer account main menu", "Orders, Profile"),
]

REPORTS = [
    ("Net payments by method", "Finances", "2026-10-16"),
    ("Items ordered over time", "Orders", "2026-10-14"),
    ("Gross sales over time", "Sales", "2026-10-02"),
    ("Sessions by location", "Acquisition", None),
    ("Sessions by referrer", "Acquisition", None),
    ("Sessions by social referrer", "Acquisition", None),
    ("Sessions over time", "Acquisition", None),
    ("Visitors over time", "Acquisition", None),
    ("Visitors right now", "Acquisition", None),
    ("Bounce rate over time", "Behavior", None),
    ("Checkout conversion rate over time", "Behavior", None),
    ("Conversion rate breakdown", "Behavior", None),
    ("Conversion rate over time", "Behavior", None),
    ("Customer behavior", "Behavior", None),
    ("Product recommendation conversions over time", "Behavior", None),
    ("Product recommendations with low engagement", "Behavior", None),
    ("Search conversions over time", "Behavior", None),
    ("Searches by search query", "Behavior", None),
    ("Searches with no clicks", "Behavior", None),
    ("Searches with no results", "Behavior", None),
    ("Sessions by device type", "Behavior", None),
    ("Sessions by landing page", "Behavior", None),
    ("Shop Campaign ROAS", "Behavior", None),
    ("Storefront agent assisted sessions", "Behavior", None),
    ("Storefront agent conversations and feedback", "Behavior", None),
    ("Customer cohort analysis", "Customers", None),
    ("Customers by location", "Customers", None),
    ("New customer sales over time", "Customers", None),
    ("New customers over time", "Customers", None),
    ("New vs returning customers", "Customers", None),
    ("One-time customers", "Customers", None),
    ("Predicted spend tiers", "Customers", None),
    ("Returning customer rate over time", "Customers", None),
    ("Returning customers", "Customers", None),
    ("RFM customer analysis", "Customers", None),
    ("RFM customer list", "Customers", None),
    ("Chargeback rate", "Finances", None),
    ("Cost of goods sold by order", "Finances", None),
    ("Discounts by order", "Finances", None),
    ("Finance summary", "Finances", None),
    ("Gross payments from Shopify Payments", "Finances", None),
    ("Gross profit breakdown", "Finances", None),
    ("Gross profit by order", "Finances", None),
    ("Gross sales by order", "Finances", None),
    ("Managed Markets taxes", "Finances", None),
    ("Net payments by gateway", "Finances", None),
    ("Net payments by order", "Finances", None),
    ("Net payments over time", "Finances", None),
    ("Net sales by order", "Finances", None),
]

SETTINGS = [
    ("store_name", "Maison", "Store name", 0),
    ("email", "hello@maison.co.ke", "Contact email", 1),
    ("currency", "KES", "Currency", 2),
    ("timezone", "Africa/Nairobi", "Timezone", 3),
    ("entity_name", "Maison", "Business name", 10),
    ("entity_country", "Kenya", "Business country", 11),
    ("contact_email", "hello@maison.co.ke", "Contact email", 12),
    ("phone", "", "Phone", 13),
    ("address", "Nairobi, Nairobi, 00100, Kenya", "Store address", 14),
    ("currency_label", "Kenyan Shilling (KES)", "Currency display", 15),
    ("backup_region", "Kenya", "Backup region", 16),
    ("order_prefix", "#", "Order ID prefix", 17),
    ("order_suffix", "", "Order ID suffix", 18),
    ("fulfill_mode", "none", "Order fulfillment", 19),
    ("auto_archive", "1", "Archive fulfilled orders", 20),
]


def clear(db):
    names = [
        row[0]
        for row in db.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
    ]
    for name in names:
        db.execute(f"DELETE FROM {name}")
    if db.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'").fetchone():
        db.execute("DELETE FROM sqlite_sequence")


def load(db):
    db.executemany(
        "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ORDERS,
    )
    db.executemany(
        "INSERT INTO drafts (id, po, created_at, customer, status, total, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        DRAFTS,
    )
    for spec in ORDER_PAGES:
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
        add_event(db, spec["id"], f"You created this order for {spec['customer']} from draft order #{spec['draft']}.", draft_id=spec["draft"], created_at=when)
        add_event(db, spec["id"], f"Confirmation #{spec['confirmation']} was generated for this order.", created_at=when)
        add_event(db, spec["id"], "You added payment terms to this order.", created_at=when)
    db.executemany(
        "INSERT INTO draft_lines (draft_id, title, price, qty, line_total) VALUES (?, ?, ?, ?, ?)",
        [("D3", "Stage passes", 32074, 1000, 32074000)],
    )
    db.executemany(
        """INSERT INTO products
           (id, title, price, stock, sold, description, status, category, product_type, vendor, color, handle, media)
           VALUES (?, ?, ?, ?, ?, '', 'active', ?, '', ?, ?, ?, '')""",
        PRODUCTS,
    )
    db.executemany(
        "INSERT INTO customers (id, name, email, location, orders, spent) VALUES (?, ?, ?, ?, ?, ?)",
        CUSTOMERS,
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
        SETTINGS,
    )
    db.execute("INSERT INTO store (id, domain, theme, status) VALUES (1, 'maison.co.ke', 'Dawn', 'Published')")
    db.execute("INSERT INTO agentic (id, conversations, resolved, handoff) VALUES (1, 128, 96, 12)")
    db.execute("INSERT INTO collections (id, title, conditions) VALUES (1, 'Home page', NULL)")
    db.execute("INSERT INTO collection_products (collection_id, product) VALUES (1, 'Linen Overshirt')")
    db.executemany(
        "INSERT INTO collection_channels (collection_id, channel) VALUES (1, ?)",
        [("Online Store",), ("WhatsApp",)],
    )
    db.executemany(
        """INSERT INTO inventory
           (product, variant, sku, unavailable, committed, available, on_hand, incoming, price, weight, location, tracked, physical, continue_selling)
           VALUES (?, ?, NULL, 0, 0, ?, ?, 0, ?, 1000, 'Nairobi', 1, 1, 0)""",
        [(product, variant, qty, qty, price) for product, variant, qty, price in INVENTORY],
    )
    db.executemany(
        "INSERT INTO segments (id, name, query, percent, last_activity, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        SEGMENTS,
    )
    db.executemany(
        "INSERT INTO meta_entries (id, name, kind, swatch, status) VALUES (?, ?, ?, ?, ?)",
        COLORS,
    )
    db.executemany("INSERT INTO menus (id, name, items) VALUES (?, ?, ?)", MENUS)
    db.executemany(
        "INSERT INTO reports (name, category, last_viewed, created_by) VALUES (?, ?, ?, 'Storefront')",
        REPORTS,
    )
    db.executemany(
        "INSERT INTO catalog_items (name, detail, price, dest) VALUES (?, ?, ?, ?)",
        CATALOG_ITEMS,
    )


def main():
    parser = argparse.ArgumentParser(description="Load or remove the Maison test store.")
    parser.add_argument("--clear", action="store_true", help="Delete every row and leave the tables empty.")
    args = parser.parse_args()
    init_db()
    with connect() as db:
        clear(db)
        if not args.clear:
            load(db)
    if args.clear:
        print(f"Cleared {DB_PATH}")
        return
    with connect() as db:
        orders = db.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
        products = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        customers = db.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    print(f"Loaded the test store into {DB_PATH}")
    print(f"{orders} orders, {products} products, {customers} customers")


if __name__ == "__main__":
    main()
