from database.db import db
from datetime import datetime, timezone


class Asset(db.Model):

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    asset_name = db.Column(
        db.String(100),
        nullable=False
    )

    provider = db.Column(
        db.String(50)
    )

    service = db.Column(
        db.String(50)
    )

    region = db.Column(
        db.String(50)
    )

    status = db.Column(
        db.String(50)
    )

    owner = db.Column(
        db.String(100)
    )

    cost = db.Column(
        db.Float,
        default=0.0
    )

    due_date = db.Column(
        db.Date,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )