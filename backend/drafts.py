from datetime import datetime

from flask import Blueprint, jsonify, request

from db import attach_new_order, connect, query

bp = Blueprint("drafts", __name__)

def next_draft_id(db):
    nums = [int(row["id"][1:]) for row in db.execute("SELECT id FROM drafts") if str(row["id"])[1:].isdigit()]
    return f"D{max(nums, default=0) + 1}"


def draft_source_lines(db, draft):
    if draft["order_id"]:
        rows = db.execute(
            "SELECT title, price, qty, line_total FROM order_lines WHERE order_id = ? ORDER BY id",
            (draft["order_id"],),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT title, price, qty, line_total FROM draft_lines WHERE draft_id = ? ORDER BY id",
            (draft["id"],),
        ).fetchall()
    if rows:
        return [dict(row) for row in rows]
    return [{"title": "Draft items", "price": draft["total"], "qty": 1, "line_total": draft["total"]}]


def copy_draft_lines(db, draft_id, lines):
    db.executemany(
        "INSERT INTO draft_lines (draft_id, title, price, qty, line_total) VALUES (?, ?, ?, ?, ?)",
        [(draft_id, line["title"], line["price"], line["qty"], line["line_total"]) for line in lines],
    )

def load_draft(draft_id):
    rows = query("SELECT * FROM drafts WHERE id = ?", (draft_id,))
    if not rows:
        return None
    draft = rows[0]
    if draft["order_id"]:
        lines = query("SELECT id, title, price, qty, line_total FROM order_lines WHERE order_id = ? ORDER BY id", (draft["order_id"],))
        address = query("SELECT name, line, city, country, billing_same FROM order_address WHERE order_id = ?", (draft["order_id"],))
    else:
        lines = query("SELECT id, title, price, qty, line_total FROM draft_lines WHERE draft_id = ? ORDER BY id", (draft_id,))
        address = []
    if not lines:
        lines = [{"id": 0, "title": "Draft items", "price": draft["total"], "qty": 1, "line_total": draft["total"]}]
    if not address:
        person = query("SELECT location FROM customers WHERE name = ?", (draft["customer"],))
        city = person[0]["location"] if person else "Nairobi"
        address = [{"name": draft["customer"], "line": "", "city": city, "country": "Kenya", "billing_same": 1}]
    comments = query("SELECT id, created_at, kind, body FROM draft_events WHERE draft_id = ? ORDER BY id DESC", (draft_id,))
    events = [{**row, "order_id": None, "rank": 0} for row in comments]
    if draft["order_id"]:
        events.append({
            "id": f"order-{draft['order_id']}",
            "created_at": draft["created_at"],
            "kind": "event",
            "body": f"Order #{draft['order_id']} was created from this draft order.",
            "order_id": draft["order_id"],
            "rank": 1,
        })
    events.append({
        "id": f"created-{draft_id}",
        "created_at": draft["created_at"],
        "kind": "event",
        "body": "You created this draft order.",
        "order_id": None,
        "rank": 2,
    })
    events.sort(key=lambda event: (event["created_at"], -event["rank"]), reverse=True)
    people = query("SELECT email, location FROM customers WHERE name = ?", (draft["customer"],))
    count = query("SELECT COUNT(*) AS n FROM orders WHERE customer = ?", (draft["customer"],))[0]["n"]
    total = draft["total"]
    return {
        "draft": draft,
        "lines": lines,
        "address": address[0],
        "customer": {
            "name": draft["customer"],
            "email": people[0]["email"] if people else "",
            "location": people[0]["location"] if people else "",
            "orders": count,
        },
        "market": "Kenya",
        "currency": "Kenyan Shilling (KES)",
        "events": events,
        "summary": {
            "items": sum(line["qty"] for line in lines),
            "subtotal": total,
            "discount": 0,
            "shipping": 0,
            "tax": round(total * 16 / 116),
            "tax_label": "16% VAT",
            "total": total,
            "due_note": "Payment due when order is fulfilled.",
        },
    }

@bp.get("/api/drafts")
def drafts():
    return jsonify(query("SELECT * FROM drafts ORDER BY created_at DESC"))


@bp.post("/api/drafts")
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
        draft_id = next_draft_id(db)
        db.execute(
            "INSERT INTO drafts (id, po, created_at, customer, status, total) VALUES (?, ?, ?, ?, 'open', ?)",
            (draft_id, po, created, customer, total),
        )
        db.execute(
            "INSERT INTO draft_lines (draft_id, title, price, qty, line_total) VALUES (?, 'Draft items', ?, 1, ?)",
            (draft_id, total, total),
        )
        row = dict(db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone())
    return jsonify(row), 201


@bp.get("/api/drafts/<draft_id>")
def draft_detail(draft_id):
    payload = load_draft(draft_id)
    if not payload:
        return jsonify(error="Draft not found"), 404
    return jsonify(payload)


@bp.post("/api/drafts/<draft_id>")
def draft_action(draft_id):
    if not query("SELECT id FROM drafts WHERE id = ?", (draft_id,)):
        return jsonify(error="Draft not found"), 404
    body = request.json or {}
    action = body.get("action")
    opened = None
    with connect() as db:
        draft = dict(db.execute("SELECT * FROM drafts WHERE id = ?", (draft_id,)).fetchone())
        if action == "comment":
            text = str(body.get("body") or "").strip()
            if not text:
                return jsonify(error="Write a comment first"), 400
            db.execute(
                "INSERT INTO draft_events (draft_id, created_at, kind, body) VALUES (?, ?, 'comment', ?)",
                (draft_id, datetime.now().replace(microsecond=0).isoformat(), text),
            )
        elif action == "duplicate":
            opened = next_draft_id(db)
            db.execute(
                "INSERT INTO drafts (id, po, created_at, customer, status, total) VALUES (?, ?, ?, ?, 'open', ?)",
                (opened, draft["po"], datetime.now().replace(microsecond=0).isoformat(), draft["customer"], draft["total"]),
            )
            copy_draft_lines(db, opened, draft_source_lines(db, draft))
        elif action == "order":
            created = datetime.now().replace(microsecond=0).isoformat()
            opened = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
            items = sum(line["qty"] for line in draft_source_lines(db, draft)) or 1
            db.execute(
                "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, NULL, 'Draft Orders', ?, 'pending', 'unfulfilled', ?, NULL, 'Shipping')",
                (opened, created, draft["customer"], draft["total"], items),
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
            db.execute("DELETE FROM order_lines WHERE order_id = ? AND title = 'Order items'", (opened,))
            for line in draft_source_lines(db, draft):
                db.execute(
                    "INSERT INTO order_lines (order_id, title, price, qty, line_total) VALUES (?, ?, ?, ?, ?)",
                    (opened, line["title"], line["price"], line["qty"], line["line_total"]),
                )
        else:
            return jsonify(error="Unknown action"), 400
    if action == "duplicate":
        return jsonify(load_draft(opened))
    if action == "order":
        return jsonify({"order_id": opened})
    return jsonify(load_draft(draft_id))


@bp.get("/api/checkouts")
def checkouts():
    return jsonify(query("SELECT * FROM checkouts ORDER BY created_at DESC"))

