from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt

from models.automation_history_model import AutomationHistory
from services.automation_service import get_automation_status, run_overdue_check
from flask import current_app


automation_bp = Blueprint("automation", __name__)


def admin_required():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({
            "error": "Admin access required"
        }), 403
    return None


@automation_bp.route("/automation/status", methods=["GET"])
@jwt_required()
def automation_status():
    """
    Returns the latest automation telemetry state.
    ADMIN ONLY — Employees receive 403 Forbidden.
    """
    perm_err = admin_required()
    if perm_err:
        return perm_err

    status = get_automation_status()
    return jsonify(status), 200


@automation_bp.route("/automation/history", methods=["GET"])
@jwt_required()
def automation_history():
    """
    Returns recent automation execution history logs.
    ADMIN ONLY — Employees receive 403 Forbidden.
    """
    perm_err = admin_required()
    if perm_err:
        return perm_err

    try:
        limit = request.args.get("limit", default=20, type=int)
        records = AutomationHistory.query.order_by(
            AutomationHistory.timestamp.desc()
        ).limit(min(limit, 100)).all()

        return jsonify([record.to_dict() for record in records]), 200

    except Exception as e:
        return jsonify({
            "error": "Failed to load automation history",
            "details": str(e)
        }), 500


@automation_bp.route("/automation/run-now", methods=["POST"])
@jwt_required()
def trigger_automation():
    """
    Manually triggers an immediate overdue check cycle.
    ADMIN ONLY — Employees receive 403 Forbidden.
    """
    perm_err = admin_required()
    if perm_err:
        return perm_err

    result = run_overdue_check(current_app._get_current_object())
    return jsonify(result), 200
