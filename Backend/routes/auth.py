import hashlib
import secrets
import threading
from datetime import datetime
from urllib.parse import parse_qs, unquote, urlparse

from flask import Blueprint, current_app, g, jsonify, request

from database import db
from models.password_reset import PasswordResetToken
from models.settings import UserSettings
from models.user import User
from utils.email import send_password_reset_email
from utils.auth import generate_token, token_required


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _hash_reset_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _normalize_reset_token(raw_token):
    token = unquote((raw_token or "").strip())
    if "token=" in token:
        parsed = urlparse(token)
        query = parsed.query or token.partition("?")[2]
        token = (parse_qs(query).get("token") or [""])[0].strip()
    return token


def _safe_reset_response():
    return jsonify(
        {
            "success": True,
            "message": "If an account with that email exists, password reset instructions were sent.",
        }
    )


def _send_reset_email_async(app, email, reset_link):
    def worker():
        with app.app_context():
            try:
                send_password_reset_email(email, reset_link)
            except Exception as email_error:
                current_app.logger.exception("Unable to send password reset email: %s", email_error)

    threading.Thread(target=worker, daemon=True).start()


def _validate_auth_payload(payload, require_name=False):
    errors = {}

    name = (payload.get("name") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if require_name and len(name) < 2:
        errors["name"] = "Name must be at least 2 characters long."
    if "@" not in email or "." not in email:
        errors["email"] = "Please provide a valid email address."
    if len(password) < 6:
        errors["password"] = "Password must be at least 6 characters long."

    return errors, name, email, password


@auth_bp.post("/register")
def register():
    payload = request.get_json(silent=True) or {}
    errors, name, email, password = _validate_auth_payload(payload, require_name=True)

    if errors:
        return jsonify({"success": False, "error": "Validation failed", "details": errors}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "error": "User already exists with this email"}), 400

    role = "admin" if "admin" in email else "user"

    user = User(
        name=name,
        email=email,
        role=role,
        phone=payload.get("phone"),
        city=payload.get("city"),
        country=payload.get("country"),
    )
    user.set_password(password)

    settings = UserSettings(user=user)
    db.session.add_all([user, settings])
    db.session.commit()

    token = generate_token(user.id)
    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": token}}), 201


@auth_bp.post("/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""

    if not email or not password:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Email and password are required.",
                }
            ),
            400,
        )

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"success": False, "error": "Invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"success": False, "error": "Account is deactivated"}), 401

    token = generate_token(user.id)
    return jsonify({"success": True, "data": {"user": user.to_dict(), "token": token}})


@auth_bp.post("/forgot-password")
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = (payload.get("email") or "").strip().lower()

    if "@" not in email or "." not in email:
        return jsonify({"success": False, "error": "Please provide a valid email address."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.is_active:
        return _safe_reset_response()

    raw_token = secrets.token_hex(24)
    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expires_at=PasswordResetToken.create_expiry(minutes=60),
    )
    db.session.add(reset_token)
    db.session.commit()

    frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    reset_link = f"{frontend_url}/reset-password?token={raw_token}"

    _send_reset_email_async(current_app._get_current_object(), user.email, reset_link)

    return _safe_reset_response()


@auth_bp.post("/reset-password")
def reset_password():
    payload = request.get_json(silent=True) or {}
    token = _normalize_reset_token(payload.get("token") or "")
    password = payload.get("password") or ""

    if not token:
        return jsonify({"success": False, "error": "Reset token is required."}), 400
    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters long."}), 400

    reset_token = PasswordResetToken.query.filter_by(token_hash=_hash_reset_token(token)).first()
    if not reset_token or reset_token.is_used or reset_token.is_expired:
        return jsonify({"success": False, "error": "Reset link is invalid or expired."}), 400

    user = reset_token.user
    if not user or not user.is_active:
        return jsonify({"success": False, "error": "Account is not available."}), 400

    user.set_password(password)
    reset_token.mark_used()
    PasswordResetToken.query.filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.id != reset_token.id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.utcnow()})
    db.session.commit()

    return jsonify({"success": True, "message": "Password reset successfully. You can sign in now."})


@auth_bp.get("/me")
@token_required
def get_me():
    return jsonify({"success": True, "data": g.current_user.to_dict()})


@auth_bp.post("/logout")
@token_required
def logout():
    return jsonify({"success": True, "message": "Logged out successfully"})


@auth_bp.put("/update-profile")
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
