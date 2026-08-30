from database.db import db
from datetime import datetime, timezone


class AutomationHistory(db.Model):
    __tablename__ = "automation_history"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    timestamp = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    status = db.Column(
        db.String(20),
        nullable=False,
        default="SUCCESS"
    )

    assets_checked = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    overdue_detected = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    error_message = db.Column(
        db.Text,
        nullable=True
    )

    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "status": self.status,
            "assets_checked": self.assets_checked,
            "overdue_detected": self.overdue_detected,
            "error_message": self.error_message
        }
