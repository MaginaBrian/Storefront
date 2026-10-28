from datetime import date, datetime

from db import add_event, attach_new_order, connect, query
from models.base import Model
from serializers.orders import order_detail


class Order(Model):
    table = "orders"
    order = "created_at DESC"

    @classmethod
    def lines(cls):
        return query(
            """SELECT o.id AS order_id, o.created_at, o.customer, l.title, l.price, l.qty, l.line_total, l.size, l.color
               FROM order_lines l JOIN orders o ON o.id = l.order_id
               ORDER BY o.created_at DESC, l.id"""
        )

    @classmethod
    def overview(cls):
        orders = query("SELECT total, fulfillment, payment FROM orders")
        return {
            "sessions": 4,
            "orders": len(orders),
            "conversion": 100,
            "total_sales": sum(order["total"] for order in orders),
            "currency": "KES",
            "to_fulfill": sum(order["fulfillment"] == "unfulfilled" for order in orders),
            "to_capture": sum(order["payment"] != "paid" for order in orders),
        }

    @classmethod
    def today(cls):
        today = date.today().isoformat()
        orders = query("SELECT created_at, items, fulfillment, delivery_status FROM orders")
        todays = [order for order in orders if order["created_at"].startswith(today)]
        return {
            "orders": len(todays),
            "items": sum(order["items"] for order in todays),
            "reversals": 0,
            "fulfilled": sum(order["fulfillment"] == "fulfilled" for order in todays),
            "delivered": sum(order["delivery_status"] == "delivered" for order in todays),
            "unfulfilled": sum(order["fulfillment"] == "unfulfilled" for order in orders),
        }

    @classmethod
    def profile(cls, name):
        found = query("SELECT * FROM customers WHERE name = ?", (name,))
        return {
            "customer": found[0] if found else None,
            "orders": query("SELECT id, created_at, total, payment, fulfillment, channel, items FROM orders WHERE customer = ? ORDER BY created_at DESC", (name,)),
            "drafts": query("SELECT id, created_at, total, status, order_id FROM drafts WHERE customer = ? ORDER BY created_at DESC", (name,)),
        }

    @classmethod
    def load(cls, order_id):
        rows = query("SELECT * FROM orders WHERE id = ?", (order_id,))
        if not rows:
            return None
        order = rows[0]
        detail = query("SELECT confirmation, note FROM order_detail WHERE order_id = ?", (order_id,))
        address = query("SELECT name, line, city, country, billing_same FROM order_address WHERE order_id = ?", (order_id,))
        lines = query("SELECT id, title, price, qty, line_total, size, color FROM order_lines WHERE order_id = ? ORDER BY id", (order_id,))
        tags = [row["tag"] for row in query("SELECT tag FROM order_tags WHERE order_id = ? ORDER BY tag", (order_id,))]
        events = query("SELECT id, created_at, kind, body, draft_id FROM order_events WHERE order_id = ? ORDER BY id DESC", (order_id,))
        people = query("SELECT email, location FROM customers WHERE name = ?", (order["customer"],))
        count = query("SELECT COUNT(*) AS n FROM orders WHERE customer = ?", (order["customer"],))[0]["n"]
        draft = query("SELECT id FROM drafts WHERE order_id = ?", (order_id,))
        return order_detail(order, detail, address, lines, tags, events, people, count, draft[0]["id"] if draft else None)

    @staticmethod
    def _shift_customer(db, name, email, phone, delta_orders, delta_spent):
        row = db.execute("SELECT id, orders, spent, email, phone FROM customers WHERE name = ?", (name,)).fetchone()
        if row is None:
            if delta_orders <= 0 and delta_spent == 0:
                return
            db.execute(
                "INSERT INTO customers (name, email, location, orders, spent, phone) VALUES (?, ?, 'Nairobi', ?, ?, ?)",
                (name, email or "", max(delta_orders, 0), delta_spent, phone or ""),
            )
            return
        orders = row["orders"] + delta_orders
        spent = row["spent"] + delta_spent
        if orders <= 0:
            db.execute("DELETE FROM customers WHERE id = ?", (row["id"],))
            return
        db.execute(
            "UPDATE customers SET orders = ?, spent = ?, email = ?, phone = ? WHERE id = ?",
            (orders, spent, email or row["email"] or "", phone or row["phone"] or "", row["id"]),
        )

    @staticmethod
    def _write_lines(db, order_id, lines):
        db.execute("DELETE FROM order_lines WHERE order_id = ?", (order_id,))
        for line in lines:
            db.execute(
                "INSERT INTO order_lines (order_id, title, price, qty, line_total, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (order_id, line["title"], line["price"], line["qty"], line["line_total"], line["size"], line["color"]),
            )

    @classmethod
    def create(cls, fields):
        created = datetime.now().replace(microsecond=0).isoformat()
        with connect() as db:
            next_id = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
            db.execute(
                "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, NULL, ?, ?, ?, 'unfulfilled', ?, NULL, 'Shipping')",
                (next_id, created, fields["customer"], fields["channel"], fields["total"], fields["payment"], fields["items"]),
            )
            existing = db.execute("SELECT id FROM customers WHERE name = ?", (fields["customer"],)).fetchone()
            if existing:
                db.execute("UPDATE customers SET orders = orders + 1, spent = spent + ? WHERE id = ?", (fields["total"], existing["id"]))
            else:
                db.execute(
                    "INSERT INTO customers (name, email, location, orders, spent) VALUES (?, '', 'Nairobi', 1, ?)",
                    (fields["customer"], fields["total"]),
                )
            row = dict(db.execute("SELECT * FROM orders WHERE id = ?", (next_id,)).fetchone())
            attach_new_order(db, row)
        return row

    @classmethod
    def sync_cosine(cls, fields):
        with connect() as db:
            existing = db.execute("SELECT * FROM orders WHERE external_ref = ?", (fields["ref"],)).fetchone()
            if existing:
                order_id = existing["id"]
                if existing["customer"] != fields["customer"]:
                    cls._shift_customer(db, existing["customer"], "", "", -1, -existing["total"])
                    cls._shift_customer(db, fields["customer"], fields["email"], fields["phone"], 1, fields["total"])
                else:
                    cls._shift_customer(db, fields["customer"], fields["email"], fields["phone"], 0, fields["total"] - existing["total"])
                db.execute(
                    "UPDATE orders SET created_at = ?, customer = ?, total = ?, items = ? WHERE id = ?",
                    (fields["created"], fields["customer"], fields["total"], fields["items"], order_id),
                )
                db.execute("UPDATE order_detail SET note = ? WHERE order_id = ?", (fields["note"], order_id))
                db.execute(
                    "UPDATE order_address SET name = ?, line = ? WHERE order_id = ?",
                    (fields["contact"], fields["phone"], order_id),
                )
                add_event(db, order_id, f"Cosine Create updated {fields['ref']}.")
            else:
                order_id = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
                db.execute(
                    """INSERT INTO orders
                       (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method, external_ref)
                       VALUES (?, ?, ?, NULL, 'Online Store', ?, 'pending', 'unfulfilled', ?, NULL, 'Shipping', ?)""",
                    (order_id, fields["created"], fields["customer"], fields["total"], fields["items"], fields["ref"]),
                )
                cls._shift_customer(db, fields["customer"], fields["email"], fields["phone"], 1, fields["total"])
                row = dict(db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone())
                attach_new_order(db, row)
                db.execute("UPDATE order_detail SET note = ? WHERE order_id = ?", (fields["note"], order_id))
                db.execute(
                    "UPDATE order_address SET name = ?, line = ? WHERE order_id = ?",
                    (fields["contact"], fields["phone"], order_id),
                )
                add_event(db, order_id, f"Cosine Create sent {fields['ref']}.")
            cls._write_lines(db, order_id, fields["lines"])
            saved = dict(db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone())
            status = 200 if existing else 201
        return saved, status

    @classmethod
    def remove_cosine(cls, ref):
        with connect() as db:
            existing = db.execute("SELECT * FROM orders WHERE external_ref = ?", (ref,)).fetchone()
            if existing is None:
                return {"ok": True, "removed": False}
            order_id = existing["id"]
            cls._shift_customer(db, existing["customer"], "", "", -1, -existing["total"])
            for table in ("order_lines", "order_detail", "order_address", "order_tags", "order_events"):
                db.execute(f"DELETE FROM {table} WHERE order_id = ?", (order_id,))
            db.execute("DELETE FROM orders WHERE id = ?", (order_id,))
        return {"ok": True, "removed": True}

    @classmethod
    def act(cls, order_id, body):
        from serializers.base import ValidationError

        action = body.get("action")
        with connect() as db:
            order = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
            if action == "fulfill":
                db.execute("UPDATE orders SET fulfillment = 'fulfilled' WHERE id = ?", (order_id,))
                add_event(db, order_id, "You marked this order as fulfilled.")
            elif action == "pay":
                db.execute("UPDATE orders SET payment = 'paid' WHERE id = ?", (order_id,))
                add_event(db, order_id, "You marked this order as paid.")
            elif action == "invoice":
                add_event(db, order_id, f"You sent an invoice to {order['customer']}.")
            elif action == "restock":
                add_event(db, order_id, f"You restocked {order['items']:,} unfulfilled items from this order.")
            elif action == "note":
                note = str(body.get("note") or "").strip()
                db.execute("UPDATE order_detail SET note = ? WHERE order_id = ?", (note, order_id))
                if note:
                    add_event(db, order_id, "You updated the note on this order.")
            elif action == "address":
                line = str(body.get("line") or "").strip()
                city = str(body.get("city") or "").strip()
                country = str(body.get("country") or "").strip() or "Kenya"
                db.execute(
                    "UPDATE order_address SET line = ?, city = ?, country = ? WHERE order_id = ?",
                    (line, city, country, order_id),
                )
                add_event(db, order_id, "You updated the shipping address.")
            elif action == "tag":
                tag = str(body.get("tag") or "").strip()
                if not tag:
                    raise ValidationError("Enter a tag")
                if body.get("remove"):
                    db.execute("DELETE FROM order_tags WHERE order_id = ? AND tag = ?", (order_id, tag))
                else:
                    db.execute("INSERT OR IGNORE INTO order_tags (order_id, tag) VALUES (?, ?)", (order_id, tag))
            elif action == "comment":
                text = str(body.get("body") or "").strip()
                if not text:
                    raise ValidationError("Write a comment first")
                add_event(db, order_id, text, kind="comment")
            else:
                raise ValidationError("Unknown action")
        return cls.load(order_id)
