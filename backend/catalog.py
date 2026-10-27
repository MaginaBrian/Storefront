import csv
import io
import json
import zipfile
from datetime import datetime
from xml.etree import ElementTree

from flask import Blueprint, jsonify, request

from db import connect, query

bp = Blueprint("catalog", __name__)

@bp.get("/api/products")
def products():
    rows = query("SELECT * FROM products ORDER BY id")
    grouped = {}
    for tag in query("SELECT product_id, tag FROM product_tags ORDER BY tag"):
        grouped.setdefault(tag["product_id"], []).append(tag["tag"])
    for row in rows:
        row["tags"] = grouped.get(row["id"], [])
    return jsonify(rows)


def _int(value, default=0):
    try:
        return int(value if value is not None and value != "" else default)
    except (TypeError, ValueError):
        return None


@bp.post("/api/products")
def add_product():
    body = request.json or {}
    title = str(body.get("title") or "").strip()
    if not title:
        return jsonify(error="Title is required"), 400
    price = _int(body.get("price"), 0)
    stock = _int(body.get("stock"), 0)
    if price is None or stock is None or price < 0 or stock < 0:
        return jsonify(error="Price and stock must be numbers"), 400
    status = body.get("status") if body.get("status") in ("active", "draft", "archived") else "active"
    description = str(body.get("description") or "")
    category = str(body.get("category") or "").strip()
    product_type = str(body.get("product_type") or "").strip()
    vendor = str(body.get("vendor") if "vendor" in body else "Maison").strip()
    color = str(body.get("color") or "").strip()
    media = str(body.get("media") or "").strip()
    extra = body.get("extra") if isinstance(body.get("extra"), dict) else {}
    tags = [str(tag).strip() for tag in body.get("tags") or [] if str(tag).strip()]
    fields = [str(name).strip() for name in body.get("fields") or [] if str(name).strip()]
    collections = []
    for item in body.get("collections") or []:
        try:
            collections.append(int(item))
        except (TypeError, ValueError):
            continue
    weight = _int(extra.get("weight_g"), 0)
    if weight is None or weight < 0:
        weight = 0
    tracked = 1 if extra.get("tracked", True) else 0
    physical = 1 if extra.get("physical", True) else 0
    continue_selling = 1 if extra.get("continue_selling") else 0
    sku = str(extra.get("sku") or "").strip() or None
    variant = str(extra.get("variant") or "").strip() or "Default"
    with connect() as db:
        cur = db.execute(
            "INSERT INTO products (title, price, stock, sold, description, status, category, product_type, vendor, color, media, extra) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)",
            (title, price, stock, description, status, category, product_type, vendor, color, media, json.dumps(extra)),
        )
        product_id = cur.lastrowid
        handle = product_handle(title, product_id)
        db.execute("UPDATE products SET handle = ? WHERE id = ?", (handle, product_id))
        db.execute(
            """INSERT INTO inventory
               (product, variant, sku, unavailable, committed, available, on_hand, incoming, price, weight, location, tracked, physical, continue_selling)
               VALUES (?, ?, ?, 0, 0, ?, ?, 0, ?, ?, 'Nairobi', ?, ?, ?)""",
            (title, variant, sku, stock, stock, price, weight, tracked, physical, continue_selling),
        )
        for tag in tags:
            db.execute("INSERT OR IGNORE INTO product_tags (product_id, tag) VALUES (?, ?)", (product_id, tag))
        for name in fields:
            db.execute("INSERT OR IGNORE INTO product_fields (product_id, name) VALUES (?, ?)", (product_id, name))
        for collection_id in collections:
            db.execute(
                "INSERT OR IGNORE INTO collection_products (collection_id, product) VALUES (?, ?)",
                (collection_id, title),
            )
        row = dict(db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone())
    return jsonify(row), 201


def product_handle(title, product_id):
    handle = "".join(ch.lower() if ch.isalnum() else "-" for ch in title).strip("-")
    handle = "-".join(part for part in handle.split("-") if part)
    return handle or f"product-{product_id}"


def load_product(product_id):
    rows = query("SELECT * FROM products WHERE id = ?", (product_id,))
    if not rows:
        return None
    product = rows[0]
    tags = [row["tag"] for row in query("SELECT tag FROM product_tags WHERE product_id = ? ORDER BY tag", (product_id,))]
    fields = [row["name"] for row in query("SELECT name FROM product_fields WHERE product_id = ? ORDER BY name", (product_id,))]
    collections = query(
        "SELECT c.id, c.title FROM collections c JOIN collection_products p ON p.collection_id = c.id WHERE p.product = ? ORDER BY c.title",
        (product["title"],),
    )
    store = query("SELECT domain FROM store WHERE id = 1")
    name = query("SELECT value FROM settings WHERE key = 'store_name'")
    return {
        "product": product,
        "tags": tags,
        "fields": fields,
        "collections": collections,
        "store": {
            "name": name[0]["value"] if name else "Maison",
            "domain": store[0]["domain"] if store else "maison.co.ke",
        },
    }


@bp.get("/api/products/<int:product_id>")
def product_detail(product_id):
    payload = load_product(product_id)
    if not payload:
        return jsonify(error="Product not found"), 404
    return jsonify(payload)


@bp.post("/api/products/<int:product_id>")
def product_action(product_id):
    if not query("SELECT id FROM products WHERE id = ?", (product_id,)):
        return jsonify(error="Product not found"), 404
    body = request.json or {}
    action = body.get("action")
    with connect() as db:
        product = dict(db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone())
        if action == "update":
            title = str(body.get("title") if body.get("title") is not None else product["title"]).strip()
            if not title:
                return jsonify(error="Title is required"), 400
            description = str(body.get("description") if body.get("description") is not None else product["description"])
            status = body.get("status") if body.get("status") in ("active", "draft", "archived") else product["status"]
            category = str(body.get("category") if body.get("category") is not None else product["category"]).strip()
            product_type = str(body.get("product_type") if body.get("product_type") is not None else product["product_type"]).strip()
            vendor = str(body.get("vendor") if body.get("vendor") is not None else product["vendor"]).strip()
            color = str(body.get("color") if body.get("color") is not None else product["color"]).strip()
            media = str(body.get("media") if body.get("media") is not None else product["media"]).strip()
            handle = str(body.get("handle") if body.get("handle") is not None else product["handle"]).strip() or product_handle(title, product_id)
            if title != product["title"]:
                db.execute("UPDATE collection_products SET product = ? WHERE product = ?", (title, product["title"]))
            db.execute(
                "UPDATE products SET title = ?, description = ?, status = ?, category = ?, product_type = ?, vendor = ?, color = ?, media = ?, handle = ? WHERE id = ?",
                (title, description, status, category, product_type, vendor, color, media, handle, product_id),
            )
        elif action == "tag":
            tag = str(body.get("tag") or "").strip()
            if not tag:
                return jsonify(error="Enter a tag"), 400
            if body.get("remove"):
                db.execute("DELETE FROM product_tags WHERE product_id = ? AND tag = ?", (product_id, tag))
            else:
                db.execute("INSERT OR IGNORE INTO product_tags (product_id, tag) VALUES (?, ?)", (product_id, tag))
        elif action == "collection":
            collection_id = body.get("collection")
            if body.get("remove"):
                db.execute(
                    "DELETE FROM collection_products WHERE collection_id = ? AND product = ?",
                    (collection_id, product["title"]),
                )
            else:
                db.execute(
                    "INSERT OR IGNORE INTO collection_products (collection_id, product) VALUES (?, ?)",
                    (collection_id, product["title"]),
                )
        elif action == "field":
            name = str(body.get("name") or "").strip()
            if not name:
                return jsonify(error="Enter a metafield"), 400
            if body.get("remove"):
                db.execute("DELETE FROM product_fields WHERE product_id = ? AND name = ?", (product_id, name))
            else:
                db.execute("INSERT OR IGNORE INTO product_fields (product_id, name) VALUES (?, ?)", (product_id, name))
        elif action == "archive":
            db.execute("UPDATE products SET status = 'archived' WHERE id = ?", (product_id,))
        elif action == "duplicate":
            copy_title = f"{product['title']} copy"
            handle = product_handle(copy_title, product_id + 1000)
            cur = db.execute(
                "INSERT INTO products (title, price, stock, sold, description, status, category, product_type, vendor, color, handle, media) VALUES (?, ?, ?, 0, ?, 'draft', ?, ?, ?, ?, ?, ?)",
                (copy_title, product["price"], product["stock"], product["description"], product["category"], product["product_type"], product["vendor"], product["color"], handle, product["media"]),
            )
            product_id = cur.lastrowid
            db.execute(
                "INSERT INTO product_tags (product_id, tag) SELECT ?, tag FROM product_tags WHERE product_id = ?",
                (product_id, product["id"]),
            )
            db.execute(
                "INSERT INTO product_fields (product_id, name) SELECT ?, name FROM product_fields WHERE product_id = ?",
                (product_id, product["id"]),
            )
        elif action == "delete":
            db.execute("DELETE FROM product_tags WHERE product_id = ?", (product_id,))
            db.execute("DELETE FROM product_fields WHERE product_id = ?", (product_id,))
            db.execute("DELETE FROM collection_products WHERE product = ?", (product["title"],))
            db.execute("DELETE FROM products WHERE id = ?", (product_id,))
            return jsonify(deleted=True)
        else:
            return jsonify(error="Unknown action"), 400
    return jsonify(load_product(product_id))


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
    found = query("SELECT * FROM collections WHERE id = ?", (collection_id,))
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
    conditions = str(body.get("conditions") or "").strip() or None
    names = []
    for item in body.get("products") or []:
        name = str(item or "").strip()
        if name and name not in names:
            names.append(name)
    single = str(body.get("product") or "").strip()
    if single and single not in names:
        names.append(single)
    channels = []
    for item in body.get("channels") or ["Online Store", "Agentic"]:
        name = str(item or "").strip()
        if name and name not in channels:
            channels.append(name)
    description = str(body.get("description") or "")
    image = str(body.get("image") or "")
    if len(image) > 400_000:
        image = ""
    theme = str(body.get("theme") or "Default collection")
    seo_title = str(body.get("seo_title") or "")
    seo_description = str(body.get("seo_description") or "")
    sort = str(body.get("sort") or "Best selling")
    excludes = str(body.get("excludes") or "")
    with connect() as db:
        cur = db.execute(
            """INSERT INTO collections
               (title, conditions, description, image, theme, seo_title, seo_description, sort, excludes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (title, conditions, description, image, theme, seo_title, seo_description, sort, excludes),
        )
        collection_id = cur.lastrowid
        db.executemany(
            "INSERT OR IGNORE INTO collection_products (collection_id, product) VALUES (?, ?)",
            [(collection_id, name) for name in names],
        )
        db.executemany(
            "INSERT OR IGNORE INTO collection_channels (collection_id, channel) VALUES (?, ?)",
            [(collection_id, name) for name in channels],
        )
    return jsonify(id=collection_id), 201


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


def _sheet_rows(data):
    if data[:2] == b"PK":
        return _xlsx_rows(data)
    if data[:8] == bytes.fromhex("D0CF11E0A1B11AE1"):
        raise ValueError("Save this workbook as CSV or .xlsx. The older .xls format is not read.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValueError("That file is not a CSV or .xlsx workbook.") from exc
    return list(csv.reader(io.StringIO(text)))


def _xlsx_rows(data):
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    tag = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    try:
        book = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise ValueError("That .xlsx file could not be read.") from exc
    with book:
        names = book.namelist()
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ElementTree.fromstring(book.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", ns):
                shared.append("".join(node.text or "" for node in item.iter(f"{tag}t")))
        sheet_name = next((item for item in names if item.startswith("xl/worksheets/sheet")), "")
        if not sheet_name:
            raise ValueError("That workbook has no sheet.")
        root = ElementTree.fromstring(book.read(sheet_name))
    rows = []
    for row in root.findall("m:sheetData/m:row", ns):
        cells = []
        for cell in row.findall("m:c", ns):
            ref = cell.attrib.get("r", "")
            col = 0
            for char in ref:
                if char.isalpha():
                    col = col * 26 + ord(char.upper()) - 64
                else:
                    break
            while len(cells) < max(col - 1, 0):
                cells.append("")
            node = cell.find("m:v", ns)
            value = node.text if node is not None and node.text else ""
            if cell.attrib.get("t") == "s" and value.isdigit():
                index = int(value)
                value = shared[index] if index < len(shared) else ""
            cells.append(value)
        rows.append(cells)
    return rows


def _inventory_updates(table):
    if not table or not any(cell.strip() for cell in table[0]):
        raise ValueError("The file is empty.")
    headers = [cell.strip().lower() for cell in table[0]]

    def pick(row, *keys):
        for key in keys:
            if key in headers:
                index = headers.index(key)
                if index < len(row) and str(row[index]).strip():
                    return str(row[index]).strip()
        return ""

    updates = []
    for raw in table[1:]:
        if not any(str(cell).strip() for cell in raw):
            continue
        product = pick(raw, "product", "title")
        variant = pick(raw, "variant", "option1 value", "option value") or "Default"
        sku = pick(raw, "sku")
        if sku.lower() == "no sku":
            sku = ""
        quantity = pick(raw, "on hand", "on hand (new)", "on_hand")
        if not quantity:
            continue
        try:
            on_hand = int(float(quantity))
        except ValueError as exc:
            label = product or sku or "A row"
            raise ValueError(f"{label} has an on-hand value that is not a number.") from exc
        if on_hand < 0:
            raise ValueError("On hand must be positive.")
        if not product and not sku:
            raise ValueError("Each row needs a product or a SKU.")
        updates.append({"product": product, "variant": variant, "sku": sku, "on_hand": on_hand})
    if not updates:
        raise ValueError("The file needs Product, Variant, and On hand columns.")
    return updates


@bp.post("/api/inventory/import")
def import_inventory():
    upload = request.files.get("file")
    if not upload:
        return jsonify(error="Choose a CSV or .xlsx file."), 400
    data = upload.read()
    if not data:
        return jsonify(error="That file is empty."), 400
    try:
        updates = _inventory_updates(_sheet_rows(data))
    except ValueError as exc:
        return jsonify(error=str(exc)), 400
    updated = []
    skipped = []
    with connect() as db:
        for row in updates:
            found = None
            if row["sku"]:
                match = db.execute("SELECT * FROM inventory WHERE sku = ?", (row["sku"],)).fetchone()
                found = dict(match) if match else None
            if not found and row["product"]:
                match = db.execute(
                    "SELECT * FROM inventory WHERE lower(product) = lower(?) AND lower(variant) = lower(?)",
                    (row["product"], row["variant"]),
                ).fetchone()
                found = dict(match) if match else None
            if not found:
                skipped.append(row["sku"] or f"{row['product']} / {row['variant']}")
                continue
            available = max(row["on_hand"] - found["unavailable"] - found["committed"], 0)
            db.execute(
                "UPDATE inventory SET on_hand = ?, available = ? WHERE id = ?",
                (row["on_hand"], available, found["id"]),
            )
            updated.append(found["id"])
    if not updated:
        return jsonify(error="No rows matched inventory. Use the product and variant, or a SKU."), 400
    return jsonify(updated=len(updated), skipped=skipped)


@bp.post("/api/inventory/<int:item_id>")
def inventory_action(item_id):
    if not query("SELECT id FROM inventory WHERE id = ?", (item_id,)):
        return jsonify(error="Variant not found"), 404
    body = request.json or {}
    action = body.get("action")
    with connect() as db:
        item = dict(db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone())
        if action == "update":
            variant = str(body.get("variant") if body.get("variant") is not None else item["variant"]).strip() or item["variant"]
            try:
                price = int(body.get("price") if body.get("price") is not None else item["price"])
                on_hand = int(body.get("on_hand") if body.get("on_hand") is not None else item["on_hand"])
                unavailable = int(body.get("unavailable") if body.get("unavailable") is not None else item["unavailable"])
                committed = int(body.get("committed") if body.get("committed") is not None else item["committed"])
                weight = int(body.get("weight") if body.get("weight") is not None else item["weight"])
            except (TypeError, ValueError):
                return jsonify(error="Quantities must be numbers"), 400
            available = max(on_hand - unavailable - committed, 0)
            location = str(body.get("location") if body.get("location") is not None else item["location"]).strip() or "Nairobi"
            tracked = 1 if body.get("tracked", item["tracked"]) else 0
            physical = 1 if body.get("physical", item["physical"]) else 0
            continue_selling = 1 if body.get("continue_selling", item["continue_selling"]) else 0
            db.execute(
                "UPDATE inventory SET variant = ?, price = ?, on_hand = ?, unavailable = ?, committed = ?, available = ?, weight = ?, location = ?, tracked = ?, physical = ?, continue_selling = ? WHERE id = ?",
                (variant, price, on_hand, unavailable, committed, available, weight, location, tracked, physical, continue_selling, item_id),
            )
        elif action == "duplicate":
            cur = db.execute(
                "INSERT INTO inventory (product, variant, sku, unavailable, committed, available, on_hand, incoming, price, weight, location, tracked, physical, continue_selling) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (item["product"], f"{item['variant']} copy", item["sku"], item["unavailable"], item["committed"], item["available"], item["on_hand"], item["incoming"], item["price"], item["weight"], item["location"], item["tracked"], item["physical"], item["continue_selling"]),
            )
            item_id = cur.lastrowid
        elif action == "delete":
            db.execute("DELETE FROM inventory WHERE id = ?", (item_id,))
            return jsonify(deleted=True)
        else:
            return jsonify(error="Unknown action"), 400
        row = dict(db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone())
    return jsonify(row)


@bp.get("/api/purchase-orders")
def purchase_orders():
    return jsonify(query("SELECT * FROM purchase_orders ORDER BY id DESC"))


@bp.get("/api/purchase-orders/<int:po_id>")
def purchase_order(po_id):
    found = query("SELECT * FROM purchase_orders WHERE id = ?", (po_id,))
    if not found:
        return jsonify(error="Purchase order not found"), 404
    return jsonify(found[0])


@bp.post("/api/purchase-orders/<int:po_id>")
def purchase_order_action(po_id):
    if not query("SELECT id FROM purchase_orders WHERE id = ?", (po_id,)):
        return jsonify(error="Purchase order not found"), 404
    body = request.json or {}
    action = body.get("action")
    with connect() as db:
        current = db.execute("SELECT status FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
        if action == "order":
            db.execute("UPDATE purchase_orders SET status = 'ordered' WHERE id = ?", (po_id,))
        elif action == "lines":
            if current["status"] == "ordered":
                return jsonify(error="This purchase order is already ordered."), 400
            lines = body.get("lines") if isinstance(body.get("lines"), list) else []
            db.execute("UPDATE purchase_orders SET lines = ? WHERE id = ?", (json.dumps(lines), po_id))
        else:
            return jsonify(error="Unknown action"), 400
        row = dict(db.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone())
    return jsonify(row)


@bp.post("/api/purchase-orders")
def create_purchase_order():
    body = request.json or {}
    supplier = str(body.get("supplier") or "").strip()
    if not supplier:
        return jsonify(error="Supplier is required"), 400
    created = datetime.now().replace(microsecond=0).isoformat()
    lines = body.get("lines") if isinstance(body.get("lines"), list) else []
    with connect() as db:
        cur = db.execute(
            "INSERT INTO purchase_orders (supplier, status, created_at, destination, reference, note, terms, currency, tags, lines) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                supplier, created,
                str(body.get("destination") or "").strip(),
                str(body.get("reference") or "")[:255],
                str(body.get("note") or "")[:5000],
                str(body.get("terms") or "").strip(),
                str(body.get("currency") or "KES").strip() or "KES",
                str(body.get("tags") or "")[:40],
                json.dumps(lines),
            ),
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
    lines = body.get("lines") if isinstance(body.get("lines"), list) else []
    with connect() as db:
        cur = db.execute(
            "INSERT INTO transfers (origin, destination, status, created_at, reference, note, tags, lines, purchase_order) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)",
            (
                origin, destination, created,
                str(body.get("reference") or "").strip(),
                str(body.get("note") or "").strip(),
                str(body.get("tags") or "").strip(),
                json.dumps(lines),
                str(body.get("purchase_order") or "").strip(),
            ),
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
    code = str(body.get("code") or "").strip()
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
            "INSERT INTO gift_cards (code, customer, balance, status, note, expires) VALUES (?, ?, ?, 'active', ?, ?)",
            (code, customer or None, balance, str(body.get("note") or "").strip(), str(body.get("expires") or "").strip()),
        )
        row = dict(db.execute("SELECT * FROM gift_cards WHERE id = ?", (cur.lastrowid,)).fetchone())
    return jsonify(row), 201

