from flask import Blueprint, jsonify, request

from models.store import (
    Analytics,
    BlogPost,
    Campaign,
    CatalogItem,
    Company,
    Customer,
    Dashboard,
    Discount,
    File,
    Growth,
    Market,
    MarketCatalog,
    Menu,
    Metaobject,
    Page,
    Report,
    Rollout,
    Search,
    Segment,
    Settings,
    Storefront,
)
from serializers.base import ValidationError
from serializers.store import (
    BlogPostSerializer,
    CampaignSerializer,
    CompanySerializer,
    DefinitionSerializer,
    DiscountSerializer,
    FileSerializer,
    MarketCatalogSerializer,
    MarketSerializer,
    MenuSerializer,
    ReportSerializer,
    RolloutSerializer,
)

bp = Blueprint("store", __name__)


def _invalid(exc):
    return jsonify(error=exc.message), exc.status


def _body():
    return request.json or {}


@bp.get("/api/customers")
def customers():
    return jsonify(Customer.all())


@bp.post("/api/customers")
def create_customer():
    try:
        return jsonify(Customer.create_many(_body())), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/segments")
def segments():
    return jsonify(Segment.listing())


@bp.get("/api/segments/<int:segment_id>")
def segment_detail(segment_id):
    payload = Segment.load(segment_id)
    if not payload:
        return jsonify(error="Segment not found"), 404
    return jsonify(payload)


@bp.post("/api/segments/<int:segment_id>")
def segment_action(segment_id):
    try:
        payload, status = Segment.act(segment_id, _body().get("action"))
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(payload), status


@bp.post("/api/segments")
def create_segment():
    try:
        return jsonify(Segment.create(_body().get("name"))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/companies")
def companies():
    return jsonify(Company.all())


@bp.post("/api/companies")
def create_company():
    try:
        return jsonify(Company.create(CompanySerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/discounts")
def discounts():
    return jsonify(Discount.all())


@bp.get("/api/discounts/<int:discount_id>")
def discount(discount_id):
    found = Discount.get(discount_id)
    if not found:
        return jsonify(error="Discount not found"), 404
    return jsonify(found)


@bp.post("/api/discounts")
def create_discount():
    try:
        return jsonify(Discount.create(DiscountSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.patch("/api/discounts/<int:discount_id>")
def update_discount(discount_id):
    if not Discount.get(discount_id):
        return jsonify(error="Discount not found"), 404
    try:
        return jsonify(Discount.update(discount_id, DiscountSerializer.load(_body())))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/files")
def files():
    return jsonify(File.all())


@bp.post("/api/files")
def create_file():
    try:
        return jsonify(File.create(FileSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/metaobjects")
def metaobjects():
    return jsonify(Metaobject.listing())


@bp.post("/api/metaobjects/definitions")
def create_definition():
    try:
        return jsonify(Metaobject.create_definition(DefinitionSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/menus")
def menus():
    return jsonify(Menu.all())


@bp.post("/api/menus")
def create_menu():
    try:
        return jsonify(Menu.create(MenuSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/blog-posts")
def blog_posts():
    return jsonify(BlogPost.all())


@bp.post("/api/blog-posts")
def create_blog_post():
    try:
        return jsonify(BlogPost.create(BlogPostSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/catalog-items")
def catalog_items():
    return jsonify(CatalogItem.all())


@bp.get("/api/market-catalogs")
def market_catalogs():
    return jsonify(MarketCatalog.all())


@bp.post("/api/market-catalogs")
def create_market_catalog():
    try:
        return jsonify(MarketCatalog.create(MarketCatalogSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/rollouts")
def rollouts():
    return jsonify(Rollout.all())


@bp.get("/api/rollouts/<int:rollout_id>")
def rollout(rollout_id):
    found = Rollout.get(rollout_id)
    if not found:
        return jsonify(error="Rollout not found"), 404
    return jsonify(found)


@bp.post("/api/rollouts")
def create_rollout():
    return jsonify(Rollout.create(RolloutSerializer.load(_body()))), 201


@bp.patch("/api/rollouts/<int:rollout_id>")
def update_rollout(rollout_id):
    if not Rollout.get(rollout_id):
        return jsonify(error="Rollout not found"), 404
    return jsonify(Rollout.update(rollout_id, RolloutSerializer.load(_body())))


@bp.get("/api/content")
def content():
    return jsonify(Page.all())


@bp.get("/api/markets")
def markets():
    return jsonify(Market.all())


@bp.post("/api/markets")
def create_market():
    try:
        row, status = Market.create(MarketSerializer.load(_body()))
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(row), status


@bp.patch("/api/markets/<int:market_id>")
def update_market(market_id):
    try:
        return jsonify(Market.update(market_id, _body()))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/growth")
def growth():
    return jsonify(Growth.all())


@bp.get("/api/campaigns")
def marketing_campaigns():
    return jsonify(Campaign.all())


@bp.get("/api/campaigns/<campaign_id>")
def marketing_campaign(campaign_id):
    found = Campaign.get(campaign_id)
    if not found:
        return jsonify(error="Campaign not found"), 404
    return jsonify(found)


@bp.post("/api/campaigns")
def create_marketing_campaign():
    try:
        return jsonify(Campaign.create(CampaignSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.patch("/api/campaigns/<campaign_id>")
def update_marketing_campaign(campaign_id):
    try:
        return jsonify(Campaign.rename(campaign_id, _body().get("name")))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/store")
def store():
    return jsonify(Storefront.store())


@bp.get("/api/agentic")
def agentic():
    return jsonify(Storefront.agentic())


@bp.get("/api/settings")
def settings():
    return jsonify(Settings.listing())


@bp.patch("/api/settings")
def update_settings():
    try:
        return jsonify(Settings.update(_body()))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/dashboard")
def dashboard():
    return jsonify(Dashboard.load())


@bp.get("/api/reports")
def reports():
    return jsonify(Report.all())


@bp.post("/api/reports")
def create_report():
    try:
        return jsonify(Report.create(ReportSerializer.load(_body()))), 201
    except ValidationError as exc:
        return _invalid(exc)


@bp.delete("/api/reports/<int:report_id>")
def delete_report(report_id):
    try:
        return jsonify(Report.remove(report_id))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/analytics")
def analytics():
    return jsonify(Analytics.series())


@bp.get("/api/search")
def search():
    return jsonify(Search.hits(request.args.get("q")))
