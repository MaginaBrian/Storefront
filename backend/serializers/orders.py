import re
from datetime import datetime

from serializers.base import Serializer, ValidationError

REF_RE = re.compile(r"^CC-\d{1,8}$")
CHANNELS = ("Draft Orders", "Online Store", "Agentic")


def when(value):
    text = str(value or "")[:19]
    if len(text) == 19 and text[4] == "-" and text[10] == "T":
        return text
    return datetime.now().replace(microsecond=0).isoformat()


def cosine_lines(raw):
    lines = []
    if not isinstance(raw, list):
        return lines
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "Order items").strip()[:120] or "Order items"
        size = str(item.get("size") or "").strip()[:40]
        color = str(item.get("color") or "").strip()[:40]
        try:
            qty = int(item.get("qty") or 0)
            price = int(item.get("price") or 0)
        except (TypeError, ValueError):
            continue
        if qty < 1 or price < 0:
            continue
        lines.append({"title": title, "size": size, "color": color, "qty": qty, "price": price, "line_total": price * qty})
    return lines


def order_summary(order, lines):
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
    return {
        "items": sum(line["qty"] for line in lines) or order["items"],
        "subtotal": total,
        "tax": tax,
        "tax_label": "VAT 16%",
        "total": total,
        "paid": paid,
        "balance": balance,
        "balance_note": balance_note,
    }


def order_detail(order, detail, address, lines, tags, events, people, count, draft_id):
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
        "draft_id": draft_id,
        "summary": order_summary(order, lines),
    }


class OrderCreateSerializer(Serializer):
    def validate(self):
        customer = self.text("customer")
        if not customer:
            raise ValidationError("Customer is required")
        total = self.integer("total", 0)
        items = self.integer("items", 1)
        if total is None or items is None:
            raise ValidationError("Total and items must be numbers")
        if total < 0 or items < 1:
            raise ValidationError("Total and items must be positive")
        return {
            "customer": customer,
            "total": total,
            "items": items,
            "channel": self.raw("channel") if self.raw("channel") in CHANNELS else "Online Store",
            "payment": "paid" if self.raw("payment") == "paid" else "pending",
        }


class CosineOrderSerializer(Serializer):
    def validate(self):
        ref = self.text("ref")
        customer = self.text("customer")
        if not REF_RE.match(ref):
            raise ValidationError("Order ref must look like CC-0001")
        if not customer:
            raise ValidationError("Customer is required")
        lines = cosine_lines(self.raw("lines"))
        if not lines:
            raise ValidationError("Add at least one line")
        return {
            "ref": ref,
            "customer": customer,
            "lines": lines,
            "total": sum(line["line_total"] for line in lines),
            "items": sum(line["qty"] for line in lines),
            "email": self.text("email", limit=120),
            "phone": self.text("phone", limit=40),
            "contact": (self.text("contact") or customer)[:120],
            "note": self.text("note", limit=500),
            "created": when(self.raw("created_at")),
        }


def cosine_ref(ref):
    ref = str(ref or "").strip()
    if not REF_RE.match(ref):
        raise ValidationError("Order ref must look like CC-0001")
    return ref
