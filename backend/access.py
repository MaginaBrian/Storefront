"""Which part of the store a request belongs to.

Products are what is sold, customers are who buys, discounts are the offer,
orders record the purchase, markets shape the experience, and analytics
shows the result. A role is the set of those areas a person may open.
"""

from flask import jsonify

AREAS = [
    ("home", "Home", "Open the store overview."),
    ("orders", "Orders", "Record the purchase: the customer, products and variants, quantities, prices, discounts, shipping, and fulfillment."),
    ("products", "Products", "What you sell, including variants, prices, and inventory."),
    ("customers", "Customers", "Who buys, with their contact details and whether they return."),
    ("discounts", "Discounts", "The offer. Reduce a product price, an order total, or shipping."),
    ("markets", "Markets", "Who you sell to, and the prices, currency, and catalog they see. Markets are separate from marketing."),
    ("analytics", "Analytics", "The results: what sold, how discounts changed the total, and which customers came back."),
    ("settings", "Settings", "Store details such as the name, currency, and checkout."),
    ("users", "Users", "Create roles and decide who can open each part of the store."),
]

APPS = [
    ("online_store", "Online Store", "The public shop."),
    ("agentic", "Agentic", "The shop assistant."),
]

ALL = [key for key, *_rest in AREAS + APPS]

PATHS = [
    ("/api/order-lines", "orders"),
    ("/api/orders", "orders"),
    ("/api/drafts", "orders"),
    ("/api/checkouts", "orders"),
    ("/api/integrations", "orders"),
    ("/api/overview", "home"),
    ("/api/products", "products"),
    ("/api/collections", "products"),
    ("/api/inventory", "products"),
    ("/api/purchase-orders", "products"),
    ("/api/transfers", "products"),
    ("/api/gift-cards", "products"),
    ("/api/catalog-items", "products"),
    ("/api/metaobjects", "products"),
    ("/api/files", "products"),
    ("/api/menus", "products"),
    ("/api/blog-posts", "products"),
    ("/api/content", "products"),
    ("/api/customers", "customers"),
    ("/api/segments", "customers"),
    ("/api/companies", "customers"),
    ("/api/profile", "customers"),
    ("/api/discounts", "discounts"),
    ("/api/market-catalogs", "markets"),
    ("/api/markets", "markets"),
    ("/api/rollouts", "markets"),
    ("/api/analytics", "analytics"),
    ("/api/reports", "analytics"),
    ("/api/growth", "analytics"),
    ("/api/campaigns", "analytics"),
    ("/api/dashboard", "home"),
    ("/api/settings", "settings"),
    ("/api/roles", "users"),
    ("/api/staff", "users"),
    ("/api/store", "online_store"),
    ("/api/agentic", "agentic"),
]

VIEWS = {
    "home": "home",
    "orders": "orders",
    "drafts": "orders",
    "checkouts": "orders",
    "products": "products",
    "collections": "products",
    "inventory": "products",
    "purchase-orders": "products",
    "transfers": "products",
    "gift-cards": "products",
    "content": "products",
    "metaobjects": "products",
    "files": "products",
    "menus": "products",
    "blog-posts": "products",
    "customers": "customers",
    "segments": "customers",
    "companies": "customers",
    "discounts": "discounts",
    "markets": "markets",
    "catalogs": "markets",
    "rollouts": "markets",
    "analytics": "analytics",
    "reports": "analytics",
    "live-view": "analytics",
    "growth": "analytics",
    "attribution": "analytics",
    "autopilot": "analytics",
    "campaigns": "analytics",
    "store": "online_store",
    "agentic": "agentic",
}


def permission_for(path):
    for prefix, key in PATHS:
        if path == prefix or path.startswith(prefix + "/"):
            return key
    return None


def view_allowed(view, permissions):
    if view == "settings":
        return "settings" in permissions or "users" in permissions
    return VIEWS.get(view, "home") in permissions


def authorize(req):
    if req.path in ("/api/health", "/api/session") or req.path.startswith("/api/search"):
        return None
    from models.access import acting

    staff = acting(req.headers.get("X-Staff-Id"))
    if staff is None:
        return jsonify(error="This user was not found."), 403
    if not staff["owner"] and not staff["stores"]:
        return jsonify(error="This user does not have access to the store."), 403
    needed = permission_for(req.path)
    if needed and needed not in staff["permissions"]:
        return jsonify(error="Your role does not include this."), 403
    return None
