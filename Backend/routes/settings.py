from flask import Blueprint, g, jsonify, request

from database import db
from models.settings import UserSettings
from utils.auth import token_required


settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


def _get_or_create_settings(user_id):
    settings = UserSettings.query.filter_by(user_id=user_id).first()
    if settings:
        return settings

    settings = UserSettings(user_id=user_id)
    db.session.add(settings)
    db.session.commit()
    return settings


@settings_bp.get("")
@token_required
def get_settings():
    settings = _get_or_create_settings(g.current_user.id)
    return jsonify({"success": True, "data": settings.to_dict()})


@settings_bp.put("")
@token_required
def update_settings():
    payload = request.get_json(silent=True) or {}
    settings = _get_or_create_settings(g.current_user.id)
    settings.update_from_dict(payload)
    db.session.commit()
    return jsonify({"success": True, "data": settings.to_dict()})


@settings_bp.get("/me")
@token_required
def get_settings_me():
    return get_settings()


@settings_bp.put("/me")
@token_required
def update_settings_me():
    return update_settings()
