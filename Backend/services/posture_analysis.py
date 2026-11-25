import math
import pickle
from pathlib import Path


ML_MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "posture_random_forest.pkl"
_ML_MODEL_BUNDLE = None
_ML_MODEL_LOAD_ATTEMPTED = False

LANDMARK_KEYS = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "mouth_left",
    "mouth_right",
    "left_shoulder",
    "right_shoulder",
]


def _point_from_landmark(landmark):
    return {
        "x": float(landmark.get("x", 0.0)),
        "y": float(landmark.get("y", 0.0)),
        "z": float(landmark.get("z", 0.0)),
        "visibility": float(landmark.get("visibility", 1.0)),
    }


def _average_point(point_a, point_b):
    return {
        "x": (point_a["x"] + point_b["x"]) / 2,
        "y": (point_a["y"] + point_b["y"]) / 2,
        "z": (point_a["z"] + point_b["z"]) / 2,
        "visibility": min(point_a["visibility"], point_b["visibility"]),
    }


def _distance(point_a, point_b):
    return math.sqrt(
        (point_a["x"] - point_b["x"]) ** 2
        + (point_a["y"] - point_b["y"]) ** 2
        + (point_a["z"] - point_b["z"]) ** 2
    )


def _baseline_metric(baseline, key, fallback):
    if not isinstance(baseline, dict):
        return fallback
    try:
        return float(baseline.get(key, fallback))
    except (TypeError, ValueError):
        return fallback


def _load_ml_model_bundle():
    global _ML_MODEL_BUNDLE, _ML_MODEL_LOAD_ATTEMPTED

    if _ML_MODEL_LOAD_ATTEMPTED:
        return _ML_MODEL_BUNDLE

    _ML_MODEL_LOAD_ATTEMPTED = True
    if not ML_MODEL_PATH.exists():
        return None

    try:
        with ML_MODEL_PATH.open("rb") as model_file:
            _ML_MODEL_BUNDLE = pickle.load(model_file)
        model = _ML_MODEL_BUNDLE.get("model") if isinstance(_ML_MODEL_BUNDLE, dict) else None
        if model is not None and hasattr(model, "n_jobs"):
            model.n_jobs = 1
    except Exception:
        _ML_MODEL_BUNDLE = None

    return _ML_MODEL_BUNDLE


def _ml_feature_map(landmarks, metrics):
    features = {
        "shoulder_width": metrics["shoulder_width"],
        "shoulder_tilt": metrics["shoulder_tilt"],
        "shoulder_depth": metrics["shoulder_depth"],
        "face_to_shoulder_depth": metrics["face_to_shoulder_depth"],
        "head_center_offset": metrics["head_center_offset"],
        "neck_height_ratio": metrics["neck_height_ratio"],
        "face_balance": metrics["face_balance"],
        "face_level_balance": metrics["face_level_balance"],
        "face_height_ratio": metrics["face_height_ratio"],
        "face_frame_offset": metrics["face_frame_offset"],
        "shoulder_frame_offset": metrics["shoulder_frame_offset"],
        "eye_to_shoulder_drop": metrics["eye_to_shoulder_drop"],
        "head_to_shoulder_distance": metrics["head_to_shoulder_distance"],
        "min_visibility": metrics["visibility_score"],
        "avg_visibility": sum(landmarks[key]["visibility"] for key in LANDMARK_KEYS) / len(LANDMARK_KEYS),
    }

    for key in LANDMARK_KEYS:
        for axis in ("x", "y", "z", "visibility"):
            features[f"{key}_{axis}"] = landmarks[key][axis]

    return features


def _predict_posture_with_ml(landmarks, metrics):
    bundle = _load_ml_model_bundle()
    if not bundle:
        return None

    model = bundle.get("model")
    feature_names = bundle.get("feature_names") or []
    if not model or not feature_names:
        return None

    feature_map = _ml_feature_map(landmarks, metrics)
    try:
        vector = [[float(feature_map[name]) for name in feature_names]]
        prediction = str(model.predict(vector)[0]).upper()
        probabilities = {}
        if hasattr(model, "predict_proba"):
            probabilities = {
                str(label).upper(): float(probability)
                for label, probability in zip(model.classes_, model.predict_proba(vector)[0])
            }
        confidence = probabilities.get(prediction, 0.0)
        good_probability = probabilities.get("GOOD", 1.0 if prediction == "GOOD" else 0.0)
        return {
            "label": "good" if prediction == "GOOD" else "bad",
            "rawLabel": prediction,
            "confidence": confidence,
            "goodProbability": good_probability,
            "badProbability": probabilities.get("BAD", 1.0 if prediction == "BAD" else 0.0),
        }
    except Exception:
        return None


def _required_landmarks(payload):
    landmarks = payload.get("landmarks") or {}
    required_keys = [
        "nose",
        "left_eye",
        "right_eye",
        "mouth_left",
        "mouth_right",
        "left_shoulder",
        "right_shoulder",
        "left_ear",
        "right_ear",
    ]

    missing = [key for key in required_keys if key not in landmarks]
    if missing:
        return None, missing

    normalized = {key: _point_from_landmark(landmarks[key]) for key in required_keys}
    return normalized, []


def analyze_posture_payload(payload):
    landmarks, missing = _required_landmarks(payload)
    if missing:
        return {
            "ok": False,
            "error": "Missing required landmarks",
            "details": {"missing": missing},
        }

    nose = landmarks["nose"]
    left_eye = landmarks["left_eye"]
    right_eye = landmarks["right_eye"]
    mouth_left = landmarks["mouth_left"]
    mouth_right = landmarks["mouth_right"]
    left_shoulder = landmarks["left_shoulder"]
    right_shoulder = landmarks["right_shoulder"]
    left_ear = landmarks["left_ear"]
    right_ear = landmarks["right_ear"]

    shoulder_mid = _average_point(left_shoulder, right_shoulder)
    ear_mid = _average_point(left_ear, right_ear)
    eye_mid = _average_point(left_eye, right_eye)
    mouth_mid = _average_point(mouth_left, mouth_right)

    shoulder_width = abs(left_shoulder["x"] - right_shoulder["x"])
    shoulder_tilt = abs(left_shoulder["y"] - right_shoulder["y"])
    shoulder_depth = -shoulder_mid["z"]
    face_to_shoulder_depth = shoulder_mid["z"] - nose["z"]
    head_center_offset = abs(nose["x"] - shoulder_mid["x"]) / max(shoulder_width, 0.001)
    neck_height_ratio = abs(shoulder_mid["y"] - ear_mid["y"]) / max(shoulder_width, 0.001)
    face_balance = abs(_distance(nose, left_ear) - _distance(nose, right_ear)) / max(
        shoulder_width,
        0.001,
    )
    face_level_balance = abs(left_eye["y"] - right_eye["y"]) / max(shoulder_width, 0.001)
    face_height_ratio = abs(mouth_mid["y"] - eye_mid["y"]) / max(shoulder_width, 0.001)
    face_frame_offset = abs(eye_mid["y"] - 0.28)
    shoulder_frame_offset = abs(shoulder_mid["y"] - 0.58)
    eye_to_shoulder_drop = abs(shoulder_mid["y"] - eye_mid["y"]) / max(shoulder_width, 0.001)
    head_to_shoulder_distance = _distance(ear_mid, shoulder_mid)
    visibility_score = min(
        nose["visibility"],
        left_eye["visibility"],
        right_eye["visibility"],
        mouth_left["visibility"],
        mouth_right["visibility"],
        left_shoulder["visibility"],
        right_shoulder["visibility"],
        left_ear["visibility"],
        right_ear["visibility"],
    )
    computed_metrics = {
        "shoulder_width": shoulder_width,
        "shoulder_tilt": shoulder_tilt,
        "shoulder_depth": shoulder_depth,
        "face_to_shoulder_depth": face_to_shoulder_depth,
        "head_center_offset": head_center_offset,
        "neck_height_ratio": neck_height_ratio,
        "face_balance": face_balance,
        "face_level_balance": face_level_balance,
        "face_height_ratio": face_height_ratio,
        "face_frame_offset": face_frame_offset,
        "shoulder_frame_offset": shoulder_frame_offset,
        "eye_to_shoulder_drop": eye_to_shoulder_drop,
        "head_to_shoulder_distance": head_to_shoulder_distance,
        "visibility_score": visibility_score,
    }

    thresholds = {
        "shoulder_tilt": float(payload.get("shoulderTiltThreshold", 0.07)),
        "head_center_offset": float(payload.get("headCenterOffsetThreshold", 0.18)),
        "minimum_neck_height": float(payload.get("minimumNeckHeightThreshold", 0.75)),
        "maximum_face_balance": float(payload.get("faceBalanceThreshold", 0.18)),
        "minimum_visibility": float(payload.get("minimumVisibility", 0.12)),
        "desk_shoulder_width": float(payload.get("deskShoulderWidthThreshold", 0.12)),
        "maximum_face_level_balance": float(payload.get("faceLevelBalanceThreshold", 0.20)),
        "minimum_face_height": float(payload.get("minimumFaceHeightThreshold", 0.28)),
        "maximum_face_frame_offset": float(payload.get("faceFrameOffsetThreshold", 0.14)),
        "maximum_shoulder_frame_offset": float(payload.get("shoulderFrameOffsetThreshold", 0.15)),
        "minimum_eye_to_shoulder_drop": float(payload.get("eyeToShoulderDropMinThreshold", 0.42)),
        "maximum_eye_to_shoulder_drop": float(payload.get("eyeToShoulderDropMaxThreshold", 1.65)),
        "calibrated_face_frame_tolerance": float(payload.get("calibratedFaceFrameTolerance", 0.06)),
        "calibrated_shoulder_frame_tolerance": float(
            payload.get("calibratedShoulderFrameTolerance", 0.08)
        ),
        "calibrated_shoulder_width_tolerance": float(
            payload.get("calibratedShoulderWidthTolerance", 0.05)
        ),
        "calibrated_shoulder_depth_tolerance": float(
            payload.get("calibratedShoulderDepthTolerance", 0.045)
        ),
        "calibrated_face_depth_tolerance": float(
            payload.get("calibratedFaceDepthTolerance", 0.05)
        ),
        "calibrated_shoulder_width_lean_tolerance": float(
            payload.get("calibratedShoulderWidthLeanTolerance", 0.03)
        ),
        "calibrated_shoulder_frame_lean_tolerance": float(
            payload.get("calibratedShoulderFrameLeanTolerance", 0.045)
        ),
    }
    calibration_baseline = payload.get("calibrationBaseline") or {}

    issues = []
    issue_severity = 0
    visibility_issue = visibility_score < thresholds["minimum_visibility"]
    desk_position_issue = shoulder_width < thresholds["desk_shoulder_width"]
    camera_alignment_issue = False
    head_down_issue = False
    backward_lean_issue = False
    head_back_issue = False

    if desk_position_issue:
        issues.append("Move a little closer so your face and shoulders fill the frame.")

    camera_guidance = []
    camera_delta = {
        "faceFrame": 0.0,
        "shoulderFrame": 0.0,
        "shoulderWidth": 0.0,
        "shoulderDepth": 0.0,
        "faceDepth": 0.0,
    }
    shoulder_depth_signed_delta = 0.0
    face_depth_signed_delta = 0.0
    shoulder_width_signed_delta = 0.0
    shoulder_frame_signed_delta = 0.0
    if calibration_baseline:
        baseline_face_frame = _baseline_metric(
            calibration_baseline,
            "faceFrameOffset",
            face_frame_offset,
        )
        baseline_shoulder_frame = _baseline_metric(
            calibration_baseline,
            "shoulderFrameOffset",
            shoulder_frame_offset,
        )
        baseline_shoulder_width = _baseline_metric(
            calibration_baseline,
            "shoulderWidth",
            shoulder_width,
        )
        baseline_shoulder_depth = _baseline_metric(
            calibration_baseline,
            "shoulderDepth",
            shoulder_depth,
        )
        baseline_face_depth = _baseline_metric(
            calibration_baseline,
            "faceToShoulderDepth",
            face_to_shoulder_depth,
        )

        shoulder_depth_signed_delta = shoulder_depth - baseline_shoulder_depth
        face_depth_signed_delta = face_to_shoulder_depth - baseline_face_depth
        shoulder_width_signed_delta = shoulder_width - baseline_shoulder_width
        shoulder_frame_signed_delta = shoulder_frame_offset - baseline_shoulder_frame
        camera_delta = {
            "faceFrame": abs(face_frame_offset - baseline_face_frame),
            "shoulderFrame": abs(shoulder_frame_offset - baseline_shoulder_frame),
            "shoulderWidth": abs(shoulder_width - baseline_shoulder_width),
            "shoulderDepth": abs(shoulder_depth_signed_delta),
            "faceDepth": abs(face_depth_signed_delta),
        }

        if camera_delta["faceFrame"] > thresholds["calibrated_face_frame_tolerance"]:
            camera_alignment_issue = True
            if eye_mid["y"] < shoulder_mid["y"]:
                camera_guidance.append("Raise or lower the camera back to your calibrated eye level.")
            else:
                camera_guidance.append("Re-center the camera to your calibrated eye level.")
        if camera_delta["shoulderFrame"] > thresholds["calibrated_shoulder_frame_tolerance"]:
            camera_alignment_issue = True
            camera_guidance.append("Sit back into the same upper-body framing as calibration.")
        if shoulder_width_signed_delta < -thresholds["calibrated_shoulder_width_tolerance"]:
            desk_position_issue = True
            camera_guidance.append("Move closer so your face and shoulders fill the frame.")
        elif shoulder_width_signed_delta > thresholds["calibrated_shoulder_width_tolerance"]:
            desk_position_issue = True
            camera_guidance.append("Move slightly farther back to match your calibrated view.")

        backward_lean_issue = (
            shoulder_width_signed_delta < -thresholds["calibrated_shoulder_width_lean_tolerance"]
            and shoulder_frame_signed_delta < -thresholds["calibrated_shoulder_frame_lean_tolerance"]
            and eye_to_shoulder_drop < 0.80
        )
    else:
        if face_frame_offset > thresholds["maximum_face_frame_offset"]:
            camera_alignment_issue = True
            if eye_mid["y"] < 0.28:
                camera_guidance.append("Lower the camera a little or tilt it downward.")
            else:
                camera_guidance.append("Raise the camera closer to eye level.")
        if shoulder_frame_offset > thresholds["maximum_shoulder_frame_offset"]:
            camera_alignment_issue = True
            camera_guidance.append("Center your upper body in the frame.")
        if (
            eye_to_shoulder_drop < thresholds["minimum_eye_to_shoulder_drop"]
            or eye_to_shoulder_drop > thresholds["maximum_eye_to_shoulder_drop"]
        ):
            camera_alignment_issue = True
            camera_guidance.append("Adjust the webcam angle so it faces you more directly.")

    if shoulder_tilt > thresholds["shoulder_tilt"]:
        issues.append("Shoulders appear uneven.")
        issue_severity += 1
    if head_center_offset > thresholds["head_center_offset"]:
        issues.append("Head is drifting away from the center of your shoulders.")
        issue_severity += 1
    if neck_height_ratio < thresholds["minimum_neck_height"]:
        issues.append("Neck looks compressed. Sit a bit taller.")
        issue_severity += 1
        head_down_issue = True
    if face_balance > thresholds["maximum_face_balance"]:
        issues.append("Face is turned too far away from the screen.")
        issue_severity += 1
    if face_level_balance > thresholds["maximum_face_level_balance"]:
        issues.append("Head looks tilted to one side.")
        issue_severity += 1
    if face_height_ratio < (thresholds["minimum_face_height"] - 0.04):
        issues.append("Chin angle is making your face landmarks too compressed.")
        issue_severity += 1
        head_down_issue = True
    head_back_issue = (
        face_height_ratio < 0.20
        and eye_to_shoulder_drop > 1.05
        and neck_height_ratio >= 0.78
        and shoulder_tilt < 0.05
        and head_center_offset < 0.12
        and face_balance < 0.16
        and not visibility_issue
    )
    if not calibration_baseline:
        backward_lean_issue = (
            eye_to_shoulder_drop < 0.80
            and neck_height_ratio >= 0.76
            and shoulder_tilt < 0.05
            and head_center_offset < 0.10
            and not visibility_issue
        )
    if backward_lean_issue:
        issues.append("You appear to be leaning backward. Sit upright with your back supported.")
        issue_severity += 1
    if head_back_issue:
        issues.append("Your head is tilted backward. Keep your chin level with the screen.")
        issue_severity += 1
    if visibility_issue:
        issues.append("Face and shoulder landmarks are not clear enough.")

    # When the user bends their head down, face framing changes even though the
    # webcam may still be in the same place. In that case, prefer posture
    # feedback over camera-misalignment feedback, both before and after
    # calibration.
    body_geometry_healthy = (
        shoulder_tilt <= thresholds["shoulder_tilt"]
        and head_center_offset <= thresholds["head_center_offset"]
        and neck_height_ratio >= thresholds["minimum_neck_height"]
        and face_balance <= thresholds["maximum_face_balance"]
        and face_level_balance <= thresholds["maximum_face_level_balance"]
        and face_height_ratio >= (thresholds["minimum_face_height"] - 0.04)
        and not visibility_issue
        and issue_severity == 0
    )
    posture_geometry_healthy = (
        body_geometry_healthy
        and not desk_position_issue
    )
    strong_posture_issue = (
        shoulder_tilt > 0.10
        or head_center_offset > 0.22
        or face_balance > 0.22
        or backward_lean_issue
        or head_back_issue
        or issue_severity >= 2
    )

    if desk_position_issue and body_geometry_healthy and shoulder_width >= 0.10:
        # Do not mark a clear, balanced seated posture as out of position just
        # because the user is slightly closer/farther than calibration.
        desk_position_issue = False
        issues = [
            issue
            for issue in issues
            if "closer" not in issue.lower()
            and "farther" not in issue.lower()
            and "distance" not in issue.lower()
        ]
        camera_guidance = [
            guidance
            for guidance in camera_guidance
            if "closer" not in guidance.lower()
            and "farther" not in guidance.lower()
            and "distance" not in guidance.lower()
        ]
    elif desk_position_issue:
        camera_alignment_issue = False
        if not any("closer" in issue.lower() or "farther" in issue.lower() for issue in issues):
            issues.append("Adjust your distance so your face and shoulders fill the frame.")
    elif camera_alignment_issue and strong_posture_issue:
        # If the upper-body geometry is clearly bad, report posture feedback
        # instead of hiding it behind camera alignment.
        camera_alignment_issue = False
        camera_guidance = []
    elif camera_alignment_issue and posture_geometry_healthy:
        camera_alignment_issue = False
        camera_guidance = []

    if head_down_issue:
        camera_alignment_issue = False
        camera_guidance = []
    if backward_lean_issue:
        camera_alignment_issue = False
        camera_guidance = []
    if head_back_issue:
        camera_alignment_issue = False
        camera_guidance = []

    # Camera misalignment is no longer exposed as a live-monitor posture state.
    # Camera framing can shift because of posture movement, so keep the final
    # decision focused on visible landmarks, out-of-position, or posture quality.
    camera_alignment_issue = False
    camera_guidance = []

    score_penalties = 0
    score_penalties += min(24, max(0.0, shoulder_tilt - 0.045) * 420)
    score_penalties += min(28, max(0.0, head_center_offset - 0.10) * 125)
    score_penalties += min(20, max(0.0, thresholds["minimum_neck_height"] - neck_height_ratio) * 90)
    score_penalties += min(18, max(0.0, face_balance - 0.08) * 90)
    score_penalties += min(10, max(0.0, face_level_balance - 0.08) * 70)
    score_penalties += min(10, max(0.0, thresholds["minimum_face_height"] - face_height_ratio) * 60)
    if visibility_issue:
        score_penalties += 4
    if camera_alignment_issue:
        score_penalties += 8
    if backward_lean_issue:
        score_penalties += 24
    if head_back_issue:
        score_penalties += 24

    posture_score = max(0, round(100 - score_penalties))

    rule_based_score = posture_score
    safe_good_posture = (
        shoulder_tilt <= 0.05
        and head_center_offset <= 0.10
        and neck_height_ratio >= 0.76
        and face_balance <= 0.14
        and face_level_balance <= 0.12
        and face_height_ratio >= 0.28
        and not visibility_issue
        and not desk_position_issue
        and not camera_alignment_issue
        and not backward_lean_issue
        and not head_back_issue
    )
    borderline_good_posture = (
        shoulder_tilt <= 0.035
        and head_center_offset <= 0.07
        and neck_height_ratio >= 0.74
        and face_balance <= 0.12
        and face_level_balance <= 0.14
        and rule_based_score >= 55
        and not visibility_issue
        and not desk_position_issue
        and not camera_alignment_issue
        and not backward_lean_issue
        and not head_back_issue
    )
    ml_prediction = None
    ml_bad_probability = 0.0
    if not desk_position_issue and not visibility_issue:
        ml_prediction = _predict_posture_with_ml(landmarks, computed_metrics)
        if ml_prediction:
            ml_bad_probability = float(ml_prediction.get("badProbability", 0.0))

    if desk_position_issue:
        posture_label = "out_of_position"
    elif visibility_issue and issue_severity == 0:
        posture_label = "unclear"
    elif safe_good_posture and ml_bad_probability < 0.8:
        posture_label = "good"
        posture_score = max(85, rule_based_score)
        issues = []
    elif borderline_good_posture and ml_bad_probability < 0.65:
        posture_label = "good"
        posture_score = max(78, rule_based_score)
        issues = []
    elif ml_prediction:
        ml_good_score = round(ml_prediction["goodProbability"] * 100)

        # Keep the ML model helpful but not jumpy. Slight head turns can look
        # suspicious to the classifier, so only trust BAD when ML confidence is
        # strong and the geometry score also shows some posture weakness.
        if (
            ml_prediction["label"] == "bad"
            and ml_bad_probability >= 0.78
            and (issue_severity >= 1 or rule_based_score < 75)
        ):
            posture_label = "bad"
            posture_score = max(35, round((rule_based_score * 0.55) + (ml_good_score * 0.45)))
        elif issue_severity >= 1 and rule_based_score < 88:
            posture_label = "bad"
            posture_score = rule_based_score
        else:
            posture_label = "good"
            posture_score = max(80, round((rule_based_score * 0.7) + (ml_good_score * 0.3)))

        if posture_label == "bad" and not issues:
            issues.append("ML model detected a bad posture pattern.")
    elif posture_score < 75:
        posture_label = "bad"
    else:
        posture_label = "good"

    summary = (
        "Sit closer so the webcam sees your face and shoulders clearly."
        if posture_label == "out_of_position"
        else "Improve lighting or camera framing around your face and shoulders."
        if posture_label == "unclear"
        else "Posture needs correction."
        if posture_label == "bad"
        else "Posture looks balanced."
    )

    return {
        "ok": True,
        "data": {
            "posture": posture_label,
            "postureScore": posture_score,
            "metrics": {
                "shoulderTilt": round(shoulder_tilt, 4),
                "shoulderWidth": round(shoulder_width, 4),
                "shoulderDepth": round(shoulder_depth, 4),
                "faceToShoulderDepth": round(face_to_shoulder_depth, 4),
                "headCenterOffset": round(head_center_offset, 4),
                "neckHeightRatio": round(neck_height_ratio, 4),
                "faceBalance": round(face_balance, 4),
                "faceLevelBalance": round(face_level_balance, 4),
                "faceHeightRatio": round(face_height_ratio, 4),
                "faceFrameOffset": round(face_frame_offset, 4),
                "shoulderFrameOffset": round(shoulder_frame_offset, 4),
                "eyeToShoulderDrop": round(eye_to_shoulder_drop, 4),
                "headToShoulderDistance": round(head_to_shoulder_distance, 4),
                "visibilityScore": round(visibility_score, 4),
                "cameraDeltaFaceFrame": round(camera_delta["faceFrame"], 4),
                "cameraDeltaShoulderFrame": round(camera_delta["shoulderFrame"], 4),
                "cameraDeltaShoulderWidth": round(camera_delta["shoulderWidth"], 4),
                "cameraDeltaShoulderDepth": round(camera_delta["shoulderDepth"], 4),
                "cameraDeltaFaceDepth": round(camera_delta["faceDepth"], 4),
            },
            "thresholds": thresholds,
            "issues": issues,
            "issueSeverity": issue_severity,
            "visibilityIssue": visibility_issue,
            "deskPositionIssue": desk_position_issue,
            "cameraAlignmentIssue": camera_alignment_issue,
            "calibrationActive": bool(calibration_baseline),
            "modelUsed": "random_forest" if ml_prediction else "rule_based",
            "mlPrediction": ml_prediction,
            "summary": summary,
        },
    }
