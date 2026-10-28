import json
from datetime import date, timedelta

from db import connect, query
from models.base import Model
from serializers.base import ValidationError
from serializers.store import customer_name, dashboard_view, meta_summary, search_hits, segment_view


class Customer(Model):
    table = "customers"
    order = "spent DESC"

    @classmethod
    def insert(cls, db, body):
        name = customer_name(body)
        if not name:
            return None
        email = str(body.get("email") or "").strip()
        location = str(body.get("location") or body.get("city") or "Nairobi").strip() or "Nairobi"
        cur = db.execute(
            """INSERT INTO customers (
                name, email, location, orders, spent, phone, language, subscribed, sms, whatsapp, note, tags, address, tax_settings
            ) VALUES (?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                name[:120],
                email,
                location,
                str(body.get("phone") or "").strip(),
                str(body.get("language") or "English").strip() or "English",
                1 if body.get("email_marketing") else 0,
                1 if body.get("sms") else 0,
                1 if body.get("whatsapp") else 0,
                str(body.get("note") or "").strip(),
                str(body.get("tags") or "").strip(),
                str(body.get("address") or "").strip(),
                body.get("tax_settings") if body.get("tax_settings") in ("Collect tax", "Don't collect tax") else "Collect tax",
            ),
        )
        return dict(db.execute("SELECT * FROM customers WHERE id = ?", (cur.lastrowid,)).fetchone())

    @classmethod
    def create_many(cls, body):
        rows = body.get("customers") if isinstance(body.get("customers"), list) else [body]
        saved = []
        with connect() as db:
            for item in rows:
                row = cls.insert(db, item or {})
                if row:
                    saved.append(row)
        if not saved:
            raise ValidationError("Enter a customer name.")
        return saved[0] if len(saved) == 1 and "customers" not in body else saved

    @classmethod
    def for_rule(cls, rule):
        if rule == "abandoned":
            cutoff = (date.today() - timedelta(days=30)).isoformat()
            return query(
                """SELECT DISTINCT customers.* FROM customers
                   JOIN checkouts ON lower(checkouts.email) = lower(customers.email)
                   WHERE substr(checkouts.created_at, 1, 10) >= ?
                   ORDER BY customers.spent DESC""",
                (cutoff,),
            )
        where = {
            "purchased": "orders >= 1",
            "repeat": "orders > 1",
            "never": "orders = 0",
            "subscribers": "subscribed = 1",
        }.get(rule)
        if not where:
            return []
        return query(f"SELECT * FROM customers WHERE {where} ORDER BY spent DESC")


class Segment(Model):
    table = "segments"
    order = "id"

    @classmethod
    def listing(cls):
        rows = cls.all()
        total = query("SELECT COUNT(*) AS n FROM customers")[0]["n"]
        return [segment_view(row, Customer.for_rule(row["query"]), total) for row in rows]

    @classmethod
    def load(cls, segment_id):
        found = query("SELECT * FROM segments WHERE id = ?", (segment_id,))
        if not found:
            return None
        total = query("SELECT COUNT(*) AS n FROM customers")[0]["n"]
        customers = Customer.for_rule(found[0]["query"])
        return {"segment": segment_view(found[0], customers, total), "customers": customers, "total": total}

    @classmethod
    def act(cls, segment_id, action):
        current = cls.get(segment_id)
        if not current:
            raise ValidationError("Segment not found", 404)
        if action == "duplicate":
            with connect() as db:
                cur = db.execute(
                    "INSERT INTO segments (name, query, percent, last_activity, created_by) VALUES (?, ?, 0, ?, 'Piacì')",
                    (f"{current['name']} copy"[:120], current["query"], date.today().isoformat()),
                )
                return {"id": cur.lastrowid}, 201
        if action == "delete":
            with connect() as db:
                db.execute("DELETE FROM segments WHERE id = ?", (segment_id,))
            return {"deleted": True}, 200
        raise ValidationError("Unknown action")

    @classmethod
    def create(cls, name):
        if not str(name or "").strip():
            raise ValidationError("Enter a segment name.")
        with connect() as db:
            cur = db.execute(
                "INSERT INTO segments (name, query, percent, last_activity, created_by) VALUES (?, 'custom', 0, ?, 'Piacì')",
                (str(name).strip()[:120], date.today().isoformat()),
            )
            segment_id = cur.lastrowid
        return cls.load(segment_id)["segment"]


class Company(Model):
    table = "companies"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                """INSERT INTO companies (
                    name, external_id, contact, address, city, location_id, billing_same, billing_address,
                    market, terms, one_time_address, submission, tax_id, tax_settings, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    fields["name"], fields["external_id"], fields["contact"], fields["address"], fields["city"],
                    fields["location_id"], fields["billing_same"], fields["billing_address"], fields["market"],
                    fields["terms"], fields["one_time_address"], fields["submission"], fields["tax_id"],
                    fields["tax_settings"], date.today().isoformat(),
                ),
            )
            company_id = cur.lastrowid
        return cls.get(company_id)


class Discount(Model):
    table = "discounts"
    order = "id"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                """INSERT INTO discounts (code, kind, value, status, uses, method, config)
                   VALUES (?, ?, ?, 'active', 0, ?, ?)""",
                (fields["code"], fields["kind"], fields["value"], fields["method"], fields["config"]),
            )
            discount_id = cur.lastrowid
        return cls.get(discount_id)

    @classmethod
    def update(cls, discount_id, fields):
        with connect() as db:
            db.execute(
                "UPDATE discounts SET code = ?, kind = ?, value = ?, method = ?, config = ? WHERE id = ?",
                (fields["code"], fields["kind"], fields["value"], fields["method"], fields["config"], discount_id),
            )
        return cls.get(discount_id)


class File(Model):
    table = "files"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO files (name, kind, source, created_at) VALUES (?, ?, ?, ?)",
                (fields["name"], fields["kind"][:40], fields["source"], date.today().isoformat()),
            )
            file_id = cur.lastrowid
        return cls.get(file_id)


class Metaobject(Model):
    @classmethod
    def listing(cls):
        entries = query("SELECT * FROM meta_entries ORDER BY id")
        definitions = query("SELECT * FROM meta_definitions ORDER BY id")
        return meta_summary(entries, definitions)

    @classmethod
    def create_definition(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO meta_definitions (name, type) VALUES (?, ?)",
                (fields["name"], fields["type"][:40] or "Custom"),
            )
            definition_id = cur.lastrowid
        return query("SELECT * FROM meta_definitions WHERE id = ?", (definition_id,))[0]


class Menu(Model):
    table = "menus"
    order = "id"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute("INSERT INTO menus (name, items) VALUES (?, ?)", (fields["name"], fields["items"]))
            menu_id = cur.lastrowid
        return cls.get(menu_id)


class Page(Model):
    table = "pages"
    order = "id"


class BlogPost(Model):
    table = "blog_posts"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO blog_posts (title, body, blog, created_at) VALUES (?, ?, ?, ?)",
                (fields["title"], fields["body"], "News", date.today().isoformat()),
            )
            post_id = cur.lastrowid
        return cls.get(post_id)


class CatalogItem(Model):
    table = "catalog_items"
    order = "id"


class MarketCatalog(Model):
    table = "market_catalogs"
    order = "id DESC"

    @classmethod
    def view(cls, row):
        if not row:
            return None
        try:
            config = json.loads(row.get("config") or "{}")
        except (TypeError, json.JSONDecodeError):
            config = {}
        if not isinstance(config, dict):
            config = {}
        markets = config.get("markets") if isinstance(config.get("markets"), list) else []
        markets = [str(name) for name in markets if str(name).strip()]
        if not markets and row.get("market"):
            markets = [row["market"]]
        prices = config.get("prices") if isinstance(config.get("prices"), dict) else {}
        products = config.get("products") if isinstance(config.get("products"), list) else []
        return {
            "id": row["id"],
            "title": row["title"],
            "market": markets[0] if markets else "",
            "markets": markets,
            "status": row.get("status") or "active",
            "kind": row.get("kind") or "full",
            "adjustment": int(config.get("adjustment") or 0),
            "compare": bool(config.get("compare")),
            "auto_include": config.get("auto_include", True) is not False,
            "products": products,
            "prices": prices,
            "created_at": row.get("created_at"),
        }

    @classmethod
    def all(cls, order=None):
        return [cls.view(row) for row in super().all(order)]

    @classmethod
    def get(cls, key):
        return cls.view(super().get(key))

    @staticmethod
    def _config(fields):
        return json.dumps({
            "markets": fields["markets"],
            "adjustment": fields["adjustment"],
            "compare": fields["compare"],
            "auto_include": fields["auto_include"],
            "products": fields["products"],
            "prices": fields["prices"],
        })

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                """INSERT INTO market_catalogs (title, market, created_at, status, kind, config)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    fields["title"], fields["markets"][0], date.today().isoformat(),
                    fields["status"], fields["kind"], cls._config(fields),
                ),
            )
            catalog_id = cur.lastrowid
        return cls.get(catalog_id)

    @classmethod
    def update(cls, catalog_id, fields):
        if not super().get(catalog_id):
            raise ValidationError("Catalog not found", 404)
        with connect() as db:
            db.execute(
                "UPDATE market_catalogs SET title = ?, market = ?, status = ?, kind = ?, config = ? WHERE id = ?",
                (fields["title"], fields["markets"][0], fields["status"], fields["kind"], cls._config(fields), catalog_id),
            )
        return cls.get(catalog_id)


class Rollout(Model):
    table = "rollouts"
    order = "id DESC"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO rollouts (name, note, created_at, status, config) VALUES (?, ?, ?, ?, ?)",
                (fields["name"], fields["note"], date.today().isoformat(), fields["status"], fields["config"]),
            )
            rollout_id = cur.lastrowid
        return cls.get(rollout_id)

    @classmethod
    def update(cls, rollout_id, fields):
        with connect() as db:
            db.execute(
                "UPDATE rollouts SET name = ?, note = ?, status = ?, config = ? WHERE id = ?",
                (fields["name"], fields["note"], fields["status"], fields["config"], rollout_id),
            )
        return cls.get(rollout_id)


class Market(Model):
    table = "markets"
    order = "id"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            existing = db.execute("SELECT id FROM markets WHERE name = ?", (fields["name"],)).fetchone()
            if existing:
                market_id = existing["id"]
                created = False
            else:
                cur = db.execute(
                    "INSERT INTO markets (name, currency, status, includes) VALUES (?, ?, ?, ?)",
                    (fields["name"], fields["currency"], fields["status"], fields["includes"]),
                )
                market_id = cur.lastrowid
                created = True
        return cls.get(market_id), 200 if not created else 201

    @classmethod
    def update(cls, market_id, body):
        found = cls.get(market_id)
        if not found:
            raise ValidationError("Market not found", 404)
        name = str(body.get("name") or found["name"]).strip() or found["name"]
        status = body.get("status") if body.get("status") in ("active", "draft") else found["status"]
        currency = str(body.get("currency") or found["currency"]).strip().upper()[:8] or found["currency"]
        includes = str(body.get("includes") if "includes" in body else found.get("includes") or "")[:120]
        with connect() as db:
            db.execute(
                "UPDATE markets SET name = ?, status = ?, currency = ?, includes = ? WHERE id = ?",
                (name[:80], status, currency, includes, market_id),
            )
        return cls.get(market_id)


class Growth(Model):
    table = "campaigns"
    order = "id"


class Campaign(Model):
    table = "marketing_campaigns"
    pk = "id"
    order = "created_at DESC"

    @classmethod
    def all(cls, order=None):
        return query("SELECT id, name, status, created_at FROM marketing_campaigns ORDER BY created_at DESC")

    @classmethod
    def get(cls, key):
        rows = query("SELECT id, name, status, created_at FROM marketing_campaigns WHERE id = ?", (key,))
        return rows[0] if rows else None

    @classmethod
    def create(cls, fields):
        with connect() as db:
            if db.execute("SELECT id FROM marketing_campaigns WHERE id = ?", (fields["id"],)).fetchone():
                raise ValidationError("That campaign id is already in use.", 409)
            db.execute(
                "INSERT INTO marketing_campaigns (id, name, status, created_at) VALUES (?, ?, 'draft', ?)",
                (fields["id"], fields["name"], date.today().isoformat()),
            )
        return cls.get(fields["id"])

    @classmethod
    def rename(cls, campaign_id, name):
        if not cls.get(campaign_id):
            raise ValidationError("Campaign not found", 404)
        cleaned = str(name or "").strip()
        if not cleaned:
            raise ValidationError("Enter a campaign name.")
        with connect() as db:
            db.execute("UPDATE marketing_campaigns SET name = ? WHERE id = ?", (cleaned[:140], campaign_id))
        return cls.get(campaign_id)


class Storefront(Model):
    @classmethod
    def store(cls):
        return query("SELECT domain, theme, status FROM store WHERE id = 1")[0]

    @classmethod
    def agentic(cls):
        return query("SELECT conversations, resolved, handoff FROM agentic WHERE id = 1")[0]


class Settings(Model):
    @classmethod
    def listing(cls):
        return query("SELECT key, value, label FROM settings ORDER BY sort")

    @classmethod
    def update(cls, body):
        allowed = {row["key"] for row in query("SELECT key FROM settings")}
        updates = {key: str(value).strip() for key, value in body.items() if key in allowed}
        if not updates:
            raise ValidationError("Nothing to update")
        with connect() as db:
            for key, value in updates.items():
                db.execute("UPDATE settings SET value = ? WHERE key = ?", (value, key))
        return cls.listing()


class Dashboard(Model):
    @classmethod
    def load(cls):
        return dashboard_view(
            query("SELECT label, value, note, good, tone FROM kpis ORDER BY sort"),
            query("SELECT id, customer, created_at, total, fulfillment FROM orders ORDER BY created_at DESC LIMIT 4"),
            query("SELECT title, sold, price FROM products ORDER BY sold DESC LIMIT 4"),
            query("SELECT name, orders, sales, delta, view FROM channels"),
            query("SELECT day, amount FROM week ORDER BY sort"),
        )


class Report(Model):
    table = "reports"
    order = "id"

    @classmethod
    def create(cls, fields):
        with connect() as db:
            cur = db.execute(
                "INSERT INTO reports (name, category, last_viewed, created_by) VALUES (?, ?, ?, 'Piacì')",
                (fields["name"], fields["category"][:40], date.today().isoformat()),
            )
            report_id = cur.lastrowid
        return cls.get(report_id)

    @classmethod
    def remove(cls, report_id):
        if not cls.get(report_id):
            raise ValidationError("Report not found", 404)
        with connect() as db:
            db.execute("DELETE FROM reports WHERE id = ?", (report_id,))
        return {"ok": True}


class Analytics(Model):
    @classmethod
    def series(cls):
        return {
            "channels": query("SELECT name, orders, sales, delta, view FROM channels"),
            "week": [[row["day"], row["amount"]] for row in query("SELECT day, amount FROM week ORDER BY sort")],
        }


class Search(Model):
    @classmethod
    def hits(cls, term):
        term = str(term or "").strip()
        if len(term) < 2:
            return []
        like = f"%{term}%"
        rows = (
            query("SELECT id, customer FROM orders WHERE customer LIKE ? OR CAST(id AS TEXT) LIKE ? LIMIT 5", (like, like)),
            query("SELECT id, customer FROM drafts WHERE customer LIKE ? OR id LIKE ? LIMIT 5", (like, like)),
            query("SELECT title FROM products WHERE title LIKE ? LIMIT 5", (like,)),
            query("SELECT id, title FROM collections WHERE title LIKE ? LIMIT 5", (like,)),
            query("SELECT id, product, variant FROM inventory WHERE product LIKE ? OR variant LIKE ? LIMIT 5", (like, like)),
            query("SELECT name FROM customers WHERE name LIKE ? OR email LIKE ? LIMIT 5", (like, like)),
            query("SELECT id, name FROM segments WHERE name LIKE ? LIMIT 5", (like,)),
            query("SELECT id, name FROM companies WHERE name LIKE ? LIMIT 5", (like,)),
            query("SELECT id, name FROM menus WHERE name LIKE ? LIMIT 5", (like,)),
            query("SELECT name FROM meta_entries WHERE name LIKE ? LIMIT 5", (like,)),
            query("SELECT name FROM markets WHERE name LIKE ? LIMIT 5", (like,)),
            query("SELECT id, name FROM reports WHERE name LIKE ? LIMIT 5", (like,)),
        )
        return search_hits(term, rows)
