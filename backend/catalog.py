from datetime import datetime

from flask import Blueprint, jsonify, request

from db import connect, query

bp = Blueprint("catalog", __name__)

@bp.get("/api/products")
def products():
    return jsonify(query("SELECT * FROM products ORDER BY id"))


@bp.post("/api/products")
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


def collection_rows():
    rows = []
    for row in query("SELECT id, title, conditions FROM collections ORDER BY id"):
        products = query("SELECT COUNT(*) AS n FROM collection_products WHERE collection_id = ?", (row["id"],))[0]["n"]
        channels = query("SELECT COUNT(*) AS n FROM collection_channels WHERE collection_id = ?", (row["id"],))[0]["n"]
        rows.append({**row, "products": products, "channels": channels})
    return rows


@bp.get("/api/collections")
def collections():
    return jsonify(collection_rows())


@bp.get("/api/collections/<int:collection_id>")
def collection_detail(collection_id):
    found = query("SELECT id, title, conditions FROM collections WHERE id = ?", (collection_id,))
    if not found:
        return jsonify(error="Collection not found"), 404
    return jsonify(
        collection=found[0],
        products=query("SELECT product FROM collection_products WHERE collection_id = ? ORDER BY product", (collection_id,)),
        channels=query("SELECT channel FROM collection_channels WHERE collection_id = ? ORDER BY channel", (collection_id,)),
    )


@bp.post("/api/collections")
def create_collection():
    body = request.json or {}
    title = str(body.get("title") or "").strip()
    if not title:
        return jsonify(error="Title is required"), 400
    product = str(body.get("product") or "").strip()
    with connect() as db:
        cur = db.execute("INSERT INTO collections (title, conditions) VALUES (?, NULL)", (title,))
        collection_id = cur.lastrowid
        if product:
            db.execute("INSERT INTO collection_products (collection_id, product) VALUES (?, ?)", (collection_id, product))
    return jsonify(collection_rows()), 201


@bp.get("/api/inventory")
def inventory():
    return jsonify(query("SELECT * FROM inventory ORDER BY id"))


@bp.post("/api/inventory")
def add_inventory():
    body = request.json or {}
    product = str(body.get("product") or "").strip()
    variant = str(body.get("variant") or "").strip() or "Default"
    if not product:
        return jsonify(error="Product is required"), 400
    try:
        on_hand = int(body.get("on_hand") or 0)
    except (TypeError, ValueError):
        return jsonify(error="On hand must be a number"), 400
    if on_hand < 0:
        return jsonify(error="On hand must be positive"), 400
    with connect() as db:
        cur = db.execute(
            "INSERT INTO inventory (product, variant, sku, unavailable, committed, available, on_hand, incoming) VALUES (?, ?, NULL, 0, 0, ?, ?, 0)",
            (product, variant, on_hand, on_hand),
        )
        row = dict(db.execute("SELECT * FROM inventory WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(row), 201


@bp.get("/api/purchase-orders")
def purchase_orders():
    return jsonify(query("SELECT * FROM purchase_orders ORDER BY id DESC"))


@bp.post("/api/purchase-orders")
def create_purchase_order():
    body = request.json or {}
    supplier = str(body.get("supplier") or "").strip()
    if not supplier:
        return jsonify(error="Supplier is required"), 400
    created = datetime.now().replace(microsecond=0).isoformat()
    with connect() as db:
        cur = db.execute(
            "INSERT INTO purchase_orders (supplier, status, created_at) VALUES (?, 'draft', ?)",
            (supplier, created),
        )
        row = dict(db.execute("SELECT * FROM purchase_orders WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(row), 201


@bp.get("/api/transfers")
def transfers():
    return jsonify(query("SELECT * FROM transfers ORDER BY id DESC"))


@bp.post("/api/transfers")
def create_transfer():
    body = request.json or {}
    origin = str(body.get("origin") or "").strip()
    destination = str(body.get("destination") or "").strip()
    if not origin or not destination:
        return jsonify(error="Origin and destination are required"), 400
    created = datetime.now().replace(microsecond=0).isoformat()
    with connect() as db:
        cur = db.execute(
            "INSERT INTO transfers (origin, destination, status, created_at) VALUES (?, ?, 'draft', ?)",
            (origin, destination, created),
        )
        row = dict(db.execute("SELECT * FROM transfers WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(row), 201


@bp.get("/api/gift-cards")
def gift_cards():
    return jsonify(query("SELECT * FROM gift_cards ORDER BY id DESC"))


@bp.post("/api/gift-cards")
def create_gift_card():
    body = request.json or {}
    customer = str(body.get("customer") or "").strip()
    code = str(body.get("code") or "").strip().upper()
    try:
        balance = int(body.get("balance") or 0)
    except (TypeError, ValueError):
        return jsonify(error="Balance must be a number"), 400
    if balance < 0:
        return jsonify(error="Balance must be positive"), 400
    if not code:
        code = f"GIFT{balance or 1000}"
    with connect() as db:
        cur = db.execute(
            "INSERT INTO gift_cards (code, customer, balance, status) VALUES (?, ?, ?, 'active')",
            (code, customer or None, balance),
        )
        row = dict(db.execute("SELECT * FROM gift_cards WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(row), 201

