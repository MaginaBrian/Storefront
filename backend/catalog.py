from flask import Blueprint, jsonify, request

from models.catalog import Collection, GiftCard, Inventory, Product, PurchaseOrder, Transfer
from serializers.base import ValidationError
from serializers.catalog import (
    CollectionCreateSerializer,
    GiftCardCreateSerializer,
    InventoryCreateSerializer,
    ProductCreateSerializer,
    PurchaseOrderCreateSerializer,
    TransferCreateSerializer,
    inventory_updates,
    sheet_rows,
)

bp = Blueprint("catalog", __name__)


def _invalid(exc):
    return jsonify(error=exc.message), exc.status


def _body():
    return request.json or {}


@bp.get("/api/products")
def products():
    return jsonify(Product.listing())


@bp.post("/api/products")
def add_product():
    try:
        fields = ProductCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Product.create(fields)), 201


@bp.get("/api/products/<int:product_id>")
def product_detail(product_id):
    payload = Product.load(product_id)
    if not payload:
        return jsonify(error="Product not found"), 404
    return jsonify(payload)


@bp.post("/api/products/<int:product_id>")
def product_action(product_id):
    if not Product.get(product_id):
        return jsonify(error="Product not found"), 404
    try:
        return jsonify(Product.act(product_id, _body()))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/collections")
def collections():
    return jsonify(Collection.listing())


@bp.get("/api/collections/<int:collection_id>")
def collection_detail(collection_id):
    payload = Collection.load(collection_id)
    if not payload:
        return jsonify(error="Collection not found"), 404
    return jsonify(payload)


@bp.post("/api/collections")
def create_collection():
    try:
        fields = CollectionCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Collection.create(fields)), 201


@bp.get("/api/inventory")
def inventory():
    return jsonify(Inventory.all())


@bp.post("/api/inventory")
def add_inventory():
    try:
        fields = InventoryCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Inventory.create(fields)), 201


@bp.post("/api/inventory/import")
def import_inventory():
    upload = request.files.get("file")
    if not upload:
        return jsonify(error="Choose a CSV or .xlsx file."), 400
    data = upload.read()
    if not data:
        return jsonify(error="That file is empty."), 400
    try:
        updates = inventory_updates(sheet_rows(data))
        return jsonify(Inventory.apply_import(updates))
    except ValidationError as exc:
        return _invalid(exc)


@bp.post("/api/inventory/<int:item_id>")
def inventory_action(item_id):
    if not Inventory.get(item_id):
        return jsonify(error="Variant not found"), 404
    try:
        return jsonify(Inventory.act(item_id, _body()))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/purchase-orders")
def purchase_orders():
    return jsonify(PurchaseOrder.all())


@bp.get("/api/purchase-orders/<int:po_id>")
def purchase_order(po_id):
    found = PurchaseOrder.get(po_id)
    if not found:
        return jsonify(error="Purchase order not found"), 404
    return jsonify(found)


@bp.post("/api/purchase-orders/<int:po_id>")
def purchase_order_action(po_id):
    try:
        return jsonify(PurchaseOrder.act(po_id, _body()))
    except ValidationError as exc:
        return _invalid(exc)


@bp.post("/api/purchase-orders")
def create_purchase_order():
    try:
        fields = PurchaseOrderCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(PurchaseOrder.create(fields)), 201


@bp.get("/api/transfers")
def transfers():
    return jsonify(Transfer.all())


@bp.post("/api/transfers/<int:transfer_id>")
def transfer_action(transfer_id):
    try:
        return jsonify(Transfer.link(transfer_id, _body()))
    except ValidationError as exc:
        return _invalid(exc)


@bp.post("/api/transfers")
def create_transfer():
    try:
        fields = TransferCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Transfer.create(fields)), 201


@bp.get("/api/gift-cards")
def gift_cards():
    return jsonify(GiftCard.all())


@bp.post("/api/gift-cards")
def create_gift_card():
    try:
        fields = GiftCardCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(GiftCard.create(fields)), 201
