from functools import wraps

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func

from database import db
from models.exercise import Exercise
from models.monitoring import MonitoringSession
from models.user import User
from utils.auth import token_required

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def admin_required(view):
    """Decorator: must be authenticated AND have role='admin'."""
    @wraps(view)
    @token_required
    def wrapped(*args, **kwargs):
        if g.current_user.role != "admin":
            return jsonify({"success": False, "error": "Admin access required"}), 403
        return view(*args, **kwargs)
    return wrapped


# ── GET /api/admin/overview ──────────────────────────────────
@admin_bp.get("/overview")
@admin_required
def overview():
    total_users   = User.query.count()
    active_users  = User.query.filter_by(is_active=True).count()
    total_sessions = MonitoringSession.query.count()

    # total monitored hours across all sessions
    total_seconds = db.session.query(
        func.sum(MonitoringSession.total_duration_seconds)
    ).scalar() or 0
    total_hours = round(total_seconds / 3600, 1)

    # average posture score across all completed sessions
    avg_score = db.session.query(
        func.avg(MonitoringSession.average_posture_score)
    ).filter(
        MonitoringSession.average_posture_score > 0
    ).scalar() or 0

    total_alerts = db.session.query(
        func.sum(MonitoringSession.alert_count)
    ).scalar() or 0

    # 5 most recent completed sessions with user info
    recent = (
        MonitoringSession.query
        .filter_by(status="completed")
        .order_by(MonitoringSession.ended_at.desc())
        .limit(5)
        .all()
    )

    def _fmt_duration(secs):
        secs = int(secs or 0)
        h, m = divmod(secs, 3600)
        m = m // 60
        if h:
            return f"{h} hr {m} min"
        return f"{m} min"

    recent_sessions = []
    for s in recent:
        user = User.query.get(s.user_id)
        total = s.total_duration_seconds or 1
        good_pct = round(s.good_posture_seconds / total * 100)
        bad_pct  = 100 - good_pct
        recent_sessions.append({
            "id":        s.id,
            "userName":  user.name if user else "Deleted User",
            "userEmail": user.email if user else "",
            "duration":  _fmt_duration(s.total_duration_seconds),
            "score":     round(s.average_posture_score or 0),
            "goodPct":   good_pct,
            "badPct":    bad_pct,
            "date":      s.ended_at.date().isoformat() if s.ended_at else "",
        })

    return jsonify({
        "success": True,
        "data": {
            "stats": {
                "totalUsers":         total_users,
                "activeUsers":        active_users,
                "totalSessions":      total_sessions,
                "totalMonitoredHours": total_hours,
                "avgPostureScore":    round(avg_score),
                "totalAlerts":        int(total_alerts),
            },
            "recentSessions": recent_sessions,
        },
    })


# ── GET /api/admin/users ─────────────────────────────────────
@admin_bp.get("/users")
@admin_required
def get_users():
    users = User.query.order_by(User.created_at.desc()).all()

    result = []
    for u in users:
        session_count = MonitoringSession.query.filter_by(user_id=u.id).count()
        avg_score = db.session.query(
            func.avg(MonitoringSession.average_posture_score)
        ).filter(
            MonitoringSession.user_id == u.id,
            MonitoringSession.average_posture_score > 0,
        ).scalar() or 0

        result.append({
            "id":         u.id,
            "name":       u.name,
            "email":      u.email,
            "role":       u.role,
            "is_active":  u.is_active,
            "created_at": u.created_at.date().isoformat(),
            "sessions":   session_count,
            "avgScore":   round(avg_score),
        })

    return jsonify({"success": True, "data": result})


# ── PATCH /api/admin/users/<id>/status ──────────────────────
@admin_bp.patch("/users/<int:user_id>/status")
@admin_required
def update_status(user_id):
    # prevent admin from deactivating themselves
    if user_id == g.current_user.id:
        return jsonify({"success": False, "error": "You cannot change your own status"}), 400

    user = User.query.get_or_404(user_id)
    payload = request.get_json(silent=True) or {}
    user.is_active = bool(payload.get("is_active", user.is_active))
    db.session.commit()

    return jsonify({"success": True, "data": {"id": user.id, "is_active": user.is_active}})


# ── PATCH /api/admin/users/<id>/role ────────────────────────
@admin_bp.patch("/users/<int:user_id>/role")
@admin_required
def update_role(user_id):
    if user_id == g.current_user.id:
        return jsonify({"success": False, "error": "You cannot change your own role"}), 400

    user = User.query.get_or_404(user_id)
    payload = request.get_json(silent=True) or {}
    role = payload.get("role", "").strip()

    if role not in ("user", "admin"):
        return jsonify({"success": False, "error": "Role must be 'user' or 'admin'"}), 400

    user.role = role
    db.session.commit()

    return jsonify({"success": True, "data": {"id": user.id, "role": user.role}})


# ── DELETE /api/admin/users/<id> ─────────────────────────────
@admin_bp.delete("/users/<int:user_id>")
@admin_required
def delete_user(user_id):
    if user_id == g.current_user.id:
        return jsonify({"success": False, "error": "You cannot delete your own account"}), 400

    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()

    return jsonify({"success": True, "data": {"id": user_id}})


# ════════════════════════════════════════════════════════════
#  EXERCISE MANAGEMENT
# ════════════════════════════════════════════════════════════

# ── GET /api/admin/exercises ─────────────────────────────────
@admin_bp.get("/exercises")
@admin_required
def get_exercises():
    exercises = Exercise.query.order_by(Exercise.id.asc()).all()
    return jsonify({"success": True, "data": [e.to_dict() for e in exercises]})


# ── POST /api/admin/exercises ────────────────────────────────
@admin_bp.post("/exercises")
@admin_required
def create_exercise():
    payload = request.get_json(silent=True) or {}

    name = (payload.get("name") or "").strip()
    category = (payload.get("category") or "").strip()
    if not name or not category:
        return jsonify({"success": False, "error": "Name and category are required"}), 400

    exercise = Exercise(
        name=name,
        category=category,
        duration=payload.get("duration", "3 min").strip(),
        difficulty=payload.get("difficulty", "Easy").strip(),
        description=(payload.get("description") or "").strip(),
        instructions=payload.get("instructions") or [],
        benefits=payload.get("benefits") or [],
        icon=(payload.get("icon") or name[:2].upper()).strip()[:4],
    )
    db.session.add(exercise)
    db.session.commit()

    return jsonify({"success": True, "data": exercise.to_dict()}), 201


# ── PUT /api/admin/exercises/<id> ────────────────────────────
@admin_bp.put("/exercises/<int:exercise_id>")
@admin_required
def update_exercise(exercise_id):
    exercise = Exercise.query.get_or_404(exercise_id)
    payload = request.get_json(silent=True) or {}

    if "name" in payload:
        exercise.name = payload["name"].strip()
    if "category" in payload:
        exercise.category = payload["category"].strip()
    if "duration" in payload:
        exercise.duration = payload["duration"].strip()
    if "difficulty" in payload:
        exercise.difficulty = payload["difficulty"].strip()
    if "description" in payload:
        exercise.description = payload["description"].strip()
    if "instructions" in payload:
        exercise.instructions = payload["instructions"]
    if "benefits" in payload:
        exercise.benefits = payload["benefits"]
    if "icon" in payload:
        exercise.icon = payload["icon"].strip()[:4]
    if "is_active" in payload:
        exercise.is_active = bool(payload["is_active"])

    db.session.commit()
    return jsonify({"success": True, "data": exercise.to_dict()})


# ── DELETE /api/admin/exercises/<id> ─────────────────────────
@admin_bp.delete("/exercises/<int:exercise_id>")
@admin_required
def delete_exercise(exercise_id):
    exercise = Exercise.query.get_or_404(exercise_id)
    db.session.delete(exercise)
    db.session.commit()
    return jsonify({"success": True, "data": {"id": exercise_id}})
