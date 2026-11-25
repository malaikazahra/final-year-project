from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text

from config import Config
from database import bcrypt, db
from models.exercise import Exercise  # noqa: F401 — ensures table is created
from routes import admin_bp, auth_bp, monitoring_bp, posture_bp, settings_bp, user_bp, users_bp


def _ensure_settings_columns():
    inspector_rows = db.session.execute(text("PRAGMA table_info(user_settings)")).mappings().all()
    existing_columns = {row["name"] for row in inspector_rows}

    if "alert_threshold_unit" not in existing_columns:
        db.session.execute(
            text(
                "ALTER TABLE user_settings "
                "ADD COLUMN alert_threshold_unit VARCHAR(20) NOT NULL DEFAULT 'minutes'"
            )
        )
        db.session.execute(
            text(
                "UPDATE user_settings "
                "SET alert_threshold_unit = 'minutes' "
                "WHERE alert_threshold_unit IS NULL OR alert_threshold_unit = ''"
            )
        )
        db.session.commit()


EXERCISES_SEED = [
    {"name": "Upper Trapezius Stretch", "category": "Neck", "duration": "2 min", "difficulty": "Easy", "icon": "UT",
     "description": "A gentle side-bending stretch for tension between the neck and shoulder.",
     "instructions": ["Sit tall and keep both shoulders relaxed.", "Hold the chair lightly with your right hand.", "Tilt your left ear toward your left shoulder without rotating your head.", "Hold for 20 seconds without forcing the stretch.", "Repeat on the other side.", "Complete 2 rounds per side."],
     "benefits": ["Targets upper trapezius tension", "Improves neck mobility", "Encourages relaxed shoulders"]},
    {"name": "Shoulder Rolls", "category": "Shoulders", "duration": "2 min", "difficulty": "Easy", "icon": "SR",
     "description": "Gentle circular movements that relax the neck-to-shoulder area.",
     "instructions": ["Sit or stand tall with your arms relaxed.", "Lift both shoulders gently toward your ears.", "Roll them backward and down in a smooth circle.", "Repeat 10 times, then reverse direction.", "Keep the movement slow and pain-free."],
     "benefits": ["Relaxes upper trapezius", "Reduces shoulder stiffness", "Encourages movement breaks"]},
    {"name": "Wall Y Raise", "category": "Upper Back", "duration": "3 min", "difficulty": "Easy", "icon": "WY",
     "description": "A wall-supported Y movement that trains the lower trapezius.",
     "instructions": ["Stand facing a wall with your forearms resting against it.", "Keep your ribs down and shoulders away from your ears.", "Slide your arms upward into a comfortable Y shape.", "Gently draw your shoulder blades down as you move.", "Return slowly and repeat 8 to 10 times."],
     "benefits": ["Activates lower trapezius", "Improves overhead control", "Supports shoulder-blade posture"]},
    {"name": "Wall Slide", "category": "Upper Back", "duration": "3 min", "difficulty": "Easy", "icon": "WS",
     "description": "A controlled shoulder-blade exercise for lower trapezius and scapular movement.",
     "instructions": ["Stand with your back against a wall and elbows bent.", "Keep your head and ribs in a comfortable neutral position.", "Slide your arms upward while keeping shoulders relaxed.", "Pause before your shoulders begin to shrug.", "Lower slowly and repeat 8 to 12 times."],
     "benefits": ["Trains lower trapezius", "Improves scapular upward rotation", "Supports upright posture"]},
    {"name": "Scapular Squeeze", "category": "Upper Back", "duration": "2 min", "difficulty": "Easy", "icon": "SS",
     "description": "A seated shoulder-blade retraction exercise targeting the rhomboids.",
     "instructions": ["Sit tall with your arms relaxed by your sides.", "Gently draw your shoulder blades toward each other.", "Keep your shoulders down and avoid arching your lower back.", "Hold for 5 seconds, then relax.", "Repeat 10 to 12 times."],
     "benefits": ["Activates rhomboids", "Supports shoulder-blade control", "Counters rounded shoulders"]},
    {"name": "Resistance Band Row", "category": "Upper Back", "duration": "3 min", "difficulty": "Medium", "icon": "BR",
     "description": "A rowing exercise that strengthens the rhomboids and middle-back stabilizers.",
     "instructions": ["Secure a light resistance band at chest height.", "Sit or stand tall while holding one end in each hand.", "Pull your elbows backward and squeeze your shoulder blades gently.", "Do not shrug or lean backward.", "Return slowly and repeat 10 to 12 times."],
     "benefits": ["Strengthens rhomboids", "Improves scapular retraction", "Supports desk posture"]},
    {"name": "Kneeling Lat Stretch", "category": "Back", "duration": "2 min", "difficulty": "Easy", "icon": "LS",
     "description": "An overhead stretch for the latissimus dorsi along the side of the back.",
     "instructions": ["Kneel in front of a chair and place your elbows or hands on it.", "Keep your lower back neutral.", "Move your hips backward while lowering your chest gently.", "Feel the stretch along the sides of your upper back.", "Hold for 20 seconds and repeat 2 to 3 times."],
     "benefits": ["Stretches latissimus dorsi", "Improves overhead mobility", "Relieves side-back tightness"]},
    {"name": "Light Band Pulldown", "category": "Back", "duration": "3 min", "difficulty": "Medium", "icon": "LP",
     "description": "A controlled pulldown that trains the latissimus dorsi and lower scapular muscles.",
     "instructions": ["Secure a light band above head height.", "Hold the band with both hands and sit or stand tall.", "Pull your elbows down toward your sides without leaning backward.", "Keep your shoulders away from your ears.", "Return slowly and repeat 10 times."],
     "benefits": ["Strengthens latissimus dorsi", "Trains shoulder depression", "Supports upper-body control"]},
    {"name": "Chair Thoracic Extension", "category": "Back", "duration": "2 min", "difficulty": "Easy", "icon": "TE",
     "description": "A seated extension movement for the upper spinal muscles and thoracic mobility.",
     "instructions": ["Sit on a firm chair with a mid-height backrest.", "Place your hands behind your head without pulling your neck.", "Lean your upper back gently over the chair back.", "Keep your lower ribs controlled and breathe normally.", "Return and repeat 6 to 8 times."],
     "benefits": ["Mobilizes the thoracic spine", "Engages upper spinal extensors", "Counters prolonged slouching"]},
    {"name": "Bird Dog", "category": "Back", "duration": "4 min", "difficulty": "Medium", "icon": "BD",
     "description": "A stability exercise for the spinal extensors and trunk muscles.",
     "instructions": ["Begin on your hands and knees with your spine neutral.", "Extend one leg backward without rotating your hips.", "If comfortable, extend the opposite arm forward.", "Hold for 3 to 5 seconds.", "Return slowly and complete 6 to 8 repetitions per side."],
     "benefits": ["Builds spinal endurance", "Trains erector spinae control", "Improves trunk stability"]},
    {"name": "Cat-Cow Mobility", "category": "Back", "duration": "3 min", "difficulty": "Easy", "icon": "CC",
     "description": "A gentle movement through spinal flexion and extension for back mobility.",
     "instructions": ["Begin on your hands and knees.", "Slowly round your back while allowing your head to follow.", "Then gently move toward a comfortable arched position.", "Do not force either end of the movement.", "Repeat slowly 8 to 10 times."],
     "benefits": ["Improves spinal mobility", "Moves upper and lower erector spinae", "Reduces stiffness"]},
    {"name": "Seated Side-Bend Stretch", "category": "Lower Back", "duration": "2 min", "difficulty": "Easy", "icon": "SB",
     "description": "A gentle lateral stretch for the quadratus lumborum and side of the trunk.",
     "instructions": ["Sit tall with both feet flat on the floor.", "Raise your right arm overhead.", "Lean gently to the left without twisting or lifting your hip.", "Hold for 20 seconds.", "Repeat on the other side for 2 rounds."],
     "benefits": ["Stretches quadratus lumborum", "Improves side-bending mobility", "Relieves waist-level tightness"]},
    {"name": "Child's Pose Side Reach", "category": "Back", "duration": "3 min", "difficulty": "Easy", "icon": "CP",
     "description": "A side-reaching stretch for the quadratus lumborum and latissimus dorsi.",
     "instructions": ["Begin on your hands and knees and sit your hips back comfortably.", "Reach both hands forward.", "Walk your hands gently to the right to stretch the left side.", "Hold for 20 seconds, then switch sides.", "Stop if kneeling or bending causes discomfort."],
     "benefits": ["Stretches quadratus lumborum", "Lengthens latissimus dorsi", "Relieves side-back stiffness"]},
    {"name": "Wall Angels", "category": "Shoulders", "duration": "3 min", "difficulty": "Medium", "icon": "WA",
     "description": "A wall exercise for coordinated shoulder-blade movement and upright posture.",
     "instructions": ["Stand against a wall with knees slightly bent.", "Keep your ribs relaxed and elbows bent.", "Slide your arms upward only as far as you can without shrugging.", "Draw your shoulder blades gently down and back.", "Return slowly and repeat 8 times."],
     "benefits": ["Improves scapular control", "Trains lower trapezius and rhomboids", "Supports shoulder posture"]},
    {"name": "Doorway Chest Stretch", "category": "Chest", "duration": "2 min", "difficulty": "Easy", "icon": "DC",
     "description": "A chest stretch that reduces the forward pull associated with rounded shoulders.",
     "instructions": ["Place one forearm on each side of a doorway.", "Step forward gently while keeping your neck neutral.", "Stop when you feel a stretch across the chest.", "Hold for 20 seconds without forcing.", "Repeat 2 to 3 times."],
     "benefits": ["Stretches chest muscles", "Supports shoulder-blade positioning", "Counters rounded shoulders"]},
    {"name": "Chin Tucks", "category": "Neck", "duration": "2 min", "difficulty": "Easy", "icon": "CT",
     "description": "A controlled neck movement commonly used for forward-head posture.",
     "instructions": ["Sit upright and look straight ahead.", "Draw your chin straight backward without looking down.", "Keep the movement gentle and make a small double-chin shape.", "Hold for 3 seconds, then relax.", "Repeat 10 times."],
     "benefits": ["Supports neutral head position", "Trains deep neck flexors", "Complements upper-trapezius relaxation"]},
    {"name": "Supine Pelvic Tilt", "category": "Lower Back", "duration": "3 min", "difficulty": "Easy", "icon": "PT",
     "description": "A gentle lower-back control exercise performed while lying down.",
     "instructions": ["Lie on your back with your knees bent and feet flat.", "Keep your breathing relaxed.", "Gently tighten your abdominal muscles and flatten your lower back toward the floor.", "Hold for 3 to 5 seconds without holding your breath.", "Relax and repeat 10 times."],
     "benefits": ["Improves lower-spine control", "Gently moves lumbar extensors", "Supports neutral pelvic posture"]},
    {"name": "Band External Rotation", "category": "Shoulders", "duration": "3 min", "difficulty": "Easy", "icon": "ER",
     "description": "A rotator cuff strengthening exercise that directly targets the infraspinatus using a light resistance band.",
     "instructions": ["Anchor a light resistance band at elbow height.", "Stand sideways to the anchor and hold the band with your near hand.", "Keep your elbow bent at 90 degrees and tucked firmly to your side throughout.", "Rotate your forearm outward away from your body in a controlled arc.", "Hold the end position for 2 seconds, then return slowly.", "Complete 12 to 15 repetitions per side."],
     "benefits": ["Directly strengthens the infraspinatus", "Improves rotator cuff stability", "Reduces shoulder impingement risk"]},
    {"name": "Face Pull", "category": "Shoulders", "duration": "3 min", "difficulty": "Medium", "icon": "FP",
     "description": "A pulling exercise for the infraspinatus and posterior shoulder using a resistance band anchored at face height.",
     "instructions": ["Anchor a resistance band at face height and hold both ends with an overhand grip.", "Step back to create light tension in the band.", "Pull the band toward your face, flaring your elbows out to the sides.", "Aim to bring your hands level with your ears at the end of the movement.", "Squeeze the rear shoulder muscles for 2 seconds, then return slowly.", "Complete 12 repetitions."],
     "benefits": ["Targets infraspinatus and posterior shoulder", "Improves shoulder external rotation strength", "Counters rounded shoulders and forward head"]},
    {"name": "Band Pull-Apart", "category": "Shoulders", "duration": "3 min", "difficulty": "Easy", "icon": "BP",
     "description": "A standing exercise where you pull a resistance band apart horizontally to strengthen the rhomboids, middle and lower trapezius, and rear deltoids.",
     "instructions": ["Stand tall with feet shoulder-width apart.", "Hold a resistance band with both hands at chest height, arms extended in front of you.", "Keep a slight bend in your elbows and your core engaged.", "Pull the band apart by moving both arms outward to your sides until the band touches your chest.", "Squeeze your shoulder blades together at the end of the movement for 2 seconds.", "Slowly return your arms to the starting position.", "Complete 15 repetitions."],
     "benefits": ["Strengthens rhomboids and middle trapezius", "Improves posture by retracting shoulder blades", "Counters rounded shoulders"]},
    {"name": "Hip Flexor Stretch", "category": "Lower Back", "duration": "3 min", "difficulty": "Easy", "icon": "HF",
     "description": "A kneeling lunge stretch that targets the psoas and hip flexors — the primary muscles responsible for anterior pelvic tilt in sway back and lumbar lordosis.",
     "instructions": ["Kneel on your right knee with your left foot forward, left knee at 90 degrees.", "Keep your torso upright and core gently engaged.", "Shift your hips forward slowly until you feel a stretch at the front of your right hip.", "Do not arch your lower back — keep your pelvis tucked slightly under.", "Hold for 30 seconds, breathing steadily.", "Switch legs and repeat.", "Complete 2 rounds per side."],
     "benefits": ["Directly stretches the psoas and hip flexors", "Reduces anterior pelvic tilt in lumbar lordosis and sway back", "Relieves lower back compression caused by tight hip flexors"]},
]


def _seed_exercises():
    if Exercise.query.count() == 0:
        for ex in EXERCISES_SEED:
            db.session.add(Exercise(**ex))
        db.session.commit()


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        supports_credentials=True,
        resources={r"/api/*": {"origins": "*"}},
    )

    db.init_app(app)
    bcrypt.init_app(app)

    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(monitoring_bp)
    app.register_blueprint(posture_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(settings_bp)

    @app.get("/api/health")
    def health_check():
        return jsonify({"success": True, "message": "PostureGuard backend is running"})

    with app.app_context():
        db.create_all()
        _ensure_settings_columns()
        _seed_exercises()

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
