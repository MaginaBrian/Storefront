import os

from flask import Blueprint, jsonify, request

from models.orders import Order
from serializers.base import ValidationError
from serializers.orders import CosineOrderSerializer, OrderCreateSerializer, cosine_ref

bp = Blueprint("orders", __name__)


def _sync_allowed():
    expected = os.environ.get("PIACI_SYNC_TOKEN", "").strip()
    if not expected:
        return True
    header = request.headers.get("Authorization", "")
    sent = header[7:].strip() if header.startswith("Bearer ") else request.headers.get("X-Piaci-Token", "").strip()
    return sent == expected


def _body():
    return request.json or {}


def _invalid(exc):
    return jsonify(error=exc.message), exc.status


@bp.get("/api/overview")
def overview():
    return jsonify(Order.overview())


@bp.get("/api/orders/summary")
def orders_summary():
    return jsonify(Order.today())


@bp.get("/api/orders")
def orders():
    return jsonify(Order.all())


@bp.get("/api/order-lines")
def order_lines():
    return jsonify(Order.lines())


@bp.get("/api/profile")
def profile():
    name = str(request.args.get("customer") or "").strip()
    return jsonify(Order.profile(name))


@bp.post("/api/orders")
def create_order():
    try:
        fields = OrderCreateSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Order.create(fields)), 201


@bp.post("/api/integrations/cosine")
def cosine_order():
    if not _sync_allowed():
        return jsonify(error="Unauthorized"), 401
    try:
        fields = CosineOrderSerializer.load(_body())
    except ValidationError as exc:
        return _invalid(exc)
    saved, status = Order.sync_cosine(fields)
    return jsonify(saved), status


@bp.delete("/api/integrations/cosine/<ref>")
def cosine_order_remove(ref):
    if not _sync_allowed():
        return jsonify(error="Unauthorized"), 401
    try:
        cleaned = cosine_ref(ref)
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Order.remove_cosine(cleaned))


@bp.get("/api/orders/<int:order_id>")
def order_detail(order_id):
    payload = Order.load(order_id)
    if not payload:
        return jsonify(error="Order not found"), 404
    return jsonify(payload)


@bp.post("/api/orders/<int:order_id>")
def order_action(order_id):
    if not Order.get(order_id):
        return jsonify(error="Order not found"), 404
    try:
        return jsonify(Order.act(order_id, _body()))
    except ValidationError as exc:
        return _invalid(exc)
