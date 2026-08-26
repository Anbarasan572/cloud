from flask import Blueprint, request, jsonify

from database.db import db
from models.asset_model import Asset


asset_bp = Blueprint("asset", __name__)


# GET all assets
@asset_bp.route("/assets", methods=["GET"])
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
            "created_at": asset.created_at.isoformat() if asset.created_at else None,
            "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
        })

    return jsonify(result)


# GET single asset
@asset_bp.route("/assets/<int:asset_id>", methods=["GET"])
def get_asset(asset_id):

    asset = Asset.query.get(asset_id)

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
        "created_at": asset.created_at.isoformat() if asset.created_at else None,
        "updated_at": asset.updated_at.isoformat() if asset.updated_at else None
    })


# POST - Add new asset
@asset_bp.route("/assets", methods=["POST"])
def add_asset():

    # Validate request has JSON data
    if not request.json:
        return jsonify({
            "error": "Request body must be JSON"
        }), 400

    data = request.json

    # Validate required field: asset_name
    if "asset_name" not in data:
        return jsonify({
            "error": "Missing required field: asset_name"
        }), 400

    # Validate asset_name is not empty
    if not data["asset_name"] or not data["asset_name"].strip():
        return jsonify({
            "error": "asset_name cannot be empty"
        }), 400

    # Validate optional fields are not empty strings if provided
    for field in ["provider", "service", "region", "status", "owner"]:
        if field in data and data[field] is not None:
            if not str(data[field]).strip():
                return jsonify({
                    "error": f"{field} cannot be empty string"
                }), 400

    # Validate cost if provided
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
        new_asset = Asset(
            asset_name=data["asset_name"].strip(),
            provider=data.get("provider", "").strip() if data.get("provider") else None,
            service=data.get("service", "").strip() if data.get("service") else None,
            region=data.get("region", "").strip() if data.get("region") else None,
            status=data.get("status", "").strip() if data.get("status") else None,
            owner=data.get("owner", "").strip() if data.get("owner") else None,
            cost=float(data.get("cost", 0.0)) if data.get("cost") else 0.0
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


# PUT - Update asset
@asset_bp.route("/assets/<int:asset_id>", methods=["PUT"])
def update_asset(asset_id):

    asset = Asset.query.get(asset_id)

    if not asset:
        return jsonify({
            "message": "Asset not found"
        }), 404

    # Validate request has JSON data
    if not request.json:
        return jsonify({
            "error": "Request body must be JSON"
        }), 400

    data = request.json

    # Validate at least one field is provided
    valid_fields = ["asset_name", "provider", "service", "region", "status", "owner", "cost"]
    if not any(field in data for field in valid_fields):
        return jsonify({
            "error": "At least one field must be provided to update"
        }), 400

    # Validate fields are not empty strings if provided
    for field in ["asset_name", "provider", "service", "region", "status", "owner"]:
        if field in data:
            if data[field] is not None and not str(data[field]).strip():
                return jsonify({
                    "error": f"{field} cannot be empty string"
                }), 400

    # Validate cost if provided
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
        # Update only provided fields
        if "asset_name" in data:
            asset.asset_name = data["asset_name"].strip()
        if "provider" in data:
            asset.provider = data["provider"].strip() if data["provider"] else None
        if "service" in data:
            asset.service = data["service"].strip() if data["service"] else None
        if "region" in data:
            asset.region = data["region"].strip() if data["region"] else None
        if "status" in data:
            asset.status = data["status"].strip() if data["status"] else None
        if "owner" in data:
            asset.owner = data["owner"].strip() if data["owner"] else None
        if "cost" in data:
            asset.cost = float(data["cost"]) if data["cost"] is not None else 0.0

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


# DELETE - Delete asset
@asset_bp.route("/assets/<int:asset_id>", methods=["DELETE"])
def delete_asset(asset_id):

    asset = Asset.query.get(asset_id)

    if not asset:
        return jsonify({
            "message": "Asset not found"
        }), 404

    db.session.delete(asset)
    db.session.commit()

    return jsonify({
        "message": "Asset deleted successfully"
    })