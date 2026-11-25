from pathlib import Path

from flask import Blueprint, jsonify, request, send_file

from services import analyze_posture_payload


posture_bp = Blueprint("posture", __name__, url_prefix="/api/posture")
MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "pose_landmarker_lite.task"


@posture_bp.post("/analyze")
def analyze_posture():
    payload = request.get_json(silent=True) or {}
    result = analyze_posture_payload(payload)

    if not result["ok"]:
        return jsonify({"success": False, **{k: v for k, v in result.items() if k != "ok"}}), 400

    return jsonify({"success": True, "data": result["data"]})


@posture_bp.get("/sample")
def sample_posture():
    sample_payload = {
        "landmarks": {
            "nose": {"x": 0.50, "y": 0.25, "z": -0.02, "visibility": 0.98},
            "left_eye": {"x": 0.47, "y": 0.22, "z": -0.02, "visibility": 0.97},
            "right_eye": {"x": 0.53, "y": 0.22, "z": -0.02, "visibility": 0.97},
            "left_shoulder": {"x": 0.42, "y": 0.45, "z": -0.08, "visibility": 0.99},
            "right_shoulder": {"x": 0.58, "y": 0.46, "z": -0.06, "visibility": 0.99},
            "left_ear": {"x": 0.44, "y": 0.28, "z": -0.04, "visibility": 0.96},
            "right_ear": {"x": 0.56, "y": 0.29, "z": -0.03, "visibility": 0.96},
            "mouth_left": {"x": 0.47, "y": 0.30, "z": -0.02, "visibility": 0.95},
            "mouth_right": {"x": 0.53, "y": 0.30, "z": -0.02, "visibility": 0.95},
        }
    }
    result = analyze_posture_payload(sample_payload)
    return jsonify({"success": True, "data": result["data"], "sample": sample_payload})


@posture_bp.get("/model")
def posture_model():
    return send_file(MODEL_PATH, mimetype="application/octet-stream", as_attachment=False)
