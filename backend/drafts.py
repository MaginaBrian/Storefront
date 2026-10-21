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


def copy_draft_lines(db, draft_id, lines):
    db.executemany(
        "INSERT INTO draft_lines (draft_id, title, price, qty, line_total, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [(draft_id, line["title"], line["price"], line["qty"], line["line_total"], line.get("size") or "", line.get("color") or "") for line in lines],
    )

def load_draft(draft_id):
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
    people = query("SELECT email, phone, address, location FROM customers WHERE name = ?", (draft["customer"],))
    count = query("SELECT COUNT(*) AS n FROM orders WHERE customer = ?", (draft["customer"],))[0]["n"]
    total = draft["total"]
    discount = int(draft.get("discount") or 0)
    shipping = int(draft.get("shipping") or 0)
    subtotal = sum(line["line_total"] for line in lines) or max(total - shipping + discount, 0)
    code = draft.get("currency") or "KES"
    labels = {"KES": "Kenyan Shilling (KES)", "UGX": "Ugandan Shilling (UGX)", "TZS": "Tanzanian Shilling (TZS)"}
    markets = {"KES": "Kenya", "UGX": "Uganda", "TZS": "Tanzania"}
    return {
        "draft": draft,
        "lines": lines,
        "address": address[0],
        "customer": {
            "name": draft["customer"],
            "email": draft.get("email") or (people[0]["email"] if people else ""),
            "phone": draft.get("phone") or (people[0]["phone"] if people else ""),
            "address": draft.get("address") or (people[0]["address"] if people else "") or (f"{people[0]['location']}, Kenya" if people and people[0]["location"] else ""),
            "location": people[0]["location"] if people else "",
            "orders": count,
        },
        "market": markets.get(code, "Kenya"),
        "currency": labels.get(code, labels["KES"]),
        "events": events,
        "summary": {
            "items": sum(line["qty"] for line in lines),
            "subtotal": subtotal,
            "discount": discount,
            "shipping": shipping,
            "tax": round(total * 16 / 116) if lines else 0,
            "tax_label": "16% VAT" if lines else "Not calculated",
            "total": total,
            "due_note": "Payment due when order is fulfilled.",
        },
    }

@bp.get("/api/drafts")
def drafts():
    return jsonify(query("SELECT * FROM drafts ORDER BY created_at DESC"))


def money_fields(body):
    try:
        discount = int(body.get("discount") or 0)
        shipping = int(body.get("shipping") or 0)
    except (TypeError, ValueError):
        return None
    if discount < 0 or shipping < 0:
        return None
    lines = []
    for item in body.get("lines") or []:
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        try:
            price = int(item.get("price") or 0)
            qty = int(item.get("qty") or 1)
        except (TypeError, ValueError):
            return None
        if price < 0 or qty < 1:
            return None
        lines.append({
            "title": title,
            "price": price,
            "qty": qty,
            "line_total": price * qty,
            "size": str(item.get("size") or "").strip()[:40],
            "color": str(item.get("color") or "").strip()[:40],
        })
    subtotal = sum(line["line_total"] for line in lines)
    if "total" in body and not lines:
        try:
            total = int(body.get("total") or 0)
        except (TypeError, ValueError):
            return None
    else:
        total = max(subtotal - discount, 0) + shipping
    if total < 0:
        return None
    currency = body.get("currency") if body.get("currency") in ("KES", "UGX", "TZS") else "KES"
    return {
        "lines": lines,
        "discount": min(discount, subtotal) if lines else discount,
        "shipping": shipping,
        "total": total,
        "note": str(body.get("note") or "").strip(),
        "tags": str(body.get("tags") or "").strip(),
        "currency": currency,
        "phone": str(body.get("phone") or "").strip()[:40],
        "email": str(body.get("email") or "").strip()[:120],
        "address": str(body.get("address") or "").strip()[:200],
    }


@bp.post("/api/drafts")
def create_draft():
    body = request.json or {}
    customer = str(body.get("customer") or "").strip()
    if not customer:
        return jsonify(error="Customer is required"), 400
    fields = money_fields(body)
    if not fields:
        return jsonify(error="Enter a valid total"), 400
    created = datetime.now().replace(microsecond=0).isoformat()
    po = str(body.get("po") or "").strip() or None
    with connect() as db:
        draft_id = next_draft_id(db)
        db.execute(
            """INSERT INTO drafts (id, po, created_at, customer, status, total, note, tags, discount, shipping, currency, phone, email, address)
               VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (draft_id, po, created, customer, fields["total"], fields["note"], fields["tags"], fields["discount"], fields["shipping"], fields["currency"], fields["phone"], fields["email"], fields["address"]),
        )
        if fields["lines"]:
            copy_draft_lines(db, draft_id, fields["lines"])
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
        elif action == "invoice":
            db.execute(
                "INSERT INTO draft_events (draft_id, created_at, kind, body) VALUES (?, ?, 'event', ?)",
                (draft_id, datetime.now().replace(microsecond=0).isoformat(), f"You sent an invoice to {draft['customer']} with a checkout link."),
            )
        elif action == "duplicate":
            opened = next_draft_id(db)
            db.execute(
                """INSERT INTO drafts (id, po, created_at, customer, status, total, note, tags, discount, shipping, currency, phone, email, address)
                   VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    opened, draft["po"], datetime.now().replace(microsecond=0).isoformat(), draft["customer"], draft["total"],
                    draft.get("note") or "", draft.get("tags") or "", draft.get("discount") or 0, draft.get("shipping") or 0, draft.get("currency") or "KES",
                    draft.get("phone") or "", draft.get("email") or "", draft.get("address") or "",
                ),
            )
            copy_draft_lines(db, opened, draft_source_lines(db, draft))
        elif action == "order":
            created = datetime.now().replace(microsecond=0).isoformat()
            opened = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
            items = sum(line["qty"] for line in draft_source_lines(db, draft)) or 1
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
            for line in draft_source_lines(db, draft):
                db.execute(
                    "INSERT INTO order_lines (order_id, title, price, qty, line_total, size, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (opened, line["title"], line["price"], line["qty"], line["line_total"], line.get("size") or "", line.get("color") or ""),
                )
            if payment == "paid":
                add_paid = f"You marked draft #{draft_id} as paid."
                db.execute(
                    "INSERT INTO order_events (order_id, created_at, kind, body) VALUES (?, ?, 'event', ?)",
                    (opened, created, add_paid),
                )
            db.execute("UPDATE drafts SET status = 'completed', order_id = ? WHERE id = ?", (opened, draft_id))
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

