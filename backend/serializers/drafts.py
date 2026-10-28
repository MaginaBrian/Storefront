from serializers.base import Serializer, ValidationError

CURRENCIES = ("KES", "UGX", "TZS")
LABELS = {"KES": "Kenyan Shilling (KES)", "UGX": "Ugandan Shilling (UGX)", "TZS": "Tanzanian Shilling (TZS)"}
MARKETS = {"KES": "Kenya", "UGX": "Uganda", "TZS": "Tanzania"}


class DraftMoneySerializer(Serializer):
    def validate(self):
        discount = self.integer("discount", 0)
        shipping = self.integer("shipping", 0)
        if discount is None or shipping is None or discount < 0 or shipping < 0:
            raise ValidationError("Enter a valid total")
        lines = []
        for item in self.raw("lines") or []:
            if not isinstance(item, dict):
                raise ValidationError("Enter a valid total")
            title = str(item.get("title") or "").strip()
            if not title:
                continue
            try:
                price = int(item.get("price") or 0)
                qty = int(item.get("qty") or 1)
            except (TypeError, ValueError):
                raise ValidationError("Enter a valid total") from None
            if price < 0 or qty < 1:
                raise ValidationError("Enter a valid total")
            lines.append({
                "title": title,
                "price": price,
                "qty": qty,
                "line_total": price * qty,
                "size": str(item.get("size") or "").strip()[:40],
                "color": str(item.get("color") or "").strip()[:40],
            })
        subtotal = sum(line["line_total"] for line in lines)
        if "total" in self.data and not lines:
            total = self.integer("total", 0)
            if total is None:
                raise ValidationError("Enter a valid total")
        else:
            total = max(subtotal - discount, 0) + shipping
        if total < 0:
            raise ValidationError("Enter a valid total")
        return {
            "lines": lines,
            "discount": min(discount, subtotal) if lines else discount,
            "shipping": shipping,
            "total": total,
            "note": self.text("note"),
            "tags": self.text("tags"),
            "currency": self.raw("currency") if self.raw("currency") in CURRENCIES else "KES",
            "phone": self.text("phone", limit=40),
            "email": self.text("email", limit=120),
            "address": self.text("address", limit=200),
        }


class DraftCreateSerializer(DraftMoneySerializer):
    def validate(self):
        customer = self.text("customer")
        if not customer:
            raise ValidationError("Customer is required")
        fields = super().validate()
        fields["customer"] = customer
        fields["po"] = self.text("po") or None
        return fields


def draft_detail(draft, lines, address, comments, people, count):
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
        "id": f"created-{draft['id']}",
        "created_at": draft["created_at"],
        "kind": "event",
        "body": "You created this draft order.",
        "order_id": None,
        "rank": 2,
    })
    events.sort(key=lambda event: (event["created_at"], -event["rank"]), reverse=True)
    total = draft["total"]
    discount = int(draft.get("discount") or 0)
    shipping = int(draft.get("shipping") or 0)
    subtotal = sum(line["line_total"] for line in lines) or max(total - shipping + discount, 0)
    code = draft.get("currency") or "KES"
    return {
        "draft": draft,
        "lines": lines,
        "address": address,
        "customer": {
            "name": draft["customer"],
            "email": draft.get("email") or (people[0]["email"] if people else ""),
            "phone": draft.get("phone") or (people[0]["phone"] if people else ""),
            "address": draft.get("address") or (people[0]["address"] if people else "") or (f"{people[0]['location']}, Kenya" if people and people[0]["location"] else ""),
            "location": people[0]["location"] if people else "",
            "orders": count,
        },
        "market": MARKETS.get(code, "Kenya"),
        "currency": LABELS.get(code, LABELS["KES"]),
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
