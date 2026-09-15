import os
import sys
from datetime import datetime, timedelta

# Set testing environment
os.environ["JWT_SECRET_KEY"] = "cloudasset-development-secret-key-2026"

from app import app, db
from models.user_model import User
from models.asset_model import Asset
from models.activity_log_model import ActivityLog


def test_activity_log_feature():
    print("==================================================")
    print("TESTING ADMIN-ONLY ACTIVITY LOG FEATURE")
    print("==================================================")

    test_client = app.test_client()

    with app.app_context():
        db.create_all()

    # 1. Admin Login & Log Creation
    print("\n[STEP 1] Testing Admin Login Activity Log...")
    admin_login_res = test_client.post("/auth/login", json={
        "username": "admin",
        "password": "Admin@123"
    })
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.data}"
    admin_token = admin_login_res.get_json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("  [OK] Admin logged in successfully")

    # 2. Employee Login & Log Creation
    print("\n[STEP 2] Testing Employee Login Activity Log...")
    emp_login_res = test_client.post("/auth/login", json={
        "username": "employee",
        "password": "Employee@123"
    })
    assert emp_login_res.status_code == 200, f"Employee login failed: {emp_login_res.data}"
    employee_token = emp_login_res.get_json()["access_token"]
    employee_headers = {"Authorization": f"Bearer {employee_token}"}
    print("  [OK] Employee logged in successfully")

    # 3. Employee Access to GET /activity-logs must be 403 Forbidden
    print("\n[STEP 3] Testing Employee RBAC (Must receive 403 Forbidden)...")
    emp_activity_res = test_client.get("/activity-logs", headers=employee_headers)
    assert emp_activity_res.status_code == 403, f"Expected 403 Forbidden for employee, got {emp_activity_res.status_code}"
    print(f"  [OK] Employee blocked from /activity-logs (status 403 Forbidden): {emp_activity_res.get_json()}")

    # 4. Unauthenticated Access must be 401 Unauthorized
    print("\n[STEP 4] Testing Unauthenticated Access (Must receive 401 Unauthorized)...")
    unauth_res = test_client.get("/activity-logs")
    assert unauth_res.status_code == 401, f"Expected 401 for unauthenticated request, got {unauth_res.status_code}"
    print("  [OK] Unauthenticated request rejected with 401 Unauthorized")

    # 5. Admin Access to GET /activity-logs must be 200 OK
    print("\n[STEP 5] Testing Admin Access to GET /activity-logs...")
    admin_activity_res = test_client.get("/activity-logs", headers=admin_headers)
    assert admin_activity_res.status_code == 200, f"Admin failed to access /activity-logs: {admin_activity_res.data}"
    logs = admin_activity_res.get_json()
    assert isinstance(logs, list), "Logs should be a JSON array"
    assert len(logs) >= 2, f"Expected at least 2 login logs, got {len(logs)}"
    print(f"  [OK] Admin successfully retrieved {len(logs)} activity log records")
    print(f"       Latest log: Action={logs[0]['action']}, User={logs[0]['username']}, Details={logs[0]['details']}")

    # 6. Admin Create Asset & Verify Activity Log
    print("\n[STEP 6] Testing Asset Creation and CREATE log...")
    create_asset_res = test_client.post("/assets", headers=admin_headers, json={
        "asset_name": "Activity Test Server",
        "provider": "AWS",
        "service": "EC2",
        "region": "us-east-1",
        "status": "Running",
        "owner": "DevOps Team",
        "cost": 150.00
    })
    assert create_asset_res.status_code == 201, f"Asset creation failed: {create_asset_res.data}"
    asset_id = create_asset_res.get_json()["id"]

    logs_after_create = test_client.get("/activity-logs", headers=admin_headers).get_json()
    assert logs_after_create[0]["action"] == "CREATE", f"Expected latest action CREATE, got {logs_after_create[0]['action']}"
    assert "Activity Test Server" in logs_after_create[0]["details"], f"Asset name missing in details: {logs_after_create[0]['details']}"
    print(f"  [OK] CREATE log verified: {logs_after_create[0]}")

    # 7. Admin Update Asset & Verify Activity Log
    print("\n[STEP 7] Testing Asset Update and UPDATE log...")
    update_asset_res = test_client.put(f"/assets/{asset_id}", headers=admin_headers, json={
        "asset_name": "Activity Test Server Updated",
        "cost": 175.00
    })
    assert update_asset_res.status_code == 200, f"Asset update failed: {update_asset_res.data}"

    logs_after_update = test_client.get("/activity-logs", headers=admin_headers).get_json()
    assert logs_after_update[0]["action"] == "UPDATE", f"Expected latest action UPDATE, got {logs_after_update[0]['action']}"
    assert "Activity Test Server Updated" in logs_after_update[0]["details"], f"Updated name missing in details: {logs_after_update[0]['details']}"
    print(f"  [OK] UPDATE log verified: {logs_after_update[0]}")

    # 8. Admin Delete Asset & Verify Activity Log
    print("\n[STEP 8] Testing Asset Deletion and DELETE log...")
    delete_asset_res = test_client.delete(f"/assets/{asset_id}", headers=admin_headers)
    assert delete_asset_res.status_code == 200, f"Asset deletion failed: {delete_asset_res.data}"

    logs_after_delete = test_client.get("/activity-logs", headers=admin_headers).get_json()
    assert logs_after_delete[0]["action"] == "DELETE", f"Expected latest action DELETE, got {logs_after_delete[0]['action']}"
    assert "Activity Test Server Updated" in logs_after_delete[0]["details"], f"Deleted name missing in details: {logs_after_delete[0]['details']}"
    print(f"  [OK] DELETE log verified: {logs_after_delete[0]}")

    print("\n==================================================")
    print("ALL ACTIVITY LOG BACKEND TESTS PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    test_activity_log_feature()
