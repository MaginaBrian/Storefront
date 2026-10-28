from flask import Blueprint, jsonify, request

from models.drafts import Checkout, Draft
from serializers.base import ValidationError
from serializers.drafts import DraftCreateSerializer

bp = Blueprint("drafts", __name__)


def _invalid(exc):
    return jsonify(error=exc.message), exc.status


@bp.get("/api/drafts")
def drafts():
    return jsonify(Draft.all())


@bp.post("/api/drafts")
def create_draft():
    try:
        fields = DraftCreateSerializer.load(request.json or {})
    except ValidationError as exc:
        return _invalid(exc)
    return jsonify(Draft.create(fields)), 201


@bp.get("/api/drafts/<draft_id>")
def draft_detail(draft_id):
    payload = Draft.load(draft_id)
    if not payload:
        return jsonify(error="Draft not found"), 404
    return jsonify(payload)


@bp.post("/api/drafts/<draft_id>")
def draft_action(draft_id):
    if not Draft.get(draft_id):
        return jsonify(error="Draft not found"), 404
    try:
        return jsonify(Draft.act(draft_id, request.json or {}))
    except ValidationError as exc:
        return _invalid(exc)


@bp.get("/api/checkouts")
def checkouts():
    return jsonify(Checkout.all())
