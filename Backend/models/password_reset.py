from datetime import datetime, timedelta

from database import db


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    token_hash = db.Column(db.String(128), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("password_reset_tokens", lazy=True))

    @classmethod
    def create_expiry(cls, minutes=60):
        return datetime.utcnow() + timedelta(minutes=minutes)

    @property
    def is_expired(self):
        return datetime.utcnow() >= self.expires_at

    @property
    def is_used(self):
        return self.used_at is not None

    def mark_used(self):
        self.used_at = datetime.utcnow()
