from datetime import datetime

from sqlalchemy.dialects.sqlite import JSON

from database import db


class MonitoringSession(db.Model):
    __tablename__ = "monitoring_sessions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, default="active")
    started_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    current_posture = db.Column(db.String(40), nullable=False, default="idle")
    last_posture_score = db.Column(db.Integer, nullable=False, default=0)
    average_posture_score = db.Column(db.Float, nullable=False, default=0.0)
    score_sum = db.Column(db.Float, nullable=False, default=0.0)
    event_count = db.Column(db.Integer, nullable=False, default=0)
    alert_count = db.Column(db.Integer, nullable=False, default=0)
    good_posture_seconds = db.Column(db.Float, nullable=False, default=0.0)
    bad_posture_seconds = db.Column(db.Float, nullable=False, default=0.0)
    unclear_seconds = db.Column(db.Float, nullable=False, default=0.0)
    camera_misaligned_seconds = db.Column(db.Float, nullable=False, default=0.0)
    out_of_position_seconds = db.Column(db.Float, nullable=False, default=0.0)
    total_duration_seconds = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user = db.relationship("User", backref=db.backref("monitoring_sessions", lazy=True))
    events = db.relationship(
        "PostureEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="PostureEvent.captured_at.asc()",
    )

    def apply_event(self, posture, posture_score, duration_seconds, alert_increment=0):
        duration = max(float(duration_seconds or 0.0), 0.0)
        self.current_posture = posture
        self.last_posture_score = int(posture_score or 0)
        self.score_sum += float(posture_score or 0)
        self.event_count += 1
        self.average_posture_score = (
            self.score_sum / self.event_count if self.event_count else float(posture_score or 0)
        )
        self.total_duration_seconds += duration
        self.alert_count += int(alert_increment or 0)

        if posture == "good":
            self.good_posture_seconds += duration
        elif posture == "bad":
            self.bad_posture_seconds += duration
        elif posture == "unclear":
            self.unclear_seconds += duration
        elif posture == "camera_misaligned":
            self.camera_misaligned_seconds += duration
        elif posture == "out_of_position":
            self.out_of_position_seconds += duration

    def stop(self):
        self.status = "completed"
        self.ended_at = datetime.utcnow()

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "startedAt": self.started_at.isoformat(),
            "endedAt": self.ended_at.isoformat() if self.ended_at else None,
            "currentPosture": self.current_posture,
            "lastPostureScore": round(float(self.last_posture_score), 2),
            "averagePostureScore": round(float(self.average_posture_score or 0), 2),
            "eventCount": self.event_count,
            "alertCount": self.alert_count,
            "goodPostureSeconds": round(float(self.good_posture_seconds), 2),
            "badPostureSeconds": round(float(self.bad_posture_seconds), 2),
            "unclearSeconds": round(float(self.unclear_seconds), 2),
            "cameraMisalignedSeconds": round(float(self.camera_misaligned_seconds), 2),
            "outOfPositionSeconds": round(float(self.out_of_position_seconds), 2),
            "totalDurationSeconds": round(float(self.total_duration_seconds), 2),
        }


class PostureEvent(db.Model):
    __tablename__ = "posture_events"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(
        db.Integer, db.ForeignKey("monitoring_sessions.id"), nullable=False, index=True
    )
    posture = db.Column(db.String(40), nullable=False)
    posture_score = db.Column(db.Integer, nullable=False, default=0)
    duration_seconds = db.Column(db.Float, nullable=False, default=0.0)
    issues = db.Column(JSON, nullable=True)
    metrics = db.Column(JSON, nullable=True)
    captured_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    session = db.relationship("MonitoringSession", back_populates="events")

    def to_dict(self):
        return {
            "id": self.id,
            "sessionId": self.session_id,
            "posture": self.posture,
            "postureScore": self.posture_score,
            "durationSeconds": round(float(self.duration_seconds), 2),
            "issues": self.issues or [],
            "metrics": self.metrics or {},
            "capturedAt": self.captured_at.isoformat(),
        }
