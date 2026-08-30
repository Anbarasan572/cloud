import os
import time
import logging
import threading
from datetime import datetime, timezone

from database.db import db
from models.asset_model import Asset
from models.automation_history_model import AutomationHistory

logger = logging.getLogger("cloudasset.automation")

# ==========================================
# THREAD-SAFE STATE & SCHEDULER CONTROLS
# ==========================================
_scheduler_lock = threading.Lock()
_is_scheduler_running = False
_stop_event = threading.Event()

_automation_state = {
    "status": "Running",
    "last_check": None,
    "assets_checked": 0,
    "overdue_detected": 0,
    "last_error": None
}


def get_automation_status():
    """Retrieve current in-memory automation telemetry status."""
    with _scheduler_lock:
        return dict(_automation_state)


def run_overdue_check(app):
    """
    Executes a single cycle of overdue asset analysis:
    - Scans all assets in database
    - Evaluates due dates safely against today's date
    - Preserves operational status (e.g. Running, Stopped) without overwriting
    - Records persistent execution history
    """
    global _automation_state

    with app.app_context():
        now_utc = datetime.now(timezone.utc)
        today = datetime.now().date()

        try:
            assets = Asset.query.all()
            assets_checked = len(assets)
            overdue_count = 0

            for asset in assets:
                try:
                    if asset.due_date and asset.due_date < today:
                        overdue_count += 1
                except Exception as asset_err:
                    logger.warning(f"Error checking due_date for asset #{asset.id}: {asset_err}")

            # Persist execution cycle in database
            history_record = AutomationHistory(
                timestamp=now_utc,
                status="SUCCESS",
                assets_checked=assets_checked,
                overdue_detected=overdue_count,
                error_message=None
            )
            db.session.add(history_record)
            db.session.commit()

            # Update telemetry state
            with _scheduler_lock:
                _automation_state["status"] = "Running"
                _automation_state["last_check"] = now_utc.isoformat()
                _automation_state["assets_checked"] = assets_checked
                _automation_state["overdue_detected"] = overdue_count
                _automation_state["last_error"] = None

            logger.info(
                f"[AUTOMATION] Overdue check complete: {assets_checked} checked, "
                f"{overdue_count} overdue detected."
            )

            return {
                "status": "SUCCESS",
                "assets_checked": assets_checked,
                "overdue_detected": overdue_count,
                "timestamp": now_utc.isoformat()
            }

        except Exception as e:
            db.session.rollback()
            err_msg = str(e)
            logger.error(f"[AUTOMATION] Error during overdue check: {err_msg}")

            try:
                history_record = AutomationHistory(
                    timestamp=now_utc,
                    status="ERROR",
                    assets_checked=0,
                    overdue_detected=0,
                    error_message=err_msg
                )
                db.session.add(history_record)
                db.session.commit()
            except Exception as hist_err:
                logger.error(f"[AUTOMATION] Failed to persist error history: {hist_err}")

            with _scheduler_lock:
                _automation_state["status"] = "Error"
                _automation_state["last_check"] = now_utc.isoformat()
                _automation_state["last_error"] = err_msg

            return {
                "status": "ERROR",
                "error": err_msg,
                "timestamp": now_utc.isoformat()
            }


def _worker_loop(app, interval_seconds):
    """Background worker daemon loop."""
    logger.info(f"[AUTOMATION] Background scheduler started with {interval_seconds}s interval.")

    # Run initial check on startup
    run_overdue_check(app)

    while not _stop_event.is_set():
        # Sleep in small slices to allow fast shutdown if requested
        for _ in range(int(interval_seconds)):
            if _stop_event.is_set():
                break
            time.sleep(1)

        if not _stop_event.is_set():
            run_overdue_check(app)

    logger.info("[AUTOMATION] Background scheduler stopped.")


def start_automation_scheduler(app, interval_seconds=None):
    """
    Safely starts the singleton background scheduler.
    Guaranteed to run at most ONE worker thread per process.
    """
    global _is_scheduler_running

    with _scheduler_lock:
        if _is_scheduler_running:
            logger.info("[AUTOMATION] Scheduler already running; skipping duplicate initialization.")
            return False

        if interval_seconds is None:
            interval_seconds = int(os.environ.get("AUTOMATION_INTERVAL_SECONDS", 60))

        _stop_event.clear()
        thread = threading.Thread(
            target=_worker_loop,
            args=(app, interval_seconds),
            name="CloudAsset-OverdueAutomationWorker",
            daemon=True
        )
        thread.start()
        _is_scheduler_running = True
        logger.info("[AUTOMATION] Scheduler thread initialized successfully.")
        return True


def stop_automation_scheduler():
    """Stops the background scheduler cleanly."""
    global _is_scheduler_running
    with _scheduler_lock:
        _stop_event.set()
        _is_scheduler_running = False
