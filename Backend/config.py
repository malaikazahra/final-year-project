import os

from dotenv import load_dotenv


BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-jwt-secret")
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'postureguard.db')}",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CLIENT_ORIGIN = os.getenv("CLIENT_ORIGIN", "http://localhost:3000")
    CLIENT_ORIGINS = [
        origin.strip()
        for origin in os.getenv(
            "CLIENT_ORIGINS",
            f"{CLIENT_ORIGIN},http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]
    FRONTEND_URL = os.getenv("FRONTEND_URL", CLIENT_ORIGIN)
    MAIL_SERVER = os.getenv("MAIL_SERVER", "")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() in {"1", "true", "yes"}
    MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "false").lower() in {"1", "true", "yes"}
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", MAIL_USERNAME or "no-reply@postureguard.local")
