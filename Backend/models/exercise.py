from datetime import datetime

from sqlalchemy.dialects.sqlite import JSON

from database import db


class Exercise(db.Model):
    __tablename__ = "exercises"

    id          = db.Column(db.Integer, primary_key=True)
    name        = db.Column(db.String(120), nullable=False)
    category    = db.Column(db.String(80), nullable=False)
    duration    = db.Column(db.String(40), nullable=False, default="3 min")
    difficulty  = db.Column(db.String(40), nullable=False, default="Easy")
    description = db.Column(db.Text, nullable=False, default="")
    instructions = db.Column(JSON, nullable=True)
    benefits    = db.Column(JSON, nullable=True)
    icon        = db.Column(db.String(10), nullable=False, default="EX")
    is_active   = db.Column(db.Boolean, nullable=False, default=True)
    created_at  = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at  = db.Column(
        db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def to_dict(self):
        return {
            "id":           self.id,
            "name":         self.name,
            "category":     self.category,
            "duration":     self.duration,
            "difficulty":   self.difficulty,
            "description":  self.description,
            "instructions": self.instructions or [],
            "benefits":     self.benefits or [],
            "icon":         self.icon,
            "is_active":    self.is_active,
            "created_at":   self.created_at.date().isoformat(),
        }
