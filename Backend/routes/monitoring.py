from datetime import datetime, timedelta

from flask import Blueprint, g, jsonify, request

from database import db
from models import MonitoringSession, PostureEvent
from utils.auth import token_required


monitoring_bp = Blueprint("monitoring", __name__, url_prefix="/api/monitoring")


def _format_seconds(seconds):
    total = int(round(float(seconds or 0)))
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def _range_bounds(range_name):
    now = datetime.utcnow()
    if range_name == "month":
        start = now - timedelta(days=28)
        buckets = [
            (f"Week {index + 1}", start + timedelta(days=index * 7), start + timedelta(days=(index + 1) * 7))
            for index in range(4)
        ]
        return start, buckets

    start = now - timedelta(days=6)
    buckets = []
    for index in range(7):
        bucket_start = (start + timedelta(days=index)).replace(hour=0, minute=0, second=0, microsecond=0)
        bucket_end = bucket_start + timedelta(days=1)
        buckets.append((bucket_start.strftime("%a"), bucket_start, bucket_end))
    return start, buckets


def _safe_average(values):
    cleaned = [float(value or 0) for value in values]
    return round(sum(cleaned) / len(cleaned)) if cleaned else 0


def _session_score(session):
    return int(round(session.average_posture_score or session.last_posture_score or 0))


def _serialize_session_row(session):
    total = float(session.total_duration_seconds or 0)
    good = float(session.good_posture_seconds or 0)
    bad = float(session.bad_posture_seconds or 0)
    unclear = float(session.unclear_seconds or 0)
    camera = float(session.camera_misaligned_seconds or 0)

    return {
        "id": session.id,
        "status": session.status,
        "date": session.started_at.strftime("%b %d"),
        "startedAt": session.started_at.isoformat(),
        "endedAt": session.ended_at.isoformat() if session.ended_at else None,
        "duration": _format_seconds(total),
        "durationSeconds": int(round(total)),
        "goodTime": _format_seconds(good),
        "goodTimeSeconds": int(round(good)),
        "badTime": _format_seconds(bad),
        "badTimeSeconds": int(round(bad)),
        "unclearTimeSeconds": int(round(unclear)),
        "cameraMisalignedSeconds": int(round(camera)),
        "score": _session_score(session),
    }


@monitoring_bp.post("/sessions")
@token_required
def start_session():
    session = MonitoringSession(user_id=g.current_user.id, status="active")
    db.session.add(session)
    db.session.commit()
    return jsonify({"success": True, "data": session.to_dict()}), 201


@monitoring_bp.post("/sessions/<int:session_id>/events")
@token_required
def create_event(session_id):
    session = MonitoringSession.query.filter_by(id=session_id, user_id=g.current_user.id).first()
    if not session:
        return jsonify({"success": False, "error": "Monitoring session not found"}), 404
    if session.status != "active":
        return jsonify({"success": False, "error": "Monitoring session is already closed"}), 400

    payload = request.get_json(silent=True) or {}
    posture = payload.get("posture") or "unclear"
    posture_score = int(round(float(payload.get("postureScore") or 0)))
    duration_seconds = float(payload.get("durationSeconds") or 0.0)
    issues = payload.get("issues") or []
    metrics = payload.get("metrics") or {}
    alert_increment = int(payload.get("alertIncrement") or 0)

    event = PostureEvent(
        session=session,
        posture=posture,
        posture_score=posture_score,
        duration_seconds=duration_seconds,
        issues=issues,
        metrics=metrics,
    )
    session.apply_event(posture, posture_score, duration_seconds, alert_increment)

    db.session.add(event)
    db.session.commit()

    return jsonify(
        {
            "success": True,
            "data": {
                "session": session.to_dict(),
                "event": event.to_dict(),
            },
        }
    )


@monitoring_bp.post("/sessions/<int:session_id>/stop")
@token_required
def stop_session(session_id):
    session = MonitoringSession.query.filter_by(id=session_id, user_id=g.current_user.id).first()
    if not session:
        return jsonify({"success": False, "error": "Monitoring session not found"}), 404

    if session.status == "active":
        session.stop()
        db.session.commit()

    return jsonify({"success": True, "data": session.to_dict()})


@monitoring_bp.get("/sessions/current")
@token_required
def get_current_session():
    session = (
        MonitoringSession.query.filter_by(user_id=g.current_user.id, status="active")
        .order_by(MonitoringSession.started_at.desc())
        .first()
    )
    return jsonify({"success": True, "data": session.to_dict() if session else None})


@monitoring_bp.get("/dashboard")
@token_required
def dashboard():
    all_sessions = (
        MonitoringSession.query.filter_by(user_id=g.current_user.id)
        .order_by(MonitoringSession.started_at.desc())
        .all()
    )
    latest_session = all_sessions[0] if all_sessions else None
    completed_sessions = [session for session in all_sessions if session.status == "completed"]
    active_session = next((session for session in all_sessions if session.status == "active"), None)

    if latest_session:
        posture_data = {
            "currentPosture": latest_session.current_posture,
            "goodPostureTime": int(round(latest_session.good_posture_seconds)),
            "badPostureTime": int(round(latest_session.bad_posture_seconds)),
            "unclearTime": int(round(latest_session.unclear_seconds)),
            "cameraMisalignedTime": int(round(latest_session.camera_misaligned_seconds)),
            "outOfPositionTime": int(round(latest_session.out_of_position_seconds)),
            "postureScore": _session_score(latest_session),
            "totalSessions": len(completed_sessions),
            "alertCount": latest_session.alert_count,
            "totalDuration": int(round(latest_session.total_duration_seconds)),
            "status": latest_session.status,
        }
    else:
        posture_data = {
            "currentPosture": "good",
            "goodPostureTime": 0,
            "badPostureTime": 0,
            "unclearTime": 0,
            "cameraMisalignedTime": 0,
            "outOfPositionTime": 0,
            "postureScore": 0,
            "totalSessions": 0,
            "alertCount": 0,
            "totalDuration": 0,
            "status": "idle",
        }

    total_monitored_seconds = sum(float(session.total_duration_seconds or 0) for session in completed_sessions)
    total_good_seconds = sum(float(session.good_posture_seconds or 0) for session in completed_sessions)
    total_bad_seconds = sum(float(session.bad_posture_seconds or 0) for session in completed_sessions)
    total_alerts = sum(int(session.alert_count or 0) for session in completed_sessions)
    average_score = _safe_average(_session_score(session) for session in completed_sessions)
    latest_completed = completed_sessions[0] if completed_sessions else None

    summary = {
        "totalSessions": len(completed_sessions),
        "activeSessions": 1 if active_session else 0,
        "totalMonitoredSeconds": int(round(total_monitored_seconds)),
        "totalGoodSeconds": int(round(total_good_seconds)),
        "totalBadSeconds": int(round(total_bad_seconds)),
        "alertCount": total_alerts,
        "averageScore": average_score,
        "latestCompletedScore": _session_score(latest_completed) if latest_completed else 0,
    }

    recent_sessions = [_serialize_session_row(session) for session in completed_sessions[:4]]

    recent_bad_events = (
        PostureEvent.query.join(MonitoringSession)
        .filter(
            MonitoringSession.user_id == g.current_user.id,
            PostureEvent.posture == "bad",
        )
        .order_by(PostureEvent.captured_at.desc())
        .limit(3)
        .all()
    )
    alerts = [
        {
            "id": event.id,
            "type": "warning",
            "message": (event.issues or ["Posture needs correction."])[0],
        }
        for event in recent_bad_events
    ]
    if not alerts and active_session:
        alerts.append(
            {
                "id": "session-active",
                "type": "info",
                "message": "A live monitoring session is currently active.",
            }
        )

    tips = [
        {"id": 1, "title": "Sit Tall", "text": "Keep your head balanced over your shoulders."},
        {"id": 2, "title": "Relax Shoulders", "text": "Avoid lifting your shoulders toward your ears."},
        {"id": 3, "title": "Take Breaks", "text": "Short movement breaks help reset posture quality."},
    ]

    return jsonify(
        {
            "success": True,
            "data": {
                "postureData": posture_data,
                "summary": summary,
                "recentSessions": recent_sessions,
                "alerts": alerts,
                "tips": tips,
            },
        }
    )


@monitoring_bp.get("/analytics")
@token_required
def analytics():
    range_name = request.args.get("range", "week")
    start, buckets = _range_bounds(range_name)

    sessions = (
        MonitoringSession.query.filter(
            MonitoringSession.user_id == g.current_user.id,
            MonitoringSession.started_at >= start,
        )
        .order_by(MonitoringSession.started_at.asc())
        .all()
    )

    chart_data = []
    for label, bucket_start, bucket_end in buckets:
        bucket_sessions = [
            session for session in sessions if bucket_start <= session.started_at < bucket_end
        ]
        total_good = sum(session.good_posture_seconds for session in bucket_sessions)
        total_bad = sum(session.bad_posture_seconds for session in bucket_sessions)
        total = total_good + total_bad
        good_percent = round((total_good / total) * 100) if total else 0
        bad_percent = 100 - good_percent if total else 0
        average_score = (
            round(
                sum(session.average_posture_score or session.last_posture_score for session in bucket_sessions)
                / len(bucket_sessions)
            )
            if bucket_sessions
            else 0
        )
        chart_data.append(
            {
                "label": label,
                "good": good_percent,
                "bad": bad_percent,
                "score": average_score,
                "sessionCount": len(bucket_sessions),
            }
        )

    recent_sessions = list(reversed(sessions[-6:])) if sessions else []
    session_rows = [_serialize_session_row(session) for session in recent_sessions]

    average_good = round(sum(item["good"] for item in chart_data) / len(chart_data)) if chart_data else 0
    average_bad = round(sum(item["bad"] for item in chart_data) / len(chart_data)) if chart_data else 0
    average_score = round(sum(item["score"] for item in chart_data) / len(chart_data)) if chart_data else 0
    summary = {
        "sessionCount": len(sessions),
        "averageScore": average_score,
        "averageGood": average_good,
        "averageBad": average_bad,
        "bestScore": max((_session_score(session) for session in sessions), default=0),
        "lowestScore": min((_session_score(session) for session in sessions), default=0),
        "totalMonitoredSeconds": int(round(sum(float(session.total_duration_seconds or 0) for session in sessions))),
        "alertCount": sum(int(session.alert_count or 0) for session in sessions),
    }
    insights = [
        {
            "id": 1,
            "title": "Average Score",
            "text": f"Your average posture score for this range is {average_score}/100.",
        },
        {
            "id": 2,
            "title": "Good Posture Share",
            "text": f"You maintained good posture for about {average_good}% of monitored time.",
        },
        {
            "id": 3,
            "title": "Recommendation",
            "text": (
                "Keep short breaks and reset your posture whenever the score starts dropping."
                if average_bad < 35
                else "Your bad-posture time is still noticeable. Add more short reset breaks during long sessions."
            ),
        },
    ]

    return jsonify(
        {
            "success": True,
            "data": {
                "summary": summary,
                "chartData": chart_data,
                "sessions": session_rows,
                "insights": insights,
            },
        }
    )
