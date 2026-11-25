from .admin import admin_bp
from .auth import auth_bp
from .monitoring import monitoring_bp
from .posture import posture_bp
from .settings import settings_bp
from .user import user_bp, users_bp

__all__ = ["admin_bp", "auth_bp", "monitoring_bp", "posture_bp", "settings_bp", "user_bp", "users_bp"]
