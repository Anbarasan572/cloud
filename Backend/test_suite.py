import os
import sys
import time
import json
from datetime import datetime, timedelta

# Set testing environment
os.environ["JWT_SECRET_KEY"] = "cloudasset-development-secret-key-2026"
os.environ["AUTOMATION_INTERVAL_SECONDS"] = "2"

from app import app, db
from models.user_model import User
from models.asset_model import Asset
from models.automation_history_model import AutomationHistory
from services.automation_service import (
    start_automation_scheduler,
    stop_automation_scheduler,
    run_overdue_check,
    get_automation_status
)


def run_all_tests():
    print("==================================================")
    print("STARTING CLOUDASSET AUTOMATION & RBAC REGRESSION TEST")
    print("==================================================")

    test_client = app.test_client()

    with app.app_context():
        # Ensure fresh DB state for testing
        db.create_all()

    # ----------------------------------------------------
    # TEST 1: AUTHENTICATION
    # ----------------------------------------------------
    print("\n[TEST 1] Testing Admin and Employee Login...")
    admin_login_res = test_client.post("/auth/login", json={
        "username": "admin",
        "password": "Admin@123"
    })
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.data}"
    admin_data = admin_login_res.get_json()
    admin_token = admin_data["access_token"]
    assert admin_data["user"]["role"] == "admin", "Admin role mismatch"
    print("  [OK] Admin login successful with role: admin")

    employee_login_res = test_client.post("/auth/login", json={
        "username": "employee",
        "password": "Employee@123"
    })
    assert employee_login_res.status_code == 200, f"Employee login failed: {employee_login_res.data}"
    employee_data = employee_login_res.get_json()
    employee_token = employee_data["access_token"]
    assert employee_data["user"]["role"] == "employee", "Employee role mismatch"
    print("  [OK] Employee login successful with role: employee")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    employee_headers = {"Authorization": f"Bearer {employee_token}"}

    # ----------------------------------------------------
    # TEST 2: ADMIN ASSET CREATION & DUE DATES
    # ----------------------------------------------------
    print("\n[TEST 2] Testing Admin Asset Management with Due Dates...")
    past_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d")
    future_date = (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d")

    # Create Asset 1 (Active, Future due date -> NOT overdue)
    asset1_res = test_client.post("/assets", headers=admin_headers, json={
        "asset_name": "Prod Web App Server",
        "provider": "AWS",
        "service": "EC2",
        "region": "us-east-1",
        "status": "Running",
        "owner": "DevOps Team",
        "cost": 120.50,
        "due_date": future_date
    })
    assert asset1_res.status_code == 201, f"Asset 1 creation failed: {asset1_res.data}"
    asset1_id = asset1_res.get_json()["id"]

    # Create Asset 2 (Running, Past due date -> IS overdue)
    asset2_res = test_client.post("/assets", headers=admin_headers, json={
        "asset_name": "Legacy Database Cluster",
        "provider": "Azure",
        "service": "RDS",
        "region": "eu-west-1",
        "status": "Running",
        "owner": "Infrastructure Team",
        "cost": 350.00,
        "due_date": past_date
    })
    assert asset2_res.status_code == 201, f"Asset 2 creation failed: {asset2_res.data}"
    asset2_id = asset2_res.get_json()["id"]

    # Create Asset 3 (Stopped, No due date -> NOT overdue)
    asset3_res = test_client.post("/assets", headers=admin_headers, json={
        "asset_name": "Backup S3 Archive",
        "provider": "GCP",
        "service": "S3",
        "region": "us-west-1",
        "status": "Stopped",
        "owner": "QA Team",
        "cost": 45.00,
        "due_date": None
    })
    assert asset3_res.status_code == 201, f"Asset 3 creation failed: {asset3_res.data}"
    asset3_id = asset3_res.get_json()["id"]

    print(f"  [OK] Created 3 test assets with IDs: {asset1_id}, {asset2_id}, {asset3_id}")

    # ----------------------------------------------------
    # TEST 3: BACKEND RBAC RESTRICTIONS (EMPLOYEE BLOCKED)
    # ----------------------------------------------------
    print("\n[TEST 3] Testing Backend RBAC Protection for Employees...")

    # Employee attempt to Add Asset -> 403
    emp_post = test_client.post("/assets", headers=employee_headers, json={
        "asset_name": "Illegal Employee Asset",
        "provider": "AWS",
        "service": "EC2"
    })
    assert emp_post.status_code == 403, f"Expected 403 for employee POST, got {emp_post.status_code}"
    print("  [OK] Employee blocked from POST /assets (403 Forbidden)")

    # Employee attempt to Update Asset -> 403
    emp_put = test_client.put(f"/assets/{asset1_id}", headers=employee_headers, json={
        "asset_name": "Hacked Asset Name"
    })
    assert emp_put.status_code == 403, f"Expected 403 for employee PUT, got {emp_put.status_code}"
    print("  [OK] Employee blocked from PUT /assets/<id> (403 Forbidden)")

    # Employee attempt to Delete Asset -> 403
    emp_del = test_client.delete(f"/assets/{asset1_id}", headers=employee_headers)
    assert emp_del.status_code == 403, f"Expected 403 for employee DELETE, got {emp_del.status_code}"
    print("  [OK] Employee blocked from DELETE /assets/<id> (403 Forbidden)")

    # Employee attempt to Access Automation Status -> 403
    emp_auto_stat = test_client.get("/automation/status", headers=employee_headers)
    assert emp_auto_stat.status_code == 403, f"Expected 403 for employee GET /automation/status, got {emp_auto_stat.status_code}"
    print("  [OK] Employee blocked from GET /automation/status (403 Forbidden)")

    # Employee attempt to Access Automation History -> 403
    emp_auto_hist = test_client.get("/automation/history", headers=employee_headers)
    assert emp_auto_hist.status_code == 403, f"Expected 403 for employee GET /automation/history, got {emp_auto_hist.status_code}"
    print("  [OK] Employee blocked from GET /automation/history (403 Forbidden)")

    # Employee attempt to Trigger Automation -> 403
    emp_auto_run = test_client.post("/automation/run-now", headers=employee_headers)
    assert emp_auto_run.status_code == 403, f"Expected 403 for employee POST /automation/run-now, got {emp_auto_run.status_code}"
    print("  [OK] Employee blocked from POST /automation/run-now (403 Forbidden)")

    # ----------------------------------------------------
    # TEST 4: EMPLOYEE VIEW-ONLY ALLOWED ACCESS
    # ----------------------------------------------------
    print("\n[TEST 4] Testing Employee Allowed View-Only Access...")
    emp_assets = test_client.get("/assets", headers=employee_headers)
    assert emp_assets.status_code == 200, "Employee failed to view assets"
    assert len(emp_assets.get_json()) >= 3, "Assets list incomplete for employee"
    print("  [OK] Employee can read GET /assets (200 OK)")

    emp_single = test_client.get(f"/assets/{asset1_id}", headers=employee_headers)
    assert emp_single.status_code == 200, "Employee failed to view single asset"
    print("  [OK] Employee can read GET /assets/<id> (200 OK)")

    emp_dash = test_client.get("/assets/dashboard", headers=employee_headers)
    assert emp_dash.status_code == 200, "Employee failed to view dashboard statistics"
    dash_data = emp_dash.get_json()
    assert dash_data["overdue"] >= 1, f"Expected overdue count >= 1, got {dash_data['overdue']}"
    print(f"  [OK] Employee can read GET /assets/dashboard (200 OK, overdue count: {dash_data['overdue']})")

    # ----------------------------------------------------
    # TEST 5: AUTOMATION EXECUTION & STATUS PROTECTION
    # ----------------------------------------------------
    print("\n[TEST 5] Testing Automation Cycle & Operational Status Preservation...")
    # Trigger automation cycle
    run_result = run_overdue_check(app)
    assert run_result["status"] == "SUCCESS", f"Automation check failed: {run_result}"
    assert run_result["overdue_detected"] >= 1, "Failed to detect overdue asset"
    print(f"  [OK] Automation cycle executed: {run_result['assets_checked']} checked, {run_result['overdue_detected']} overdue detected")

    # Verify Asset 2 operational status remained 'Running'
    with app.app_context():
        asset2 = db.session.get(Asset, asset2_id)
        assert asset2.status == "Running", f"CRITICAL ERROR: Asset operational status changed to {asset2.status}!"
        assert asset2.is_overdue is True, "Asset 2 is_overdue property should be True"
        print(f"  [OK] Operational status preserved: '{asset2.status}' (is_overdue: {asset2.is_overdue})")

    # Admin GET /automation/status
    admin_stat = test_client.get("/automation/status", headers=admin_headers)
    assert admin_stat.status_code == 200, "Admin failed to get automation status"
    stat_json = admin_stat.get_json()
    assert stat_json["status"] == "Running", "Automation status mismatch"
    assert stat_json["overdue_detected"] >= 1, "Overdue count mismatch"
    print(f"  [OK] Admin GET /automation/status returned: {stat_json}")

    # Admin GET /automation/history
    admin_hist = test_client.get("/automation/history", headers=admin_headers)
    assert admin_hist.status_code == 200, "Admin failed to get automation history"
    hist_json = admin_hist.get_json()
    assert len(hist_json) >= 1, "Automation history is empty"
    assert hist_json[0]["status"] == "SUCCESS", "History log status mismatch"
    print(f"  [OK] Admin GET /automation/history returned {len(hist_json)} log entries (latest status: {hist_json[0]['status']})")

    # ----------------------------------------------------
    # TEST 6: DUPLICATE SCHEDULER PREVENTION
    # ----------------------------------------------------
    print("\n[TEST 6] Testing Duplicate Scheduler Prevention...")
    res1 = start_automation_scheduler(app, interval_seconds=10)
    res2 = start_automation_scheduler(app, interval_seconds=10)
    assert res2 is False, "Duplicate scheduler instance was allowed to start!"
    print("  [OK] Duplicate scheduler startup safely prevented (returned False)")

    # ----------------------------------------------------
    # TEST 7: ADMIN UPDATE & DELETE ASSET
    # ----------------------------------------------------
    print("\n[TEST 7] Testing Admin Update and Delete...")
    update_res = test_client.put(f"/assets/{asset3_id}", headers=admin_headers, json={
        "status": "Running",
        "cost": 99.00
    })
    assert update_res.status_code == 200, "Admin update failed"
    print("  [OK] Admin successfully updated asset")

    delete_res = test_client.delete(f"/assets/{asset3_id}", headers=admin_headers)
    assert delete_res.status_code == 200, "Admin delete failed"
    print("  [OK] Admin successfully deleted asset")

    print("\n==================================================")
    print("ALL 7 TEST SUITES PASSED WITH 100% SUCCESS! ALL GREEN")
    print("==================================================")


if __name__ == "__main__":
    run_all_tests()
