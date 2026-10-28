import json
import re
import secrets

from serializers.base import Serializer, ValidationError

DISCOUNT_KINDS = (
    "Amount off products", "Buy X get Y", "Amount off order", "Free shipping",
    "Percentage", "Fixed amount",
)
SEGMENT_COPY = {
    "purchased": "Customers who have placed at least 1 order.",
    "repeat": "Customers who have placed more than 1 order.",
    "never": "Customers who have not placed any orders.",
    "subscribers": "Customers who have their email subscription status set to subscribed.",
    "abandoned": "Customers whose most recent abandoned checkout date is within the previous 30 days.",
}


def money(cents):
    return f"KES {cents / 100:,.2f}"


def customer_name(body):
    first = str(body.get("first_name") or "").strip()
    last = str(body.get("last_name") or "").strip()
    return str(body.get("name") or f"{first} {last}").strip()


def segment_view(segment, customers, total):
    percent = 0 if not total else round(len(customers) * 100 / total, 2)
    return {
        "id": segment["id"],
        "name": segment["name"],
        "description": SEGMENT_COPY.get(segment["query"], "Customers saved in this segment."),
        "percent": percent,
        "last_activity": segment["last_activity"],
        "created_by": segment["created_by"],
    }


def _positive(value):
    try:
        return float(value) > 0
    except (TypeError, ValueError):
        return False


def discount_config_error(method, kind, config):
    if not isinstance(config, dict):
        return "Complete the discount form."
    dtype = config.get("type") or "products"
    if method == "automatic":
        if not str(config.get("title") or "").strip():
            return "Enter a title customers will see."
    elif not str(config.get("code") or "").strip():
        return "Enter a discount code."
    if dtype in ("products", "order"):
        if config.get("valueMode") == "amount":
            if not _positive(config.get("amount")):
                return "Enter a discount amount."
        else:
            try:
                percent = float(config.get("percent"))
            except (TypeError, ValueError):
                percent = 0
            if percent <= 0 or percent > 100:
                return "Enter a percentage between 0 and 100."
    if dtype == "bxgy":
        if config.get("buyMode") == "amount":
            if not _positive(config.get("buyAmount")):
                return "Enter a minimum purchase amount."
        elif not _positive(config.get("buyQty")):
            return "Enter a minimum quantity."
        if not config.get("buyPicks"):
            return "Add the products the customer buys."
        if not _positive(config.get("getQty")):
            return "Enter how many items the customer gets."
        if not config.get("getPicks"):
            return "Add the products the customer gets."
        if config.get("getMode") != "free" and not _positive(config.get("getValue")):
            return "Enter the discounted value."
        if config.get("maxPerOrder") and not _positive(config.get("maxPerOrderQty")):
            return "Enter the maximum uses per order."
    if dtype == "products" and config.get("applies") == "Specific products" and not config.get("picks"):
        return "Add at least one product."
    if dtype == "products" and config.get("applies") == "Specific collections" and not config.get("picks"):
        return "Choose at least one collection."
    if dtype == "shipping" and config.get("countries") == "selected" and not config.get("countryList"):
        return "Choose at least one country."
    if dtype == "shipping" and config.get("excludeRates") and not _positive(config.get("excludeAmount")):
        return "Enter the maximum shipping rate."
    if config.get("eligibility") == "Specific customer segments" and not config.get("segments"):
        return "Choose at least one customer segment."
    if config.get("minimum") == "amount" and not _positive(config.get("minimumAmount")):
        return "Enter a minimum purchase amount."
    if config.get("minimum") == "qty" and not _positive(config.get("minimumQty")):
        return "Enter a minimum quantity."
    if config.get("limitTotal") and not _positive(config.get("usageLimit")):
        return "Enter how many times this discount can be used."
    if config.get("showEnd") and not str(config.get("ends") or "").strip():
        return "Set an end date."
    if not str(config.get("starts") or "").strip():
        return "Set a start date."
    if kind == "Free shipping":
        return None
    return None


class DiscountSerializer(Serializer):
    def validate(self):
        kind = self.text("kind")
        if kind not in DISCOUNT_KINDS:
            kind = "Amount off products"
        method = "automatic" if self.raw("method") == "automatic" else "code"
        title = self.text("title")
        code = title if method == "automatic" else self.text("code").upper()
        value = self.text("value")
        if kind == "Free shipping" and not value:
            value = "Shipping"
        config = self.raw("config") if isinstance(self.raw("config"), dict) else {}
        if not code:
            message = "Enter a title customers will see." if method == "automatic" else "Enter a discount code."
            raise ValidationError(message)
        if kind != "Free shipping" and not value:
            raise ValidationError("Enter a discount value.")
        missing = discount_config_error(method, kind, config)
        if missing:
            raise ValidationError(missing)
        return {
            "code": code[:40],
            "kind": kind,
            "value": value[:80],
            "method": method,
            "config": json.dumps(config),
        }


class CompanySerializer(Serializer):
    def validate(self):
        name = self.text("name")
        if not name:
            raise ValidationError("Enter a company name.")
        return {
            "name": name[:120],
            "external_id": self.text("external_id", limit=80),
            "contact": self.text("contact", limit=120),
            "address": self.text("address", limit=200),
            "city": self.text("city", limit=80),
            "location_id": self.text("location_id", limit=80),
            "billing_same": 1 if self.data.get("billing_same", True) else 0,
            "billing_address": self.text("billing_address", limit=200),
            "market": self.text("market")[:40] or "Kenya",
            "terms": (self.text("terms") or "No payment terms")[:40],
            "one_time_address": 1 if self.raw("one_time_address") else 0,
            "submission": self.choice("submission", ("auto", "draft"), "auto"),
            "tax_id": self.text("tax_id", limit=40),
            "tax_settings": self.choice("tax_settings", ("Collect tax", "Don't collect tax"), "Collect tax"),
        }


class NamedSerializer(Serializer):
    message = "Enter a name."
    key = "name"
    limit = 120

    def validate(self):
        value = self.text(self.key)
        if not value:
            raise ValidationError(self.message)
        return value[:self.limit]


class FileSerializer(NamedSerializer):
    message = "Enter a file name or URL."
    limit = 180

    def validate(self):
        name = super().validate()
        return {"name": name, "kind": self.text("kind") or "File", "source": self.text("source", limit=300)}


class DefinitionSerializer(NamedSerializer):
    message = "Enter a definition name."
    limit = 80

    def validate(self):
        name = super().validate()
        return {"name": name, "type": self.text("type") or "Custom"}


class MenuSerializer(NamedSerializer):
    message = "Enter a menu name."
    limit = 80

    def validate(self):
        name = super().validate()
        return {"name": name, "items": self.text("items", limit=200)}


class BlogPostSerializer(NamedSerializer):
    key = "title"
    message = "Enter a title."
    limit = 140

    def validate(self):
        title = super().validate()
        return {"title": title, "body": self.text("body", limit=4000)}


class MarketCatalogSerializer(NamedSerializer):
    key = "title"
    message = "Enter a catalog title."

    def validate(self):
        title = super().validate()
        return {"title": title, "market": self.text("market")[:40] or "Kenya"}


class RolloutSerializer(Serializer):
    def validate(self):
        status = self.choice("status", ("draft", "scheduled"), "scheduled")
        config = self.raw("config") if isinstance(self.raw("config"), dict) else {}
        return {
            "name": (self.text("name") or "New rollout")[:120],
            "note": self.text("note", limit=500),
            "status": status,
            "config": json.dumps(config),
        }


class MarketSerializer(NamedSerializer):
    message = "Enter a market name."
    limit = 80

    def validate(self):
        name = super().validate()
        currency = self.text("currency", default="KES").upper()[:8] or "KES"
        return {
            "name": name,
            "currency": currency,
            "status": self.choice("status", ("active", "draft"), "active"),
            "includes": self.text("includes", limit=120),
        }


class CampaignSerializer(NamedSerializer):
    message = "Enter a campaign name."
    limit = 140

    def validate(self):
        name = super().validate()
        cid = self.text("id").lower()
        if not re.fullmatch(r"[a-f0-9]{6}", cid):
            cid = secrets.token_hex(3)
        return {"id": cid, "name": name}


class ReportSerializer(NamedSerializer):
    message = "Enter a report name."
    limit = 140

    def validate(self):
        name = super().validate()
        return {"name": name, "category": self.text("category") or "Sales"}


def dashboard_view(kpis, orders, products, channels, week):
    for kpi in kpis:
        kpi["good"] = bool(kpi["good"])
    recent = [{
        "id": order["id"],
        "customer": order["customer"],
        "date": order["created_at"][:10],
        "amount": money(order["total"]),
        "status": "Fulfilled" if order["fulfillment"] == "fulfilled" else "Unfulfilled",
    } for order in orders]
    top = [{
        "title": product["title"],
        "sold": product["sold"],
        "sales": money(product["price"] * product["sold"]),
    } for product in products]
    return {
        "kpis": kpis,
        "channels": channels,
        "week": [[row["day"], row["amount"]] for row in week],
        "recent": recent,
        "top": top,
    }


def search_hits(term, rows):
    like_hits = []
    orders, drafts, products, collections, inventory, customers, segments, companies, menus, entries, markets, reports = rows
    for row in orders:
        like_hits.append({"view": "orders", "label": f"Order #{row['id']} · {row['customer']}", "order": row["id"]})
    for row in drafts:
        like_hits.append({"view": "drafts", "label": f"Draft #{row['id']} · {row['customer']}", "draft": row["id"]})
    for row in products:
        like_hits.append({"view": "products", "label": row["title"], "product": row["title"]})
    for row in collections:
        like_hits.append({"view": "collections", "label": row["title"], "collection": row["id"]})
    for row in inventory:
        like_hits.append({"view": "inventory", "label": f"{row['product']} · {row['variant']}", "item": row["id"]})
    for row in customers:
        like_hits.append({"view": "customers", "label": row["name"], "customer": row["name"]})
    for row in segments:
        like_hits.append({"view": "segments", "label": row["name"], "segment": row["id"]})
    for row in companies:
        like_hits.append({"view": "companies", "label": row["name"], "company": row["id"]})
    for row in menus:
        like_hits.append({"view": "menus", "label": row["name"], "menu": row["id"]})
    for row in entries:
        like_hits.append({"view": "metaobjects", "label": row["name"], "entry": row["name"]})
    for row in markets:
        like_hits.append({"view": "markets", "label": row["name"], "market": row["name"]})
    for row in reports:
        like_hits.append({"view": "reports", "label": row["name"], "report": row["id"]})
    return like_hits


def meta_summary(entries, definitions):
    active = sum(1 for row in entries if row["status"] == "active")
    return {
        "entries": entries,
        "definitions": definitions,
        "available": active,
        "active": active,
        "draft": sum(1 for row in entries if row["status"] == "draft"),
        "web_pages": 0,
    }
