import os

from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from database.db import db
from routes.asset_routes import asset_bp
from routes.auth_routes import auth_bp
from models.user_model import User


# Create Flask application
app = Flask(__name__)


# ==========================================
# CORS
# ==========================================

CORS(
    app,
    supports_credentials=False,
    allow_headers=["Content-Type", "Authorization"]
)


# ==========================================
# DATABASE CONFIGURATION
# ==========================================

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///cloudasset.db"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# ==========================================
# JWT CONFIGURATION
# ==========================================

app.config["JWT_SECRET_KEY"] = os.environ.get(
    "JWT_SECRET_KEY",
    "change-this-secret-key-before-production"
)


# Initialize database
db.init_app(app)


# Initialize JWT
jwt = JWTManager(app)


# ==========================================
# REGISTER API ROUTES
# ==========================================

app.register_blueprint(asset_bp)
app.register_blueprint(auth_bp)


# ==========================================
# HOME ROUTE
# ==========================================

@app.route("/")
def home():
    return {
        "message": "CloudAsset Backend Running 🚀"
    }


# ==========================================
# CREATE DATABASE TABLES + DEFAULT USERS
# ==========================================

with app.app_context():

    # Create Asset and User tables
    db.create_all()

    # --------------------------------------
    # DEFAULT ADMIN
    # --------------------------------------

    admin = User.query.filter_by(
        username="admin"
    ).first()

    if not admin:

        admin = User(
            username="admin",
            role="admin"
        )

        admin.set_password(
            os.environ.get(
                "ADMIN_PASSWORD",
                "Admin@123"
            )
        )

        db.session.add(admin)


    # --------------------------------------
    # DEFAULT EMPLOYEE
    # --------------------------------------

    employee = User.query.filter_by(
        username="employee"
    ).first()

    if not employee:

        employee = User(
            username="employee",
            role="employee"
        )

        employee.set_password(
            os.environ.get(
                "EMPLOYEE_PASSWORD",
                "Employee@123"
            )
        )

        db.session.add(employee)


    db.session.commit()


# ==========================================
# RUN APPLICATION
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )