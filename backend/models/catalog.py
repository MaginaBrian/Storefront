import json
from datetime import datetime

from db import connect, query
from models.base import Model
from serializers.base import ValidationError
from serializers.catalog import po_text, product_handle


class Product(Model):
    table = "products"
    order = "id"

    @classmethod
    def listing(cls):
        rows = query("SELECT * FROM products ORDER BY id")
        grouped = {}
        for tag in query("SELECT product_id, tag FROM product_tags ORDER BY tag"):
            grouped.setdefault(tag["product_id"], []).append(tag["tag"])
        for row in rows:
            row["tags"] = grouped.get(row["id"], [])
        return rows

    @classmethod
    def load(cls, product_id):
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

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO products (title, price, stock, sold, description, status, category, product_type, vendor, color, media, extra) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)",
                (fields["title"], fields["price"], fields["stock"], fields["description"], fields["status"], fields["category"], fields["product_type"], fields["vendor"], fields["color"], fields["media"], json.dumps(fields["extra"])),
            )
            product_id = cur.lastrowid
            handle = product_handle(fields["title"], product_id)
            db.execute("UPDATE products SET handle = ? WHERE id = ?", (handle, product_id))
            db.execute(
                """INSERT INTO inventory
                   (product, variant, sku, unavailable, committed, available, on_hand, incoming, price, weight, location, tracked, physical, continue_selling)
                   VALUES (?, ?, ?, 0, 0, ?, ?, 0, ?, ?, 'Nairobi', ?, ?, ?)""",
                (fields["title"], fields["variant"], fields["sku"], fields["stock"], fields["stock"], fields["price"], fields["weight"], fields["tracked"], fields["physical"], fields["continue_selling"]),
            )
            for tag in fields["tags"]:
                db.execute("INSERT OR IGNORE INTO product_tags (product_id, tag) VALUES (?, ?)", (product_id, tag))
            for name in fields["fields"]:
                db.execute("INSERT OR IGNORE INTO product_fields (product_id, name) VALUES (?, ?)", (product_id, name))
            for collection_id in fields["collections"]:
                db.execute(
                    "INSERT OR IGNORE INTO collection_products (collection_id, product) VALUES (?, ?)",
                    (collection_id, fields["title"]),
                )
            row = dict(db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone())
        return row

    @classmethod
    def act(cls, product_id, body):
        action = body.get("action")
        with connect() as db:
            product = dict(db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone())
            if action == "update":
                title = str(body.get("title") if body.get("title") is not None else product["title"]).strip()
                if not title:
                    raise ValidationError("Title is required")
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
                    raise ValidationError("Enter a tag")
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
                    raise ValidationError("Enter a metafield")
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
                return {"deleted": True}
            else:
                raise ValidationError("Unknown action")
        return cls.load(product_id)


class Collection(Model):
    table = "collections"
    order = "id"

    @classmethod
    def listing(cls):
        rows = []
        for row in query("SELECT id, title, conditions FROM collections ORDER BY id"):
            products = query("SELECT COUNT(*) AS n FROM collection_products WHERE collection_id = ?", (row["id"],))[0]["n"]
            channels = query("SELECT COUNT(*) AS n FROM collection_channels WHERE collection_id = ?", (row["id"],))[0]["n"]
            rows.append({**row, "products": products, "channels": channels})
        return rows

    @classmethod
    def load(cls, collection_id):
        found = query("SELECT * FROM collections WHERE id = ?", (collection_id,))
        if not found:
            return None
        return {
            "collection": found[0],
            "products": query("SELECT product FROM collection_products WHERE collection_id = ? ORDER BY product", (collection_id,)),
            "channels": query("SELECT channel FROM collection_channels WHERE collection_id = ? ORDER BY channel", (collection_id,)),
        }

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                """INSERT INTO collections
                   (title, conditions, description, image, theme, seo_title, seo_description, sort, excludes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (fields["title"], fields["conditions"], fields["description"], fields["image"], fields["theme"], fields["seo_title"], fields["seo_description"], fields["sort"], fields["excludes"]),
            )
            collection_id = cur.lastrowid
            db.executemany(
                "INSERT OR IGNORE INTO collection_products (collection_id, product) VALUES (?, ?)",
                [(collection_id, name) for name in fields["names"]],
            )
            db.executemany(
                "INSERT OR IGNORE INTO collection_channels (collection_id, channel) VALUES (?, ?)",
                [(collection_id, name) for name in fields["channels"]],
            )
        return {"id": collection_id}


class Inventory(Model):
    table = "inventory"
    order = "id"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO inventory (product, variant, sku, unavailable, committed, available, on_hand, incoming) VALUES (?, ?, NULL, 0, 0, ?, ?, 0)",
                (fields["product"], fields["variant"], fields["on_hand"], fields["on_hand"]),
            )
            return dict(db.execute("SELECT * FROM inventory WHERE id = ?", (cur.lastrowid,)).fetchone())

    @classmethod
    def apply_import(cls, updates):
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
            raise ValidationError("No rows matched inventory. Use the product and variant, or a SKU.")
        return {"updated": len(updated), "skipped": skipped}

    @classmethod
    def act(cls, item_id, body):
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
                    raise ValidationError("Quantities must be numbers") from None
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
                return {"deleted": True}
            else:
                raise ValidationError("Unknown action")
            return dict(db.execute("SELECT * FROM inventory WHERE id = ?", (item_id,)).fetchone())


class PurchaseOrder(Model):
    table = "purchase_orders"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        created = datetime.now().replace(microsecond=0).isoformat()
        with connect() as db:
            cur = db.execute(
                "INSERT INTO purchase_orders (supplier, status, created_at, destination, reference, note, terms, currency, tags, lines) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)",
                (fields["supplier"], created, fields["destination"], fields["reference"], fields["note"], fields["terms"], fields["currency"], fields["tags"], json.dumps(fields["lines"])),
            )
            return dict(db.execute("SELECT * FROM purchase_orders WHERE id = ?", (cur.lastrowid,)).fetchone())

    @classmethod
    def act(cls, po_id, body):
        action = body.get("action")
        with connect() as db:
            current = db.execute("SELECT * FROM purchase_orders WHERE id = ?", (po_id,)).fetchone()
            if not current:
                raise ValidationError("Purchase order not found", 404)
            status = current["status"]
            target = po_id
            if action == "order":
                if status == "archived":
                    raise ValidationError("This purchase order is archived.")
                db.execute("UPDATE purchase_orders SET status = 'ordered' WHERE id = ?", (po_id,))
            elif action == "archive":
                db.execute("UPDATE purchase_orders SET status = 'archived' WHERE id = ?", (po_id,))
            elif action == "delete":
                db.execute("DELETE FROM purchase_orders WHERE id = ?", (po_id,))
                return {"deleted": True}
            elif action == "duplicate":
                created = datetime.now().replace(microsecond=0).isoformat()
                cur = db.execute(
                    "INSERT INTO purchase_orders (supplier, status, created_at, destination, reference, note, terms, currency, tags, lines, comments) VALUES (?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, '[]')",
                    (current["supplier"], created, current["destination"], current["reference"], current["note"], current["terms"], current["currency"], current["tags"], current["lines"]),
                )
                target = cur.lastrowid
            elif action == "comment":
                text = str(body.get("body") or "").strip()
                if not text:
                    raise ValidationError("Write a comment.")
                try:
                    comments = json.loads(current["comments"] or "[]")
                except json.JSONDecodeError:
                    comments = []
                if not isinstance(comments, list):
                    comments = []
                comments.append({"body": text[:2000], "created_at": datetime.now().replace(microsecond=0).isoformat()})
                db.execute("UPDATE purchase_orders SET comments = ? WHERE id = ?", (json.dumps(comments), po_id))
            elif action == "lines":
                if status != "draft":
                    raise ValidationError("This purchase order can no longer be edited.")
                lines = body.get("lines") if isinstance(body.get("lines"), list) else []
                db.execute("UPDATE purchase_orders SET lines = ? WHERE id = ?", (json.dumps(lines), po_id))
            elif action == "update":
                if status == "archived":
                    raise ValidationError("This purchase order is archived.")
                fields, values = [], []
                for key, limit in (("supplier", 120), ("destination", 80), ("reference", 255), ("note", 5000), ("terms", 40), ("tags", 40)):
                    if key not in body:
                        continue
                    fields.append(f"{key} = ?")
                    values.append(po_text(body, key, limit).strip() if key != "note" else po_text(body, key, limit))
                if status == "draft" and isinstance(body.get("lines"), list):
                    fields.append("lines = ?")
                    values.append(json.dumps(body["lines"]))
                if not fields:
                    raise ValidationError("Nothing to update")
                values.append(po_id)
                db.execute(f"UPDATE purchase_orders SET {', '.join(fields)} WHERE id = ?", values)
            else:
                raise ValidationError("Unknown action")
            return dict(db.execute("SELECT * FROM purchase_orders WHERE id = ?", (target,)).fetchone())


class Transfer(Model):
    table = "transfers"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        created = datetime.now().replace(microsecond=0).isoformat()
        with connect() as db:
            cur = db.execute(
                "INSERT INTO transfers (origin, destination, status, created_at, reference, note, tags, lines, purchase_order) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?)",
                (fields["origin"], fields["destination"], created, fields["reference"], fields["note"], fields["tags"], json.dumps(fields["lines"]), fields["purchase_order"]),
            )
            return dict(db.execute("SELECT * FROM transfers WHERE id = ?", (cur.lastrowid,)).fetchone())

    @classmethod
    def link(cls, transfer_id, body):
        if body.get("action") != "link":
            raise ValidationError("Unknown action")
        with connect() as db:
            found = db.execute("SELECT id FROM transfers WHERE id = ?", (transfer_id,)).fetchone()
            if not found:
                raise ValidationError("Transfer not found", 404)
            db.execute("UPDATE transfers SET purchase_order = ? WHERE id = ?", (str(body.get("purchase_order") or "").strip(), transfer_id))
            return dict(db.execute("SELECT * FROM transfers WHERE id = ?", (transfer_id,)).fetchone())


class GiftCard(Model):
    table = "gift_cards"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO gift_cards (code, customer, balance, status, note, expires) VALUES (?, ?, ?, 'active', ?, ?)",
                (fields["code"], fields["customer"], fields["balance"], fields["note"], fields["expires"]),
            )
            return dict(db.execute("SELECT * FROM gift_cards WHERE id = ?", (cur.lastrowid,)).fetchone())
