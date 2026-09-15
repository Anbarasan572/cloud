from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt

from models.activity_log_model import ActivityLog


activity_log_bp = Blueprint("activity_log", __name__)


def admin_required():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({
            "error": "Admin access required"
        }), 403
    return None


@activity_log_bp.route("/activity-logs", methods=["GET"])
@jwt_required()
def get_activity_logs():
    """
    Returns recent system and user activity logs.
    ADMIN ONLY — Employees receive 403 Forbidden.
    """
    perm_err = admin_required()
    if perm_err:
        return perm_err

    try:
        limit = request.args.get("limit", default=50, type=int)
        records = ActivityLog.query.order_by(
            ActivityLog.timestamp.desc()
        ).limit(min(limit, 100)).all()

        return jsonify([record.to_dict() for record in records]), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to load activity logs",
            "details": str(e)
        }), 500
