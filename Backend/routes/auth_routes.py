from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity
)

from database.db import db
from models.user_model import User


auth_bp = Blueprint("auth", __name__)


# LOGIN
@auth_bp.route("/auth/login", methods=["POST"])
def login():

    data = request.get_json()

    if not data:
        return jsonify({
            "error": "Request body must be JSON"
        }), 400

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({
            "error": "Username and password are required"
        }), 400

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        return jsonify({
            "error": "Invalid username or password"
        }), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={
            "username": user.username,
            "role": user.role
        }
    )

    return jsonify({
        "message": "Login successful",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role
        }
    }), 200


# GET CURRENT LOGGED-IN USER
@auth_bp.route("/auth/me", methods=["GET"])
@jwt_required()
def get_current_user():

    user_id = get_jwt_identity()

    user = db.session.get(User, int(user_id))

    if not user:
        return jsonify({
            "error": "User not found"
        }), 404

    return jsonify({
        "id": user.id,
        "username": user.username,
        "role": user.role
    }), 200