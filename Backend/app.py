import os
from datetime import timedelta
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from database.db import db
from routes.asset_routes import asset_bp
from routes.auth_routes import auth_bp
from routes.automation_routes import automation_bp
from models.user_model import User
from models.automation_history_model import AutomationHistory
from services.automation_service import start_automation_scheduler


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
    "cloudasset-development-secret-key-2026"
)

# Session remains valid for 8 hours
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=8)

# ==========================================
# INITIALIZE DATABASE
# ==========================================

db.init_app(app)


# ==========================================
# INITIALIZE JWT
# ==========================================

jwt = JWTManager(app)


# ==========================================
# REGISTER API ROUTES
# ==========================================

app.register_blueprint(asset_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(automation_bp)

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

    # Create Asset, User, and AutomationHistory tables
    db.create_all()

    # Ensure due_date column exists in asset table if SQLite table was created prior
    try:
        from sqlalchemy import text
        with db.engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(asset)")).fetchall()
            col_names = [row[1] for row in result]
            if "due_date" not in col_names:
                conn.execute(text("ALTER TABLE asset ADD COLUMN due_date DATE"))
                conn.commit()
    except Exception:
        pass

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
# START BACKGROUND SCHEDULER
# ==========================================

# Prevent duplicate worker thread when Flask debug reloader is active
if os.environ.get("WERKZEUG_RUN_MAIN") == "true" or not app.debug:
    start_automation_scheduler(app)


# ==========================================
# RUN APPLICATION
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )