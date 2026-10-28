from datetime import datetime

from db import add_event, attach_new_order, connect, query
from models.base import Model
from serializers.base import ValidationError
from serializers.drafts import draft_detail


class Draft(Model):
    table = "drafts"
    order = "created_at DESC"

    @staticmethod
    def next_id(db):
        nums = [int(row["id"][1:]) for row in db.execute("SELECT id FROM drafts") if str(row["id"])[1:].isdigit()]
        return f"D{max(nums, default=0) + 1}"

    @staticmethod
    def source_lines(db, draft):
        if draft["order_id"]:
            rows = db.execute(
                "SELECT title, price, qty, line_total, size, color FROM order_lines WHERE order_id = ? ORDER BY id",
                (draft["order_id"],),
            ).fetchall()
        else:
            rows = db.execute(
                "SELECT title, price, qty, line_total, size, color FROM draft_lines WHERE draft_id = ? ORDER BY id",
                (draft["id"],),
            ).fetchall()
        if rows:
            return [dict(row) for row in rows]
        return [{"title": "Draft items", "price": draft["total"], "qty": 1, "line_total": draft["total"], "size": "", "color": ""}]

    @staticmethod
    def copy_lines(db, draft_id, lines):
        db.executemany(
            "INSERT INTO draft_lines (draft_id, title, price, qty, line_total, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [(draft_id, line["title"], line["price"], line["qty"], line["line_total"], line.get("size") or "", line.get("color") or "") for line in lines],
        )

    @classmethod
    def load(cls, draft_id):
        rows = query("SELECT * FROM drafts WHERE id = ?", (draft_id,))
        if not rows:
            return None
        draft = rows[0]
        if draft["order_id"]:
            lines = query("SELECT id, title, price, qty, line_total, size, color FROM order_lines WHERE order_id = ? ORDER BY id", (draft["order_id"],))
            address = query("SELECT name, line, city, country, billing_same FROM order_address WHERE order_id = ?", (draft["order_id"],))
        else:
            lines = query("SELECT id, title, price, qty, line_total, size, color FROM draft_lines WHERE draft_id = ? ORDER BY id", (draft_id,))
            address = []
        if not lines and draft["total"]:
            lines = [{"id": 0, "title": "Draft items", "price": draft["total"], "qty": 1, "line_total": draft["total"], "size": "", "color": ""}]
        if not address:
            person = query("SELECT location FROM customers WHERE name = ?", (draft["customer"],))
            city = person[0]["location"] if person else "Nairobi"
            address = [{"name": draft["customer"], "line": "", "city": city, "country": "Kenya", "billing_same": 1}]
        comments = query("SELECT id, created_at, kind, body FROM draft_events WHERE draft_id = ? ORDER BY id DESC", (draft_id,))
        people = query("SELECT email, phone, address, location FROM customers WHERE name = ?", (draft["customer"],))
        count = query("SELECT COUNT(*) AS n FROM orders WHERE customer = ?", (draft["customer"],))[0]["n"]
        return draft_detail(draft, lines, address[0], comments, people, count)

    @classmethod
    def create(cls, fields):
        created = datetime.now().replace(microsecond=0).isoformat()
        with connect() as db:
            draft_id = cls.next_id(db)
            db.execute(
                """INSERT INTO drafts (id, po, created_at, customer, status, total, note, tags, discount, shipping, currency, phone, email, address)
                   VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (draft_id, fields["po"], created, fields["customer"], fields["total"], fields["note"], fields["tags"], fields["discount"], fields["shipping"], fields["currency"], fields["phone"], fields["email"], fields["address"]),
            )
            if fields["lines"]:
                cls.copy_lines(db, draft_id, fields["lines"])
            elif fields["total"]:
                db.execute(
                    "INSERT INTO draft_lines (draft_id, title, price, qty, line_total) VALUES (?, 'Draft items', ?, 1, ?)",
                    (draft_id, fields["total"], fields["total"]),
                )
            if fields["note"]:
                db.execute(
                    "INSERT INTO draft_events (draft_id, created_at, kind, body) VALUES (?, ?, 'comment', ?)",
                    (draft_id, created, fields["note"]),
                )
            row = dict(db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone())
        return row

    @classmethod
    def act(cls, draft_id, body):
        action = body.get("action")
        opened = None
        with connect() as db:
            draft = dict(db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone())
            if action == "comment":
                text = str(body.get("body") or "").strip()
                if not text:
                    raise ValidationError("Write a comment first")
                db.execute(
                    "INSERT INTO draft_events (draft_id, created_at, kind, body) VALUES (?, ?, 'comment', ?)",
                    (draft_id, datetime.now().replace(microsecond=0).isoformat(), text),
                )
            elif action == "invoice":
                db.execute(
                    "INSERT INTO draft_events (draft_id, created_at, kind, body) VALUES (?, ?, 'event', ?)",
                    (draft_id, datetime.now().replace(microsecond=0).isoformat(), f"You sent an invoice to {draft['customer']} with a checkout link."),
                )
            elif action == "duplicate":
                opened = cls.next_id(db)
                db.execute(
                    """INSERT INTO drafts (id, po, created_at, customer, status, total, note, tags, discount, shipping, currency, phone, email, address)
                       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        opened, draft["po"], datetime.now().replace(microsecond=0).isoformat(), draft["customer"], draft["total"],
                        draft.get("note") or "", draft.get("tags") or "", draft.get("discount") or 0, draft.get("shipping") or 0, draft.get("currency") or "KES",
                        draft.get("phone") or "", draft.get("email") or "", draft.get("address") or "",
                    ),
                )
                cls.copy_lines(db, opened, cls.source_lines(db, draft))
            elif action == "order":
                created = datetime.now().replace(microsecond=0).isoformat()
                opened = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
                items = sum(line["qty"] for line in cls.source_lines(db, draft)) or 1
                payment = "paid" if body.get("payment") == "paid" else "pending"
                db.execute(
                    "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, NULL, 'Draft Orders', ?, ?, 'unfulfilled', ?, NULL, 'Shipping')",
                    (opened, created, draft["customer"], draft["total"], payment, items),
                )
                existing = db.execute("SELECT id FROM customers WHERE name = ?", (draft["customer"],)).fetchone()
                if existing:
                    db.execute("UPDATE customers SET orders = orders + 1, spent = spent + ? WHERE id = ?", (draft["total"], existing["id"]))
                else:
                    db.execute(
                        "INSERT INTO customers (name, email, location, orders, spent) VALUES (?, '', 'Nairobi', 1, ?)",
                        (draft["customer"], draft["total"]),
                    )
                row = dict(db.execute("SELECT * FROM orders WHERE id = ?", (opened,)).fetchone())
                attach_new_order(db, row)
                if draft.get("note"):
                    db.execute("UPDATE order_detail SET note = ? WHERE order_id = ?", (draft["note"], opened))
                for tag in [part.strip() for part in str(draft.get("tags") or "").split(",") if part.strip()]:
                    db.execute("INSERT OR IGNORE INTO order_tags (order_id, tag) VALUES (?, ?)", (opened, tag))
                db.execute("DELETE FROM order_lines WHERE order_id = ? AND title = 'Order items'", (opened,))
                for line in cls.source_lines(db, draft):
                    db.execute(
                        "INSERT INTO order_lines (order_id, title, price, qty, line_total, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (opened, line["title"], line["price"], line["qty"], line["line_total"], line.get("size") or "", line.get("color") or ""),
                    )
                if payment == "paid":
                    add_event(db, opened, f"You marked draft #{draft_id} as paid.", created_at=created)
                db.execute("UPDATE drafts SET status = 'completed', order_id = ? WHERE id = ?", (opened, draft_id))
            else:
                raise ValidationError("Unknown action")
        if action == "duplicate":
            return cls.load(opened)
        if action == "order":
            return {"order_id": opened}
        return cls.load(draft_id)


class Checkout(Model):
    table = "checkouts"
    order = "created_at DESC"
