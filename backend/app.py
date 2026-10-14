from datetime import date, datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# In-memory data for now: swap for SQLAlchemy/Postgres when ready.
# Money is stored in cents.
ORDERS = [
    {"id": 1004, "created_at": "2026-09-30T15:14:00", "customer": "Korom Festival", "fulfill_by": None, "channel": "Draft Orders", "total": 27650000, "payment": "pending", "fulfillment": "unfulfilled", "items": 7900, "delivery_status": None, "delivery_method": "Shipping"},
    {"id": 1002, "created_at": "2026-09-27T18:24:00", "customer": "Hawkeye Media", "fulfill_by": None, "channel": "Draft Orders", "total": 637744, "payment": "paid", "fulfillment": "fulfilled", "items": 2230, "delivery_status": None, "delivery_method": "Shipping"},
    {"id": 1001, "created_at": "2026-09-27T18:10:00", "customer": "Mwotaji Ltd", "fulfill_by": None, "channel": "Draft Orders", "total": 28710252, "payment": "paid", "fulfillment": "fulfilled", "items": 471, "delivery_status": None, "delivery_method": "Shipping"},
]
DRAFTS = [
    {"id": "D4", "po": None, "created_at": "2026-09-30T15:14:00", "customer": "Korom Festival", "status": "completed", "total": 27650000},
    {"id": "D3", "po": "note", "created_at": "2026-09-29T20:23:00", "customer": "Korom Festival", "status": "completed", "total": 32074000},
    {"id": "D2", "po": None, "created_at": "2026-09-27T18:24:00", "customer": "Hawkeye Media", "status": "completed", "total": 637744},
    {"id": "D1", "po": None, "created_at": "2026-09-27T18:10:00", "customer": "Mwotaji Ltd", "status": "completed", "total": 28710252},
]
PRODUCTS = [
    {"id": 1, "title": "Linen Overshirt", "price": 890000, "stock": 14},
    {"id": 2, "title": "Leather Weekender", "price": 2450000, "stock": 5},
]

@app.get("/api/overview")
def overview():
    return jsonify(
        sessions=4, orders=len(ORDERS), conversion=100,
        total_sales=sum(o["total"] for o in ORDERS), currency="KES",
        to_fulfill=sum(o["fulfillment"] == "unfulfilled" for o in ORDERS),
        to_capture=sum(o["payment"] != "paid" for o in ORDERS),
    )

@app.get("/api/orders/summary")
def orders_summary():
    today = date.today().isoformat()
    todays = [o for o in ORDERS if o["created_at"].startswith(today)]
    return jsonify(
        orders=len(todays),
        items=sum(o["items"] for o in todays),
        reversals=0,
        fulfilled=sum(o["fulfillment"] == "fulfilled" for o in todays),
        delivered=sum(o.get("delivery_status") == "delivered" for o in todays),
        unfulfilled=sum(o["fulfillment"] == "unfulfilled" for o in ORDERS),
    )

@app.get("/api/orders")
def orders():
    return jsonify(ORDERS)

@app.post("/api/orders")
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
    order = {
        "id": max(o["id"] for o in ORDERS) + 1,
        "created_at": datetime.now().replace(microsecond=0).isoformat(),
        "customer": customer,
        "fulfill_by": None,
        "channel": body.get("channel") if body.get("channel") in ("Draft Orders", "Online Store", "Agentic") else "Online Store",
        "total": total,
        "payment": "paid" if body.get("payment") == "paid" else "pending",
        "fulfillment": "unfulfilled",
        "items": items,
        "delivery_status": None,
        "delivery_method": "Shipping",
    }
    ORDERS.insert(0, order)
    return jsonify(order), 201

@app.get("/api/drafts")
def drafts():
    return jsonify(DRAFTS)

@app.post("/api/drafts")
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
    nums = [int(d["id"][1:]) for d in DRAFTS if str(d["id"]).startswith("D") and str(d["id"])[1:].isdigit()]
    draft = {
        "id": f"D{max(nums, default=0) + 1}",
        "po": str(body.get("po") or "").strip() or None,
        "created_at": datetime.now().replace(microsecond=0).isoformat(),
        "customer": customer,
        "status": "open",
        "total": total,
    }
    DRAFTS.insert(0, draft)
    return jsonify(draft), 201

@app.get("/api/checkouts")
def checkouts():
    return jsonify([])

@app.get("/api/products")
def products():
    return jsonify(PRODUCTS)

@app.post("/api/products")
def add_product():
    p = {"id": max(x["id"] for x in PRODUCTS) + 1, **request.json}
    PRODUCTS.append(p)
    return jsonify(p), 201

@app.get("/api/dashboard")
def dashboard():
    return jsonify(
        kpis=[
            {"label": "Total sales", "value": "KES 630.9K", "note": "12.5% this month", "good": True, "tone": "green"},
            {"label": "Orders", "value": "1,540", "note": "no change", "good": True, "tone": "amber"},
            {"label": "New customers", "value": "310", "note": "3.1% this month", "good": False, "tone": "violet"},
            {"label": "Low stock", "value": "8 items", "note": "3 critical", "good": False, "tone": "red"},
        ],
        channels=[
            {"name": "Online Store", "orders": 540, "sales": 283400, "delta": 12.5},
            {"name": "Agentic", "orders": 250, "sales": 157800, "delta": 9.8},
            {"name": "WhatsApp", "orders": 1200, "sales": 501200, "delta": -15.3},
            {"name": "In person", "orders": 400, "sales": 225600, "delta": 11.7},
            {"name": "Instagram", "orders": 400, "sales": 225600, "delta": -11.7},
        ],
        week=[("Sun", 22), ("Mon", 45), ("Tue", 80), ("Wed", 52), ("Thu", 38), ("Fri", 70), ("Sat", 100)],
        recent=[
            {"id": 12847, "customer": "Amani Wekesa", "date": "2026-10-12", "amount": "KES 8,500", "status": "Fulfilled"},
            {"id": 12846, "customer": "Zuri Otieno", "date": "2026-10-12", "amount": "KES 32,000", "status": "Unfulfilled"},
            {"id": 12845, "customer": "Kofi Mwangi", "date": "2026-10-11", "amount": "KES 4,520", "status": "Fulfilled"},
            {"id": 12844, "customer": "Neema Achieng", "date": "2026-10-10", "amount": "KES 12,999", "status": "Fulfilled"},
        ],
        top=[
            {"title": "Linen Overshirt", "sold": 48, "sales": "KES 427,200"},
            {"title": "Leather Weekender", "sold": 35, "sales": "KES 857,500"},
            {"title": "Canvas Tote", "sold": 22, "sales": "KES 66,000"},
            {"title": "Brass Card Holder", "sold": 60, "sales": "KES 90,000"},
        ],
    )

if __name__ == "__main__":
    app.run(port=5000, debug=True)
