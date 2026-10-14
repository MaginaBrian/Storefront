from datetime import date, datetime

from flask import Blueprint, jsonify, request

from db import add_event, attach_new_order, connect, query

bp = Blueprint("orders", __name__)

def load_order(order_id):
    rows = query("SELECT * FROM orders WHERE id = ?", (order_id,))
    if not rows:
        return None
    order = rows[0]
    detail = query("SELECT confirmation, note FROM order_detail WHERE order_id = ?", (order_id,))
    address = query("SELECT name, line, city, country, billing_same FROM order_address WHERE order_id = ?", (order_id,))
    lines = query("SELECT id, title, price, qty, line_total FROM order_lines WHERE order_id = ? ORDER BY id", (order_id,))
    tags = [row["tag"] for row in query("SELECT tag FROM order_tags WHERE order_id = ? ORDER BY tag", (order_id,))]
    events = query("SELECT id, created_at, kind, body, draft_id FROM order_events WHERE order_id = ? ORDER BY id DESC", (order_id,))
    people = query("SELECT email, location FROM customers WHERE name = ?", (order["customer"],))
    count = query("SELECT COUNT(*) AS n FROM orders WHERE customer = ?", (order["customer"],))[0]["n"]
    total = order["total"]
    tax = round(total * 16 / 116)
    paid = total if order["payment"] == "paid" else 0
    balance = total - paid
    if balance > 0 and order["fulfillment"] != "fulfilled":
        balance_note = "Due when entire order is fulfilled"
    elif balance > 0:
        balance_note = "Payment due"
    else:
        balance_note = ""
    item_count = sum(line["qty"] for line in lines) or order["items"]
    draft = query("SELECT id FROM drafts WHERE order_id = ?", (order_id,))
    return {
        "order": {**order, "confirmation": detail[0]["confirmation"] if detail else "", "note": detail[0]["note"] if detail else ""},
        "lines": lines,
        "address": address[0] if address else None,
        "customer": {
            "name": order["customer"],
            "email": people[0]["email"] if people else "",
            "location": people[0]["location"] if people else "",
            "orders": count,
        },
        "tags": tags,
        "events": events,
        "draft_id": draft[0]["id"] if draft else None,
        "summary": {
            "items": item_count,
            "subtotal": total,
            "tax": tax,
            "tax_label": "VAT 16%",
            "total": total,
            "paid": paid,
            "balance": balance,
            "balance_note": balance_note,
        },
    }

@bp.get("/api/overview")
def overview():
    orders = query("SELECT total, fulfillment, payment FROM orders")
    return jsonify(
        sessions=4,
        orders=len(orders),
        conversion=100,
        total_sales=sum(o["total"] for o in orders),
        currency="KES",
        to_fulfill=sum(o["fulfillment"] == "unfulfilled" for o in orders),
        to_capture=sum(o["payment"] != "paid" for o in orders),
    )


@bp.get("/api/orders/summary")
def orders_summary():
    today = date.today().isoformat()
    orders = query("SELECT created_at, items, fulfillment, delivery_status FROM orders")
    todays = [o for o in orders if o["created_at"].startswith(today)]
    return jsonify(
        orders=len(todays),
        items=sum(o["items"] for o in todays),
        reversals=0,
        fulfilled=sum(o["fulfillment"] == "fulfilled" for o in todays),
        delivered=sum(o["delivery_status"] == "delivered" for o in todays),
        unfulfilled=sum(o["fulfillment"] == "unfulfilled" for o in orders),
    )


@bp.get("/api/orders")
def orders():
    return jsonify(query("SELECT * FROM orders ORDER BY created_at DESC"))


@bp.get("/api/profile")
def profile():
    name = str(request.args.get("customer") or "").strip()
    found = query("SELECT * FROM customers WHERE name = ?", (name,))
    return jsonify(
        customer=found[0] if found else None,
        orders=query("SELECT id, created_at, total, payment, fulfillment, channel, items FROM orders WHERE customer = ? ORDER BY created_at DESC", (name,)),
        drafts=query("SELECT id, created_at, total, status, order_id FROM drafts WHERE customer = ? ORDER BY created_at DESC", (name,)),
    )


@bp.post("/api/orders")
def create_order():
    body = request.json or {}
    customer = str(body.get("customer") or "").strip()
    if not customer:
        return jsonify(error="Customer is required"), 400
    try:
        total = int(body.get("total") or 0)
        items = int(body.get("items") or 1)
    except (TypeError, ValueError):
        return jsonify(error="Total and items must be numbers"), 400
    if total < 0 or items < 1:
        return jsonify(error="Total and items must be positive"), 400
    channel = body.get("channel") if body.get("channel") in ("Draft Orders", "Online Store", "Agentic") else "Online Store"
    payment = "paid" if body.get("payment") == "paid" else "pending"
    created = datetime.now().replace(microsecond=0).isoformat()
    with connect() as db:
        next_id = (db.execute("SELECT MAX(id) FROM orders").fetchone()[0] or 1000) + 1
        db.execute(
            "INSERT INTO orders (id, created_at, customer, fulfill_by, channel, total, payment, fulfillment, items, delivery_status, delivery_method) VALUES (?, ?, ?, NULL, ?, ?, ?, 'unfulfilled', ?, NULL, 'Shipping')",
            (next_id, created, customer, channel, total, payment, items),
        )
        existing = db.execute("SELECT id FROM customers WHERE name = ?", (customer,)).fetchone()
        if existing:
            db.execute("UPDATE customers SET orders = orders + 1, spent = spent + ? WHERE id = ?", (total, existing["id"]))
        else:
            db.execute(
                "INSERT INTO customers (name, email, location, orders, spent) VALUES (?, '', 'Nairobi', 1, ?)",
                (customer, total),
            )
        row = dict(db.execute("SELECT * FROM orders WHERE id = ?", (next_id,)).fetchone())
        attach_new_order(db, row)
    return jsonify(row), 201


@bp.get("/api/orders/<int:order_id>")
def order_detail(order_id):
    payload = load_order(order_id)
    if not payload:
        return jsonify(error="Order not found"), 404
    return jsonify(payload)


@bp.post("/api/orders/<int:order_id>")
def order_action(order_id):
    if not query("SELECT id FROM orders WHERE id = ?", (order_id,)):
        return jsonify(error="Order not found"), 404
    body = request.json or {}
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
                return jsonify(error="Enter a tag"), 400
            if body.get("remove"):
                db.execute("DELETE FROM order_tags WHERE order_id = ? AND tag = ?", (order_id, tag))
            else:
                db.execute("INSERT OR IGNORE INTO order_tags (order_id, tag) VALUES (?, ?)", (order_id, tag))
        elif action == "comment":
            text = str(body.get("body") or "").strip()
            if not text:
                return jsonify(error="Write a comment first"), 400
            add_event(db, order_id, text, kind="comment")
        else:
            return jsonify(error="Unknown action"), 400
    return jsonify(load_order(order_id))

