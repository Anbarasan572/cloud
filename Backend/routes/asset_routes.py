from flask import Blueprint, request, jsonify
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt

from database.db import db
from models.asset_model import Asset


asset_bp = Blueprint("asset", __name__)


# ==========================================
# CHECK ADMIN ROLE
# ==========================================

def admin_required():
    claims = get_jwt()

    if claims.get("role") != "admin":
        return jsonify({
            "error": "Admin access required"
        }), 403

    return None

# ==========================================
# DASHBOARD STATISTICS
# ADMIN + EMPLOYEE
# ==========================================

@asset_bp.route("/assets/dashboard", methods=["GET"])
@jwt_required()
def dashboard_stats():

    try:
        assets = Asset.query.all()

        today = datetime.now().date()

        running_count = 0
        terminated_count = 0
        overdue_count = 0

        for asset in assets:

            # Count running assets
            if asset.status and asset.status.lower() == "running":
                running_count += 1

            # Count terminated assets
            if asset.status and asset.status.lower() == "terminated":
                terminated_count += 1

            # Count overdue assets
            if asset.due_date and asset.due_date < today:
                overdue_count += 1

        return jsonify({
            "running": running_count,
            "terminated": terminated_count,
            "overdue": overdue_count,
            "total": len(assets)
        }), 200

    except Exception as e:

        return jsonify({
            "error": "Failed to load dashboard statistics",
            "details": str(e)
        }), 500

# ==========================================
# GET ALL ASSETS
# ADMIN + EMPLOYEE
# ==========================================

@asset_bp.route("/assets", methods=["GET"])
@jwt_required()
def get_assets():

    assets = Asset.query.all()

    result = []

    for asset in assets:
        result.append({
            "id": asset.id,
            "asset_name": asset.asset_name,
            "provider": asset.provider,
            "service": asset.service,
            "region": asset.region,
            "status": asset.status,
            "owner": asset.owner,
            "cost": asset.cost,
            "due_date": asset.due_date.isoformat() if asset.due_date else None,
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
        })

    return jsonify(result)

# ==========================================
# GET SINGLE ASSET
# ADMIN + EMPLOYEE
# ==========================================

@asset_bp.route("/assets/<int:asset_id>", methods=["GET"])
@jwt_required()
def get_asset(asset_id):

    asset = db.session.get(Asset, asset_id)

    if not asset:
        return jsonify({
            "message": "Asset not found"
        }), 404

    return jsonify({
        "id": asset.id,
        "asset_name": asset.asset_name,
        "provider": asset.provider,
        "service": asset.service,
        "region": asset.region,
        "status": asset.status,
        "owner": asset.owner,
        "cost": asset.cost,
        "due_date": asset.due_date.isoformat() if asset.due_date else None,
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
    })


# ==========================================
# ADD NEW ASSET
# ADMIN ONLY
# ==========================================

@asset_bp.route("/assets", methods=["POST"])
@jwt_required()
def add_asset():

    permission_error = admin_required()

    if permission_error:
        return permission_error

    # Validate request has JSON data
    if not request.json:
        return jsonify({
            "error": "Request body must be JSON"
        }), 400

    data = request.json

    # Validate required field
    if "asset_name" not in data:
        return jsonify({
            "error": "Missing required field: asset_name"
        }), 400

    # Validate asset name
    if not data["asset_name"] or not data["asset_name"].strip():
        return jsonify({
            "error": "asset_name cannot be empty"
        }), 400

    # Validate optional fields
    for field in ["provider", "service", "region", "status", "owner"]:
        if field in data and data[field] is not None:
            if not str(data[field]).strip():
                return jsonify({
                    "error": f"{field} cannot be empty string"
                }), 400

    # Validate cost
    if "cost" in data and data["cost"] is not None:
        try:
            cost_value = float(data["cost"])

            if cost_value < 0:
                return jsonify({
                    "error": "cost cannot be negative"
                }), 400

        except (ValueError, TypeError):
            return jsonify({
                "error": "cost must be a valid number"
            }), 400
            # Validate due date
    due_date_value = None

    if data.get("due_date"):
        try:
            due_date_value = datetime.strptime(
                data["due_date"],
                "%Y-%m-%d"
            ).date()

        except ValueError:
            return jsonify({
                "error": "due_date must be in YYYY-MM-DD format"
            }), 400
    try:

        new_asset = Asset(
            asset_name=data["asset_name"].strip(),
            provider=data.get("provider", "").strip()
            if data.get("provider") else None,

            service=data.get("service", "").strip()
            if data.get("service") else None,

            region=data.get("region", "").strip()
            if data.get("region") else None,

            status=data.get("status", "").strip()
            if data.get("status") else None,

            owner=data.get("owner", "").strip()
            if data.get("owner") else None,

            cost=float(data.get("cost", 0.0))
            if data.get("cost") else 0.0,

            due_date=due_date_value
        )

        db.session.add(new_asset)
        db.session.commit()

        return jsonify({
            "message": "Asset added successfully",
            "id": new_asset.id
        }), 201

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "error": "Failed to create asset",
            "details": str(e)
        }), 500
# ==========================================
# UPDATE ASSET
# ADMIN ONLY
# ==========================================

@asset_bp.route("/assets/<int:asset_id>", methods=["PUT"])
@jwt_required()
def update_asset(asset_id):

    permission_error = admin_required()

    if permission_error:
        return permission_error

    asset = db.session.get(Asset, asset_id)

    if not asset:
        return jsonify({
            "message": "Asset not found"
        }), 404

    # Validate request has JSON data
    if not request.is_json:
        return jsonify({
            "error": "Request body must be JSON"
        }), 400

    data = request.get_json()

    valid_fields = [
        "asset_name",
        "provider",
        "service",
        "region",
        "status",
        "owner",
        "cost",
        "due_date"
    ]

    # Validate at least one field
    if not any(field in data for field in valid_fields):
        return jsonify({
            "error": "At least one field must be provided to update"
        }), 400

    # Validate text fields
    for field in [
        "asset_name",
        "provider",
        "service",
        "region",
        "status",
        "owner"
    ]:

        if field in data:
            if data[field] is not None and not str(data[field]).strip():
                return jsonify({
                    "error": f"{field} cannot be empty string"
                }), 400

    # Validate cost
    if "cost" in data and data["cost"] is not None:
        try:
            cost_value = float(data["cost"])

            if cost_value < 0:
                return jsonify({
                    "error": "cost cannot be negative"
                }), 400

        except (ValueError, TypeError):
            return jsonify({
                "error": "cost must be a valid number"
            }), 400

    try:

        # Update asset name
        if "asset_name" in data:
            asset.asset_name = data["asset_name"].strip()

        # Update provider
        if "provider" in data:
            asset.provider = (
                data["provider"].strip()
                if data["provider"] else None
            )

        # Update service
        if "service" in data:
            asset.service = (
                data["service"].strip()
                if data["service"] else None
            )

        # Update region
        if "region" in data:
            asset.region = (
                data["region"].strip()
                if data["region"] else None
            )

        # Update status
        if "status" in data:
            asset.status = (
                data["status"].strip()
                if data["status"] else None
            )

        # Update owner
        if "owner" in data:
            asset.owner = (
                data["owner"].strip()
                if data["owner"] else None
            )

        # Update cost
        if "cost" in data:
            asset.cost = (
                float(data["cost"])
                if data["cost"] is not None
                else 0.0
            )

        # Update due date
        if "due_date" in data:

            if data["due_date"]:
                try:
                    asset.due_date = datetime.strptime(
                        data["due_date"],
                        "%Y-%m-%d"
                    ).date()

                except ValueError:
                    return jsonify({
                        "error": "due_date must be in YYYY-MM-DD format"
                    }), 400

            else:
                asset.due_date = None

        # Save all changes
        db.session.commit()

        return jsonify({
            "message": "Asset updated successfully"
        }), 200

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "error": "Failed to update asset",
            "details": str(e)
        }), 500
# ==========================================
# DELETE ASSET
# ADMIN ONLY
# ==========================================

@asset_bp.route("/assets/<int:asset_id>", methods=["DELETE"])
@jwt_required()
def delete_asset(asset_id):

    permission_error = admin_required()

    if permission_error:
        return permission_error

    asset = db.session.get(Asset, asset_id)

    if not asset:
        return jsonify({
            "message": "Asset not found"
        }), 404

    try:

        db.session.delete(asset)
        db.session.commit()

        return jsonify({
            "message": "Asset deleted successfully"
        }), 200

    except Exception as e:

        db.session.rollback()

        return jsonify({
            "error": "Failed to delete asset",
            "details": str(e)
        }), 500