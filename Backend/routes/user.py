from flask import Blueprint, g, jsonify, request

from database import db
from utils.auth import token_required


user_bp = Blueprint("user", __name__, url_prefix="/api/user")


@user_bp.get("/profile")
@token_required
def get_profile():
    return jsonify({"success": True, "data": g.current_user.to_dict()})


@user_bp.put("/profile")
@token_required
def update_profile():
    payload = request.get_json(silent=True) or {}
    user = g.current_user

    name = (payload.get("name") or user.name).strip()
    email = (payload.get("email") or user.email).strip().lower()

    if len(name) < 2:
        return jsonify({"success": False, "error": "Name must be at least 2 characters long"}), 400

    if "@" not in email or "." not in email:
        return jsonify({"success": False, "error": "Please provide a valid email address"}), 400

    existing_user = None
    if email != user.email:
        from models.user import User

        existing_user = User.query.filter_by(email=email).first()

    if existing_user:
        return jsonify({"success": False, "error": "Email already in use"}), 400

    user.name = name
    user.email = email
    user.phone = payload.get("phone", user.phone)
    user.city = payload.get("city", user.city)
    user.country = payload.get("country", user.country)

    db.session.commit()
    return jsonify({"success": True, "data": user.to_dict()})


users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.get("/me")
@token_required
def get_current_user_profile():
    return jsonify({"success": True, "data": g.current_user.to_dict()})
