from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

from models.user import User


def generate_token(user_id):
    return jwt.encode(
        {"user_id": user_id},
        current_app.config["JWT_SECRET_KEY"],
        algorithm="HS256",
    )


def token_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "Authorization token is required"}), 401

        token = auth_header.split(" ", 1)[1]

        try:
            payload = jwt.decode(
                token,
                current_app.config["JWT_SECRET_KEY"],
                algorithms=["HS256"],
            )
        except jwt.InvalidTokenError:
            return jsonify({"success": False, "error": "Invalid or expired token"}), 401

        user = User.query.get(payload.get("user_id"))
        if not user or not user.is_active:
            return jsonify({"success": False, "error": "User account is not available"}), 401

        g.current_user = user
        return view(*args, **kwargs)

    return wrapped
