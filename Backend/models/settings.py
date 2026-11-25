from datetime import datetime

from database import db


class UserSettings(db.Model):
    __tablename__ = "user_settings"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    alert_threshold = db.Column(db.Integer, nullable=False, default=5)
    alert_threshold_unit = db.Column(db.String(20), nullable=False, default="minutes")
    enable_alerts = db.Column(db.Boolean, nullable=False, default=True)
    alert_sound = db.Column(db.Boolean, nullable=False, default=True)
    alert_notifications = db.Column(db.Boolean, nullable=False, default=True)
    theme = db.Column(db.String(20), nullable=False, default="dark")
    font_size = db.Column(db.String(20), nullable=False, default="medium")
    compact_mode = db.Column(db.Boolean, nullable=False, default=False)
    data_collection = db.Column(db.Boolean, nullable=False, default=True)
    analytics_sharing = db.Column(db.Boolean, nullable=False, default=False)
    marketing_emails = db.Column(db.Boolean, nullable=False, default=False)
    email_notifications = db.Column(db.Boolean, nullable=False, default=True)
    browser_notifications = db.Column(db.Boolean, nullable=False, default=True)
    daily_report = db.Column(db.Boolean, nullable=False, default=True)
    weekly_report = db.Column(db.Boolean, nullable=False, default=False)
    camera_enabled = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship("User", back_populates="settings")

    def to_dict(self):
        return {
            "alertThreshold": self.alert_threshold,
            "alertThresholdUnit": self.alert_threshold_unit,
            "enableAlerts": self.enable_alerts,
            "alertSound": self.alert_sound,
            "alertNotifications": self.alert_notifications,
            "theme": self.theme,
            "fontSize": self.font_size,
            "compactMode": self.compact_mode,
            "dataCollection": self.data_collection,
            "analyticsSharing": self.analytics_sharing,
            "marketingEmails": self.marketing_emails,
            "emailNotifications": self.email_notifications,
            "browserNotifications": self.browser_notifications,
            "dailyReport": self.daily_report,
            "weeklyReport": self.weekly_report,
            "cameraEnabled": self.camera_enabled,
        }

    def update_from_dict(self, data):
        field_map = {
            "alertThreshold": "alert_threshold",
            "alertThresholdUnit": "alert_threshold_unit",
            "enableAlerts": "enable_alerts",
            "alertSound": "alert_sound",
            "alertNotifications": "alert_notifications",
            "theme": "theme",
            "fontSize": "font_size",
            "compactMode": "compact_mode",
            "dataCollection": "data_collection",
            "analyticsSharing": "analytics_sharing",
            "marketingEmails": "marketing_emails",
            "emailNotifications": "email_notifications",
            "browserNotifications": "browser_notifications",
            "dailyReport": "daily_report",
            "weeklyReport": "weekly_report",
            "cameraEnabled": "camera_enabled",
        }

        for payload_key, model_key in field_map.items():
            if payload_key in data:
                setattr(self, model_key, data[payload_key])
