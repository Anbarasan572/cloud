from database.db import db
from datetime import datetime, timezone


class ActivityLog(db.Model):
    __tablename__ = "activity_logs"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, nullable=True)

    username = db.Column(
        db.String(100),
        nullable=False
    )

    role = db.Column(
        db.String(20),
        nullable=False
    )

    action = db.Column(
        db.String(50),
        nullable=False
    )

    details = db.Column(
        db.Text,
        nullable=True
    )

    timestamp = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    def __init__(
        self,
        user_id=None,
        username="",
        role="",
        action="",
        details=None,
        timestamp=None,
        **kwargs
    ):
        super().__init__(**kwargs)
        self.user_id = user_id
        self.username = username
        self.role = role
        self.action = action
        self.details = details
        if timestamp is not None:
            self.timestamp = timestamp

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.username,
            "role": self.role,
            "action": self.action,
            "details": self.details,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None
        }
