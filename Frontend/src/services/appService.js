import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:5000/api';

const STORAGE_KEYS = {
  token: 'postureGuardToken',
  user: 'postureGuardUser',
  settings: 'postureGuardSettings',
  exerciseProgress: 'postureGuardExerciseProgress',
};

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

const getStoredJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
};

const setStoredJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const emitSettingsUpdated = (settings) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('postureguard:settings-updated', {
        detail: settings,
      })
    );
  }
};

export const getStoredToken = () => localStorage.getItem(STORAGE_KEYS.token);

export const setStoredToken = (token) => {
  if (token) {
    localStorage.setItem(STORAGE_KEYS.token, token);
  } else {
    localStorage.removeItem(STORAGE_KEYS.token);
  }
};

export const getStoredUser = () => getStoredJson(STORAGE_KEYS.user, null);

export const setStoredUser = (user) => {
  if (user) {
    setStoredJson(STORAGE_KEYS.user, user);
  } else {
    localStorage.removeItem(STORAGE_KEYS.user);
  }
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const normalizeUser = (user) => ({
  id: user.id || user._id || 'demo-user',
  name: user.name || 'PostureGuard User',
  email: user.email || 'user@example.com',
  role: user.role || 'user',
  joinDate: user.joinDate || 'January 15, 2025',
  phone: user.phone || user.profile?.phone || '+92 300 1234567',
  city: user.city || user.profile?.city || 'Lahore',
  country: user.country || user.profile?.country || 'Pakistan',
});

const buildMockUser = ({ name, email }) => {
  const existing = getStoredUser();
  const role = email?.toLowerCase().includes('admin') ? 'admin' : existing?.role || 'user';

  return normalizeUser({
    id: existing?.id || 'demo-user',
    name: name || existing?.name || 'Muhammad Haseeb',
    email: email || existing?.email || 'haseeb@example.com',
    role,
    joinDate: existing?.joinDate || 'January 15, 2025',
    phone: existing?.phone || '+92 300 1234567',
    city: existing?.city || 'Lahore',
    country: existing?.country || 'Pakistan',
  });
};

const defaultSettings = {
  alertThreshold: 5,
  alertThresholdUnit: 'minutes',
  enableAlerts: true,
  alertSound: true,
  alertNotifications: true,
  theme: 'dark',
  fontSize: 'medium',
  compactMode: false,
  dataCollection: true,
  analyticsSharing: false,
  marketingEmails: false,
  emailNotifications: true,
  browserNotifications: true,
  dailyReport: true,
  weeklyReport: false,
  cameraEnabled: false,
};

const exercisesCatalog = [
  {
    id: 1,
    name: 'Upper Trapezius Stretch',
    category: 'Neck',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'A gentle side-bending stretch for tension between the neck and shoulder.',
    instructions: [
      'Sit tall and keep both shoulders relaxed.',
      'Hold the chair lightly with your right hand.',
      'Tilt your left ear toward your left shoulder without rotating your head.',
      'Hold for 20 seconds without forcing the stretch.',
      'Repeat on the other side.',
      'Complete 2 rounds per side.',
    ],
    benefits: ['Targets upper trapezius tension', 'Improves neck mobility', 'Encourages relaxed shoulders'],
    icon: 'UT',
  },
  {
    id: 2,
    name: 'Shoulder Rolls',
    category: 'Shoulders',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'Gentle circular movements that relax the neck-to-shoulder area.',
    instructions: [
      'Sit or stand tall with your arms relaxed.',
      'Lift both shoulders gently toward your ears.',
      'Roll them backward and down in a smooth circle.',
      'Repeat 10 times, then reverse direction.',
      'Keep the movement slow and pain-free.',
    ],
    benefits: ['Relaxes upper trapezius', 'Reduces shoulder stiffness', 'Encourages movement breaks'],
    icon: 'SR',
  },
  {
    id: 3,
    name: 'Wall Y Raise',
    category: 'Upper Back',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A wall-supported Y movement that trains the lower trapezius.',
    instructions: [
      'Stand facing a wall with your forearms resting against it.',
      'Keep your ribs down and shoulders away from your ears.',
      'Slide your arms upward into a comfortable Y shape.',
      'Gently draw your shoulder blades down as you move.',
      'Return slowly and repeat 8 to 10 times.',
    ],
    benefits: ['Activates lower trapezius', 'Improves overhead control', 'Supports shoulder-blade posture'],
    icon: 'WY',
  },
  {
    id: 4,
    name: 'Wall Slide',
    category: 'Upper Back',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A controlled shoulder-blade exercise for lower trapezius and scapular movement.',
    instructions: [
      'Stand with your back against a wall and elbows bent.',
      'Keep your head and ribs in a comfortable neutral position.',
      'Slide your arms upward while keeping shoulders relaxed.',
      'Pause before your shoulders begin to shrug.',
      'Lower slowly and repeat 8 to 12 times.',
    ],
    benefits: ['Trains lower trapezius', 'Improves scapular upward rotation', 'Supports upright posture'],
    icon: 'WS',
  },
  {
    id: 5,
    name: 'Scapular Squeeze',
    category: 'Upper Back',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'A seated shoulder-blade retraction exercise targeting the rhomboids.',
    instructions: [
      'Sit tall with your arms relaxed by your sides.',
      'Gently draw your shoulder blades toward each other.',
      'Keep your shoulders down and avoid arching your lower back.',
      'Hold for 5 seconds, then relax.',
      'Repeat 10 to 12 times.',
    ],
    benefits: ['Activates rhomboids', 'Supports shoulder-blade control', 'Counters rounded shoulders'],
    icon: 'SS',
  },
  {
    id: 6,
    name: 'Resistance Band Row',
    category: 'Upper Back',
    duration: '3 min',
    difficulty: 'Medium',
    description: 'A rowing exercise that strengthens the rhomboids and middle-back stabilizers.',
    instructions: [
      'Secure a light resistance band at chest height.',
      'Sit or stand tall while holding one end in each hand.',
      'Pull your elbows backward and squeeze your shoulder blades gently.',
      'Do not shrug or lean backward.',
      'Return slowly and repeat 10 to 12 times.',
    ],
    benefits: ['Strengthens rhomboids', 'Improves scapular retraction', 'Supports desk posture'],
    icon: 'BR',
  },
  {
    id: 7,
    name: 'Kneeling Lat Stretch',
    category: 'Back',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'An overhead stretch for the latissimus dorsi along the side of the back.',
    instructions: [
      'Kneel in front of a chair and place your elbows or hands on it.',
      'Keep your lower back neutral.',
      'Move your hips backward while lowering your chest gently.',
      'Feel the stretch along the sides of your upper back.',
      'Hold for 20 seconds and repeat 2 to 3 times.',
    ],
    benefits: ['Stretches latissimus dorsi', 'Improves overhead mobility', 'Relieves side-back tightness'],
    icon: 'LS',
  },
  {
    id: 8,
    name: 'Light Band Pulldown',
    category: 'Back',
    duration: '3 min',
    difficulty: 'Medium',
    description: 'A controlled pulldown that trains the latissimus dorsi and lower scapular muscles.',
    instructions: [
      'Secure a light band above head height.',
      'Hold the band with both hands and sit or stand tall.',
      'Pull your elbows down toward your sides without leaning backward.',
      'Keep your shoulders away from your ears.',
      'Return slowly and repeat 10 times.',
    ],
    benefits: ['Strengthens latissimus dorsi', 'Trains shoulder depression', 'Supports upper-body control'],
    icon: 'LP',
  },
  {
    id: 9,
    name: 'Chair Thoracic Extension',
    category: 'Back',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'A seated extension movement for the upper spinal muscles and thoracic mobility.',
    instructions: [
      'Sit on a firm chair with a mid-height backrest.',
      'Place your hands behind your head without pulling your neck.',
      'Lean your upper back gently over the chair back.',
      'Keep your lower ribs controlled and breathe normally.',
      'Return and repeat 6 to 8 times.',
    ],
    benefits: ['Mobilizes the thoracic spine', 'Engages upper spinal extensors', 'Counters prolonged slouching'],
    icon: 'TE',
  },
  {
    id: 10,
    name: 'Bird Dog',
    category: 'Back',
    duration: '4 min',
    difficulty: 'Medium',
    description: 'A stability exercise for the spinal extensors and trunk muscles.',
    instructions: [
      'Begin on your hands and knees with your spine neutral.',
      'Extend one leg backward without rotating your hips.',
      'If comfortable, extend the opposite arm forward.',
      'Hold for 3 to 5 seconds.',
      'Return slowly and complete 6 to 8 repetitions per side.',
    ],
    benefits: ['Builds spinal endurance', 'Trains erector spinae control', 'Improves trunk stability'],
    icon: 'BD',
  },
  {
    id: 11,
    name: 'Cat-Cow Mobility',
    category: 'Back',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A gentle movement through spinal flexion and extension for back mobility.',
    instructions: [
      'Begin on your hands and knees.',
      'Slowly round your back while allowing your head to follow.',
      'Then gently move toward a comfortable arched position.',
      'Do not force either end of the movement.',
      'Repeat slowly 8 to 10 times.',
    ],
    benefits: ['Improves spinal mobility', 'Moves upper and lower erector spinae', 'Reduces stiffness'],
    icon: 'CC',
  },
  {
    id: 12,
    name: 'Seated Side-Bend Stretch',
    category: 'Lower Back',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'A gentle lateral stretch for the quadratus lumborum and side of the trunk.',
    instructions: [
      'Sit tall with both feet flat on the floor.',
      'Raise your right arm overhead.',
      'Lean gently to the left without twisting or lifting your hip.',
      'Hold for 20 seconds.',
      'Repeat on the other side for 2 rounds.',
    ],
    benefits: ['Stretches quadratus lumborum', 'Improves side-bending mobility', 'Relieves waist-level tightness'],
    icon: 'SB',
  },
  {
    id: 13,
    name: "Child's Pose Side Reach",
    category: 'Back',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A side-reaching stretch for the quadratus lumborum and latissimus dorsi.',
    instructions: [
      'Begin on your hands and knees and sit your hips back comfortably.',
      'Reach both hands forward.',
      'Walk your hands gently to the right to stretch the left side.',
      'Hold for 20 seconds, then switch sides.',
      'Stop if kneeling or bending causes discomfort.',
    ],
    benefits: ['Stretches quadratus lumborum', 'Lengthens latissimus dorsi', 'Relieves side-back stiffness'],
    icon: 'CP',
  },
  {
    id: 14,
    name: 'Wall Angels',
    category: 'Shoulders',
    duration: '3 min',
    difficulty: 'Medium',
    description: 'A wall exercise for coordinated shoulder-blade movement and upright posture.',
    instructions: [
      'Stand against a wall with knees slightly bent.',
      'Keep your ribs relaxed and elbows bent.',
      'Slide your arms upward only as far as you can without shrugging.',
      'Draw your shoulder blades gently down and back.',
      'Return slowly and repeat 8 times.',
    ],
    benefits: ['Improves scapular control', 'Trains lower trapezius and rhomboids', 'Supports shoulder posture'],
    icon: 'WA',
  },
  {
    id: 15,
    name: 'Doorway Chest Stretch',
    category: 'Chest',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'A chest stretch that reduces the forward pull associated with rounded shoulders.',
    instructions: [
      'Place one forearm on each side of a doorway.',
      'Step forward gently while keeping your neck neutral.',
      'Stop when you feel a stretch across the chest.',
      'Hold for 20 seconds without forcing.',
      'Repeat 2 to 3 times.',
    ],
    benefits: ['Stretches chest muscles', 'Supports shoulder-blade positioning', 'Counters rounded shoulders'],
    icon: 'DC',
  },
  {
    id: 16,
    name: 'Chin Tucks',
    category: 'Neck',
    duration: '2 min',
    difficulty: 'Easy',
    description: 'A controlled neck movement commonly used for forward-head posture.',
    instructions: [
      'Sit upright and look straight ahead.',
      'Draw your chin straight backward without looking down.',
      'Keep the movement gentle and make a small double-chin shape.',
      'Hold for 3 seconds, then relax.',
      'Repeat 10 times.',
    ],
    benefits: ['Supports neutral head position', 'Trains deep neck flexors', 'Complements upper-trapezius relaxation'],
    icon: 'CT',
  },
  {
    id: 17,
    name: 'Supine Pelvic Tilt',
    category: 'Lower Back',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A gentle lower-back control exercise performed while lying down.',
    instructions: [
      'Lie on your back with your knees bent and feet flat.',
      'Keep your breathing relaxed.',
      'Gently tighten your abdominal muscles and flatten your lower back toward the floor.',
      'Hold for 3 to 5 seconds without holding your breath.',
      'Relax and repeat 10 times.',
    ],
    benefits: ['Improves lower-spine control', 'Gently moves lumbar extensors', 'Supports neutral pelvic posture'],
    icon: 'PT',
  },
  {
    id: 18,
    name: 'Band External Rotation',
    category: 'Shoulders',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A rotator cuff strengthening exercise that directly targets the infraspinatus using a light resistance band.',
    instructions: [
      'Anchor a light resistance band at elbow height.',
      'Stand sideways to the anchor and hold the band with your near hand.',
      'Keep your elbow bent at 90 degrees and tucked firmly to your side throughout.',
      'Rotate your forearm outward away from your body in a controlled arc.',
      'Hold the end position for 2 seconds, then return slowly.',
      'Complete 12 to 15 repetitions per side.',
    ],
    benefits: ['Directly strengthens the infraspinatus', 'Improves rotator cuff stability', 'Reduces shoulder impingement risk'],
    icon: 'ER',
  },
  {
    id: 19,
    name: 'Face Pull',
    category: 'Shoulders',
    duration: '3 min',
    difficulty: 'Medium',
    description: 'A pulling exercise for the infraspinatus and posterior shoulder using a resistance band anchored at face height.',
    instructions: [
      'Anchor a resistance band at face height and hold both ends with an overhand grip.',
      'Step back to create light tension in the band.',
      'Pull the band toward your face, flaring your elbows out to the sides.',
      'Aim to bring your hands level with your ears at the end of the movement.',
      'Squeeze the rear shoulder muscles for 2 seconds, then return slowly.',
      'Complete 12 repetitions.',
    ],
    benefits: ['Targets infraspinatus and posterior shoulder', 'Improves shoulder external rotation strength', 'Counters rounded shoulders and forward head'],
    icon: 'FP',
  },
  {
    id: 20,
    name: 'Band Pull-Apart',
    category: 'Shoulders',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A standing exercise where you pull a resistance band apart horizontally to strengthen the rhomboids, middle and lower trapezius, and rear deltoids.',
    instructions: [
      'Stand tall with feet shoulder-width apart.',
      'Hold a resistance band with both hands at chest height, arms extended in front of you.',
      'Keep a slight bend in your elbows and your core engaged.',
      'Pull the band apart by moving both arms outward to your sides until the band touches your chest.',
      'Squeeze your shoulder blades together at the end of the movement for 2 seconds.',
      'Slowly return your arms to the starting position.',
      'Complete 15 repetitions.',
    ],
    benefits: ['Strengthens rhomboids and middle trapezius', 'Improves posture by retracting shoulder blades', 'Counters rounded shoulders'],
    icon: 'BP',
  },
  {
    id: 21,
    name: 'Hip Flexor Stretch',
    category: 'Lower Back',
    duration: '3 min',
    difficulty: 'Easy',
    description: 'A kneeling lunge stretch that targets the psoas and hip flexors — the primary muscles responsible for anterior pelvic tilt in sway back and lumbar lordosis.',
    instructions: [
      'Kneel on your right knee with your left foot forward, left knee at 90 degrees.',
      'Keep your torso upright and core gently engaged.',
      'Shift your hips forward slowly until you feel a stretch at the front of your right hip.',
      'Do not arch your lower back — keep your pelvis tucked slightly under.',
      'Hold for 30 seconds, breathing steadily.',
      'Switch legs and repeat.',
      'Complete 2 rounds per side.',
    ],
    benefits: [
      'Directly stretches the psoas and hip flexors',
      'Reduces anterior pelvic tilt in lumbar lordosis and sway back',
      'Relieves lower back compression caused by tight hip flexors',
    ],
    icon: 'HF',
  },
];

const fallbackDashboardData = {
  postureData: {
    currentPosture: 'good',
    goodPostureTime: 1245,
    badPostureTime: 340,
    unclearTime: 45,
    cameraMisalignedTime: 20,
    outOfPositionTime: 0,
    postureScore: 78,
    totalSessions: 5,
    alertCount: 3,
    totalDuration: 1650,
    status: 'completed',
  },
  summary: {
    totalSessions: 5,
    activeSessions: 0,
    totalMonitoredSeconds: 8120,
    totalGoodSeconds: 5920,
    totalBadSeconds: 1800,
    alertCount: 7,
    averageScore: 76,
    latestCompletedScore: 78,
  },
  recentSessions: [
    {
      id: 1,
      status: 'completed',
      date: 'May 03',
      duration: '27m 30s',
      durationSeconds: 1650,
      goodTime: '20m 45s',
      goodTimeSeconds: 1245,
      badTime: '5m 40s',
      badTimeSeconds: 340,
      score: 78,
    },
    {
      id: 2,
      status: 'completed',
      date: 'May 02',
      duration: '24m 10s',
      durationSeconds: 1450,
      goodTime: '18m 20s',
      goodTimeSeconds: 1100,
      badTime: '4m 30s',
      badTimeSeconds: 270,
      score: 74,
    },
  ],
  alerts: [
    { id: 1, type: 'warning', message: 'Straighten your back.' },
    { id: 2, type: 'info', message: 'Remember to take a short break in 2 minutes.' },
  ],
  tips: [
    { id: 1, title: 'Adjust Your Chair', text: 'Keep feet flat on the floor and knees at 90 degrees.' },
    { id: 2, title: 'Screen Level', text: 'Keep your eyes level with the top of the monitor.' },
    { id: 3, title: 'Relax Shoulders', text: 'Keep shoulders down and away from your ears.' },
  ],
};

const fallbackAnalyticsData = {
  week: {
    summary: {
      sessionCount: 7,
      averageScore: 73,
      averageGood: 73,
      averageBad: 27,
      bestScore: 82,
      lowestScore: 65,
      totalMonitoredSeconds: 12420,
      alertCount: 8,
    },
    chartData: [
      { label: 'Mon', good: 65, bad: 35, score: 65 },
      { label: 'Tue', good: 72, bad: 28, score: 72 },
      { label: 'Wed', good: 68, bad: 32, score: 68 },
      { label: 'Thu', good: 78, bad: 22, score: 78 },
      { label: 'Fri', good: 82, bad: 18, score: 82 },
      { label: 'Sat', good: 75, bad: 25, score: 75 },
      { label: 'Sun', good: 70, bad: 30, score: 70 },
    ],
    sessions: [
      { id: 1, date: 'Today', duration: '45 min', goodTime: '35 min', badTime: '10 min', score: 78 },
      { id: 2, date: 'Yesterday', duration: '52 min', goodTime: '38 min', badTime: '14 min', score: 73 },
      { id: 3, date: '2 days ago', duration: '48 min', goodTime: '36 min', badTime: '12 min', score: 75 },
    ],
    insights: [
      { id: 1, title: 'Progress Trend', text: 'Your posture score improved by 12% over the last week.' },
      { id: 2, title: 'Best Time', text: 'You maintain your best posture between 9 AM and 11 AM.' },
      { id: 3, title: 'Recommendation', text: 'Take a 5-minute break every hour to stretch and reset posture.' },
    ],
  },
  month: {
    summary: {
      sessionCount: 18,
      averageScore: 73,
      averageGood: 73,
      averageBad: 27,
      bestScore: 79,
      lowestScore: 68,
      totalMonitoredSeconds: 45240,
      alertCount: 19,
    },
    chartData: [
      { label: 'Week 1', good: 68, bad: 32, score: 68 },
      { label: 'Week 2', good: 72, bad: 28, score: 72 },
      { label: 'Week 3', good: 75, bad: 25, score: 75 },
      { label: 'Week 4', good: 79, bad: 21, score: 79 },
    ],
    sessions: [
      { id: 4, date: 'Week 1', duration: '3 hr 20 min', goodTime: '2 hr 20 min', badTime: '1 hr', score: 68 },
      { id: 5, date: 'Week 2', duration: '3 hr 45 min', goodTime: '2 hr 42 min', badTime: '1 hr 3 min', score: 72 },
      { id: 6, date: 'Week 3', duration: '4 hr 5 min', goodTime: '3 hr 3 min', badTime: '1 hr 2 min', score: 75 },
    ],
    insights: [
      { id: 1, title: 'Monthly Trend', text: 'Your month-over-month posture score is steadily improving.' },
      { id: 2, title: 'Consistency', text: 'Longer sessions are becoming more stable with fewer posture drops.' },
      { id: 3, title: 'Recommendation', text: 'Keep your current break schedule and add a short stretch routine after lunch.' },
    ],
  },
};

const fallbackAdminData = {
  stats: {
    totalUsers: 24,
    activeUsers: 18,
    totalSessions: 312,
    totalMonitoredHours: 847,
    avgPostureScore: 73,
    totalAlerts: 156,
  },
  recentSessions: [
    { id: 1, userName: 'Sara Ahmed', userEmail: 'sara@example.com', duration: '1 hr 20 min', score: 81, goodPct: 74, badPct: 26, date: '2026-06-23' },
    { id: 2, userName: 'Ali Hassan', userEmail: 'ali@example.com', duration: '2 hr 5 min', score: 68, goodPct: 58, badPct: 42, date: '2026-06-23' },
    { id: 3, userName: 'Fatima Malik', userEmail: 'fatima@example.com', duration: '45 min', score: 90, goodPct: 89, badPct: 11, date: '2026-06-22' },
    { id: 4, userName: 'Usman Khan', userEmail: 'usman@example.com', duration: '3 hr 10 min', score: 62, goodPct: 51, badPct: 49, date: '2026-06-22' },
    { id: 5, userName: 'Zara Siddiqui', userEmail: 'zara@example.com', duration: '1 hr 50 min', score: 77, goodPct: 70, badPct: 30, date: '2026-06-21' },
  ],
};

const fallbackAdminUsers = [
  { id: 1, name: 'Sara Ahmed', email: 'sara@example.com', role: 'user', is_active: true, created_at: '2026-05-10', sessions: 18, avgScore: 81 },
  { id: 2, name: 'Ali Hassan', email: 'ali@example.com', role: 'user', is_active: true, created_at: '2026-05-14', sessions: 24, avgScore: 68 },
  { id: 3, name: 'Fatima Malik', email: 'fatima@example.com', role: 'user', is_active: true, created_at: '2026-05-20', sessions: 11, avgScore: 90 },
  { id: 4, name: 'Usman Khan', email: 'usman@example.com', role: 'user', is_active: false, created_at: '2026-05-22', sessions: 6, avgScore: 62 },
  { id: 5, name: 'Zara Siddiqui', email: 'zara@example.com', role: 'user', is_active: true, created_at: '2026-06-01', sessions: 30, avgScore: 77 },
  { id: 6, name: 'Bilal Chaudhry', email: 'bilal@example.com', role: 'user', is_active: true, created_at: '2026-06-03', sessions: 9, avgScore: 85 },
  { id: 7, name: 'Ayesha Raza', email: 'ayesha@example.com', role: 'user', is_active: false, created_at: '2026-06-07', sessions: 3, avgScore: 55 },
  { id: 8, name: 'Admin User', email: 'admin@postureguard.com', role: 'admin', is_active: true, created_at: '2026-05-01', sessions: 0, avgScore: 0 },
];

const tryApi = async (callback, fallback) => {
  try {
    return await callback();
  } catch (error) {
    if (fallback) {
      return fallback(error);
    }
    throw error;
  }
};

const isNetworkError = (error) =>
  !error?.response &&
  (error?.code === 'ERR_NETWORK' ||
    error?.code === 'ECONNABORTED' ||
    error?.message?.toLowerCase().includes('network'));

export const authService = {
  async login(payload) {
    try {
      const response = await api.post('/auth/login', payload);
      const user = normalizeUser(response.data.data.user);
      const token = response.data.data.token;
      setStoredToken(token);
      setStoredUser(user);
      return { user, token, isFallback: false };
    } catch (error) {
      if (isNetworkError(error)) {
        throw new Error('Backend is not reachable. Make sure the Flask server is running.');
      }
      throw error;
    }
  },

  async register(payload) {
    try {
      const response = await api.post('/auth/register', payload);
      const user = normalizeUser(response.data.data.user);
      const token = response.data.data.token;
      setStoredToken(token);
      setStoredUser(user);
      return { user, token, isFallback: false };
    } catch (error) {
      if (isNetworkError(error)) {
        throw new Error('Backend is not reachable. Make sure the Flask server is running.');
      }
      throw error;
    }
  },

  async getCurrentUser() {
    const storedUser = getStoredUser();
    const token = getStoredToken();

    if (!token) {
      return null;
    }

    return tryApi(
      async () => {
        const response = await api.get('/auth/me', { headers: getAuthHeaders() });
        const user = normalizeUser(response.data.data);
        setStoredUser(user);
        return user;
      },
      async () => {
        await wait(150);
        return storedUser;
      }
    );
  },

  async logout() {
    await tryApi(
      async () => {
        await api.post('/auth/logout', {}, { headers: getAuthHeaders() });
      },
      async () => {
        await wait(100);
      }
    );
    setStoredToken(null);
    setStoredUser(null);
  },

  async forgotPassword(email) {
    try {
      const response = await api.post('/auth/forgot-password', { email }, { timeout: 8000 });
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        throw new Error('Backend is not reachable. Make sure the Flask server is running.');
      }
      throw error;
    }
  },

  async resetPassword(payload) {
    try {
      const response = await api.post('/auth/reset-password', payload, { timeout: 30000 });
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        throw new Error('Backend is not reachable. Make sure the Flask server is running.');
      }
      throw error;
    }
  },
};

export const appService = {
  getPostureModelUrl() {
    return `${API_BASE_URL}/posture/model`;
  },

  async analyzePosture(payload) {
    const response = await api.post('/posture/analyze', payload, {
      headers: getAuthHeaders(),
      timeout: 15000,
    });
    return response.data.data;
  },

  async startMonitoringSession() {
    const response = await api.post('/monitoring/sessions', {}, { headers: getAuthHeaders() });
    return response.data.data;
  },

  async recordMonitoringEvent(sessionId, payload) {
    const response = await api.post(`/monitoring/sessions/${sessionId}/events`, payload, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  async stopMonitoringSession(sessionId) {
    const response = await api.post(`/monitoring/sessions/${sessionId}/stop`, {}, {
      headers: getAuthHeaders(),
    });
    return response.data.data;
  },

  async getDashboardData() {
    return tryApi(
      async () => {
        const response = await api.get('/monitoring/dashboard', { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait();
        return fallbackDashboardData;
      }
    );
  },

  async getAnalyticsData(range) {
    return tryApi(
      async () => {
        const response = await api.get('/monitoring/analytics', {
          headers: getAuthHeaders(),
          params: { range },
        });
        return response.data.data;
      },
      async () => {
        await wait();
        return fallbackAnalyticsData[range] || fallbackAnalyticsData.week;
      }
    );
  },

  async getProfile() {
    return tryApi(
      async () => {
        const response = await api.get('/users/me', { headers: getAuthHeaders() });
        const user = normalizeUser(response.data.data);
        setStoredUser(user);
        return user;
      },
      async () => {
        await wait();
        return getStoredUser() || buildMockUser({});
      }
    );
  },

  async updateProfile(payload) {
    return tryApi(
      async () => {
        const response = await api.put('/user/profile', payload, {
          headers: getAuthHeaders(),
        });
        const user = normalizeUser(response.data.data);
        setStoredUser(user);
        return user;
      },
      async () => {
        await wait();
        const updated = normalizeUser({ ...(getStoredUser() || buildMockUser({})), ...payload });
        setStoredUser(updated);
        return updated;
      }
    );
  },

  async getSettings() {
    return tryApi(
      async () => {
        const response = await api.get('/settings/me', { headers: getAuthHeaders() });
        const next = {
          ...defaultSettings,
          ...getStoredJson(STORAGE_KEYS.settings, {}),
          ...response.data.data,
        };
        setStoredJson(STORAGE_KEYS.settings, next);
        emitSettingsUpdated(next);
        return next;
      },
      async () => {
        await wait(150);
        const next = { ...defaultSettings, ...getStoredJson(STORAGE_KEYS.settings, {}) };
        emitSettingsUpdated(next);
        return next;
      }
    );
  },

  async updateSettings(payload) {
    return tryApi(
      async () => {
        const response = await api.put('/settings/me', payload, {
          headers: getAuthHeaders(),
        });
        const next = {
          ...defaultSettings,
          ...getStoredJson(STORAGE_KEYS.settings, {}),
          ...payload,
          ...response.data.data,
        };
        setStoredJson(STORAGE_KEYS.settings, next);
        emitSettingsUpdated(next);
        return next;
      },
      async () => {
        await wait(150);
        const next = { ...defaultSettings, ...getStoredJson(STORAGE_KEYS.settings, {}), ...payload };
        setStoredJson(STORAGE_KEYS.settings, next);
        emitSettingsUpdated(next);
        return next;
      }
    );
  },

  async getExercises() {
    return tryApi(
      async () => {
        const response = await api.get('/exercises', { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait();
        const completedIds = getStoredJson(STORAGE_KEYS.exerciseProgress, []);
        return {
          exercises: exercisesCatalog,
          completedIds,
        };
      }
    );
  },

  async updateExerciseProgress(exerciseId, completed) {
    return tryApi(
      async () => {
        const response = await api.post(
          `/exercises/${exerciseId}/complete`,
          { completed },
          { headers: getAuthHeaders() }
        );
        return response.data.data;
      },
      async () => {
        await wait(100);
        const stored = getStoredJson(STORAGE_KEYS.exerciseProgress, []);
        const next = completed ? [...new Set([...stored, exerciseId])] : stored.filter((id) => id !== exerciseId);
        setStoredJson(STORAGE_KEYS.exerciseProgress, next);
        return { completedIds: next };
      }
    );
  },

  async getAdminData() {
    return tryApi(
      async () => {
        const response = await api.get('/admin/overview', { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait();
        return fallbackAdminData;
      }
    );
  },

  async getAdminUsers() {
    return tryApi(
      async () => {
        const response = await api.get('/admin/users', { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait();
        return fallbackAdminUsers;
      }
    );
  },

  async updateUserStatus(userId, isActive) {
    return tryApi(
      async () => {
        const response = await api.patch(`/admin/users/${userId}/status`, { is_active: isActive }, { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait(400);
        return { id: userId, is_active: isActive };
      }
    );
  },

  async updateUserRole(userId, role) {
    return tryApi(
      async () => {
        const response = await api.patch(`/admin/users/${userId}/role`, { role }, { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait(400);
        return { id: userId, role };
      }
    );
  },

  async deleteAdminUser(userId) {
    return tryApi(
      async () => {
        await api.delete(`/admin/users/${userId}`, { headers: getAuthHeaders() });
        return { id: userId };
      },
      async () => {
        await wait(400);
        return { id: userId };
      }
    );
  },

  async getAdminExercises() {
    return tryApi(
      async () => {
        const response = await api.get('/admin/exercises', { headers: getAuthHeaders() });
        const data = response.data.data;
        // if backend table is empty fall back to bundled catalog
        if (!data || data.length === 0) {
          return exercisesCatalog.map((e) => ({ ...e, is_active: true, created_at: '2026-05-01' }));
        }
        return data;
      },
      async () => {
        await wait();
        return exercisesCatalog.map((e) => ({ ...e, is_active: true, created_at: '2026-05-01' }));
      }
    );
  },

  async createAdminExercise(payload) {
    return tryApi(
      async () => {
        const response = await api.post('/admin/exercises', payload, { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait(400);
        const newEx = { ...payload, id: Date.now(), is_active: true, created_at: new Date().toISOString().slice(0, 10) };
        return newEx;
      }
    );
  },

  async updateAdminExercise(exerciseId, payload) {
    return tryApi(
      async () => {
        const response = await api.put(`/admin/exercises/${exerciseId}`, payload, { headers: getAuthHeaders() });
        return response.data.data;
      },
      async () => {
        await wait(400);
        return { id: exerciseId, ...payload };
      }
    );
  },

  async deleteAdminExercise(exerciseId) {
    return tryApi(
      async () => {
        await api.delete(`/admin/exercises/${exerciseId}`, { headers: getAuthHeaders() });
        return { id: exerciseId };
      },
      async () => {
        await wait(400);
        return { id: exerciseId };
      }
    );
  },
};
