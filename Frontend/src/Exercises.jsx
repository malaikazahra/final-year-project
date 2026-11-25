import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, ErrorState, PageLoader } from './components/StateBlocks';
import { useMonitoring } from './monitoring/MonitoringContext';
import { appService } from './services/appService';

const painRegions = [
  {
    id: 'upper_trapezius',
    label: 'Upper Trapezius',
    description: 'Tension around the neck-to-shoulder area, often linked with head-forward desk posture.',
    tags: ['upper_trapezius', 'neck', 'head', 'shoulders', 'upper_back'],
    positionClass: 'pain-point-upper-trapezius',
  },
  {
    id: 'lower_trapezius',
    label: 'Lower Trapezius',
    description: 'Discomfort below the shoulder blades where posture support muscles fatigue.',
    tags: ['lower_trapezius', 'upper_back', 'mid_back', 'shoulders'],
    positionClass: 'pain-point-lower-trapezius',
  },
  {
    id: 'rhomboids',
    label: 'Rhomboids',
    description: 'Pain between the shoulder blades, commonly related to rounded shoulders.',
    tags: ['rhomboids', 'shoulders', 'upper_back'],
    positionClass: 'pain-point-rhomboids',
  },
  {
    id: 'latissimus_dorsi',
    label: 'Latissimus Dorsi',
    description: 'Side-back tightness that can affect shoulder movement and desk posture comfort.',
    tags: ['latissimus_dorsi', 'upper_back', 'mid_back', 'shoulders'],
    positionClass: 'pain-point-latissimus-dorsi',
  },
  {
    id: 'erector_spinae_upper',
    label: 'Erector Spinae Upper',
    description: 'Tension along the upper spine from holding the torso upright for long sessions.',
    tags: ['erector_spinae_upper', 'mid_back', 'spine'],
    positionClass: 'pain-point-erector-upper',
  },
  {
    id: 'erector_spinae_lower',
    label: 'Erector Spinae Lower',
    description: 'Lower spinal muscle fatigue from long sitting or unsupported posture.',
    tags: ['erector_spinae_lower', 'lower_back', 'spine'],
    positionClass: 'pain-point-erector-lower',
  },
  {
    id: 'quadratus_lumborum',
    label: 'Quadratus Lumborum / Lower Back',
    description: 'Deep lower-back discomfort, often felt near the waist and lumbar area.',
    tags: ['quadratus_lumborum', 'lower_back', 'spine'],
    positionClass: 'pain-point-quadratus-lumborum',
  },
  {
    id: 'shoulder_blade_area',
    label: 'Shoulder Blade Area',
    description: 'Pain around the scapula, common with uneven shoulders or prolonged mouse use.',
    tags: ['shoulder_blade_area', 'shoulders', 'upper_back'],
    positionClass: 'pain-point-shoulder-blade',
  },
  {
    id: 'infraspinatus',
    label: 'Infraspinatus',
    description: 'Rotator-cuff area on the back of the shoulder blade, often irritated by rounded shoulders or mouse use.',
    tags: ['infraspinatus', 'shoulder_blade_area', 'shoulders', 'upper_back'],
    positionClass: 'pain-point-infraspinatus',
  },
];

const inferPainRegionFromClick = (xRatio, yRatio) => {
  const distanceFromSpine = Math.abs(xRatio - 0.5);

  if (yRatio < 0.25) {
    return 'upper_trapezius';
  }

  if (yRatio >= 0.39 && yRatio < 0.49 && distanceFromSpine > 0.12 && distanceFromSpine < 0.21) {
    return 'infraspinatus';
  }

  if (yRatio < 0.4) {
    if (distanceFromSpine > 0.16) {
      return 'shoulder_blade_area';
    }
    return 'rhomboids';
  }

  if (yRatio < 0.58) {
    if (distanceFromSpine > 0.12 && distanceFromSpine < 0.21 && yRatio >= 0.39 && yRatio < 0.49) {
      return 'infraspinatus';
    }

    if (distanceFromSpine > 0.12) {
      return 'latissimus_dorsi';
    }
    return 'lower_trapezius';
  }

  if (yRatio < 0.7) {
    if (distanceFromSpine > 0.22) {
      return 'quadratus_lumborum';
    }
    return 'erector_spinae_upper';
  }

  if (distanceFromSpine > 0.14) {
    return 'quadratus_lumborum';
  }

  return 'erector_spinae_lower';
};

const getBackBoundaryForY = (yRatio) => {
  const y = Math.min(0.78, Math.max(0.12, yRatio));

  if (y < 0.24) {
    return { center: 0.5, halfWidth: 0.14 };
  }

  if (y < 0.36) {
    const progress = (y - 0.24) / 0.12;
    return { center: 0.5, halfWidth: 0.14 + progress * 0.22 };
  }

  if (y < 0.52) {
    return { center: 0.5, halfWidth: 0.36 };
  }

  if (y < 0.68) {
    const progress = (y - 0.52) / 0.16;
    return { center: 0.5, halfWidth: 0.36 - progress * 0.14 };
  }

  const progress = (y - 0.68) / 0.1;
  return { center: 0.5, halfWidth: 0.22 - Math.max(0, progress) * 0.05 };
};

const clampPainPointToBack = (xRatio, yRatio) => {
  const y = Math.min(0.78, Math.max(0.12, yRatio));
  const { center, halfWidth } = getBackBoundaryForY(y);
  const x = Math.min(center + halfWidth, Math.max(center - halfWidth, xRatio));

  return { x, y };
};

const postureTypes = [
  {
    id: 'sway_back',
    label: 'Sway Back',
    description: 'The hips shift forward and the upper body leans backward, creating a lazy standing or seated alignment.',
    tags: ['lower_back', 'spine', 'posture'],
    imageUrl: '/posture-types/sway-back.png',
    sourceLabel: 'Local posture reference',
    sourceUrl: '#',
  },
  {
    id: 'lumbar_lordosis',
    label: 'Lumbar Lordosis',
    description: 'The lower back arches too much, often with the pelvis tipping forward during prolonged desk work.',
    tags: ['lower_back', 'spine', 'posture'],
    imageUrl: '/posture-types/lumbar-lordosis.png',
    sourceLabel: 'Local posture reference',
    sourceUrl: '#',
  },
  {
    id: 'thoracic_kyphosis',
    label: 'Thoracic Kyphosis',
    description: 'The upper back rounds forward too much, creating a hunched posture through the chest and shoulders.',
    tags: ['upper_back', 'mid_back', 'spine', 'shoulders', 'posture'],
    imageUrl: '/posture-types/thoracic-kyphosis.png',
    sourceLabel: 'Local posture reference',
    sourceUrl: '#',
  },
  {
    id: 'forward_head',
    label: 'Forward Head',
    description: 'The head moves in front of the shoulders, which is common during long laptop or monitor use.',
    tags: ['forward_head', 'neck', 'head'],
    imageUrl: '/posture-types/forward-head.png',
    sourceLabel: 'Local posture reference',
    sourceUrl: '#',
  },
];

const exerciseTags = {
  1:  ['upper_trapezius', 'shoulders', 'upper_back'],
  2:  ['upper_trapezius', 'neck', 'head', 'forward_head', 'shoulders'],
  3:  ['lower_trapezius', 'shoulder_blade_area', 'shoulders', 'upper_back', 'posture'],
  4:  ['lower_trapezius', 'shoulder_blade_area', 'shoulders', 'upper_back'],
  5:  ['rhomboids', 'shoulder_blade_area', 'shoulders', 'upper_back', 'posture'],
  6:  ['rhomboids', 'shoulder_blade_area', 'shoulders', 'upper_back'],
  7:  ['latissimus_dorsi', 'shoulders', 'upper_back', 'mid_back'],
  8:  ['latissimus_dorsi', 'lower_trapezius', 'shoulders', 'upper_back'],
  9:  ['erector_spinae_upper', 'mid_back', 'spine', 'posture'],
  10: ['erector_spinae_upper', 'erector_spinae_lower', 'mid_back', 'lower_back', 'spine'],
  11: ['erector_spinae_upper', 'erector_spinae_lower', 'mid_back', 'lower_back', 'spine'],
  12: ['quadratus_lumborum', 'lower_back', 'spine'],
  13: ['quadratus_lumborum', 'latissimus_dorsi', 'lower_back', 'mid_back'],
  14: ['shoulder_blade_area', 'lower_trapezius', 'rhomboids', 'shoulders', 'upper_back', 'forward_head', 'posture'],
  15: ['shoulder_blade_area', 'chest', 'shoulders', 'upper_back', 'forward_head', 'posture'],
  16: ['neck', 'head', 'upper_trapezius', 'upper_back', 'forward_head', 'posture'],
  17: ['erector_spinae_lower', 'lower_back', 'spine', 'posture'],
  18: ['infraspinatus', 'shoulders', 'upper_back'],
  19: ['infraspinatus', 'shoulder_blade_area', 'shoulders', 'upper_back', 'forward_head'],
  20: ['rhomboids', 'lower_trapezius', 'shoulder_blade_area', 'shoulders', 'upper_back', 'posture'],
  21: ['hip_flexors', 'lower_back', 'spine', 'posture'],
};

const muscleExercisePriority = {
  upper_trapezius: [1, 2, 16],
  lower_trapezius: [3, 4, 14, 8, 20],
  rhomboids: [5, 6, 14, 20],
  latissimus_dorsi: [8, 7, 13],
  erector_spinae_upper: [10, 9, 11],
  erector_spinae_lower: [10, 17, 11],
  quadratus_lumborum: [12, 13],
  shoulder_blade_area: [14, 5, 6, 20, 4, 3, 15],
  infraspinatus: [18, 19],
  hip_flexors: [21],
  forward_head: [16, 15, 14, 19, 2],
};

// Priority order of exercises per posture type (most effective first)
const postureTypePriority = {
  forward_head:      [16, 15, 14, 19, 2],
  thoracic_kyphosis: [9, 5, 14, 15, 3, 16, 20, 4, 6, 8],
  sway_back:         [21, 17, 10, 11, 9, 12],
  lumbar_lordosis:   [21, 17, 10, 11, 12, 9],
};

const exercisePoseTypes = {
  21: 'kneeling',
  1: 'seated',
  2: 'standing',
  3: 'wall',
  4: 'wall',
  5: 'seated',
  6: 'seated',
  7: 'kneeling',
  8: 'standing',
  9: 'seated',
  10: 'quadruped',
  11: 'quadruped',
  12: 'seated',
  13: 'kneeling',
  14: 'wall',
  15: 'standing',
  16: 'seated',
  17: 'supine',
  18: 'standing',
  19: 'standing',
  20: 'standing',
};

const exerciseSpriteFrames = {
  1: { sheet: 1, row: 0, rows: 4 },
  2: { sheet: 1, row: 1, rows: 4 },
  3: { sheet: 1, row: 2, rows: 4 },
  4: { sheet: 1, row: 3, rows: 4 },
  5: { sheet: 2, row: 0, rows: 4 },
  6: { sheet: 2, row: 1, rows: 4 },
  7: { sheet: 2, row: 2, rows: 4 },
  8: { sheet: 2, row: 3, rows: 4 },
  9: { sheet: 3, row: 0, rows: 4 },
  10: { sheet: 3, row: 1, rows: 4 },
  11: { sheet: 3, row: 2, rows: 4 },
  12: { sheet: 3, row: 3, rows: 4 },
  13: { sheet: 4, row: 0, rows: 4 },
  14: { sheet: 4, row: 1, rows: 4 },
  15: { sheet: 4, row: 2, rows: 4 },
  16: { sheet: 4, row: 3, rows: 4 },
  17: { sheet: 5, row: 0, rows: 1 },
  18: { sheet: 5, row: 1, rows: 1 },
  19: { sheet: 5, row: 2, rows: 1 },
  20: { sheet: 5, row: 3, rows: 1 },
};

// Retained as a lightweight fallback description for browsers with images disabled.
const StandingExerciseFigure = ({ wall = false }) => (
  <>
    {wall ? <path className="motion-wall" d="M142 12 L142 105" /> : null}
    <rect className="motion-mat" x="25" y="103" width="130" height="9" rx="4.5" />
    <ellipse className="motion-shadow" cx="90" cy="105" rx="30" ry="4" />
    <g className="motion-person">
      <g className="motion-leg motion-leg-left">
        <path d="M82 78 L76 101" />
        <circle cx="75" cy="101" r="4" />
      </g>
      <g className="motion-leg motion-leg-right">
        <path d="M98 78 L104 101" />
        <circle cx="105" cy="101" r="4" />
      </g>
      <g className="motion-torso">
        <path d="M72 42 Q90 33 108 42 L104 78 Q90 86 76 78 Z" />
        <path className="motion-shirt-detail" d="M78 49 Q90 55 102 49" />
      </g>
      <g className="motion-arm motion-arm-left">
        <path d="M76 47 L61 67 L65 84" />
        <circle cx="65" cy="84" r="4" />
      </g>
      <g className="motion-arm motion-arm-right">
        <path d="M104 47 L119 67 L115 84" />
        <circle cx="115" cy="84" r="4" />
      </g>
      <g className="motion-neck">
        <path d="M86 42 L87 35 L93 35 L94 42" />
      </g>
      <g className="motion-head">
        <ellipse cx="90" cy="27" rx="11" ry="13" />
        <path className="motion-hair" d="M79 26 Q80 12 93 14 Q103 15 101 27 Q95 21 79 26" />
        <path className="motion-face" d="M96 28 Q99 29 96 31" />
      </g>
    </g>
  </>
);

const SeatedExerciseFigure = () => (
  <>
    <path className="motion-chair" d="M56 68 H88 V75 H62 V106 H56 Z" />
    <path className="motion-chair" d="M56 38 H61 V70 H56 Z" />
    <ellipse className="motion-shadow" cx="93" cy="106" rx="42" ry="4" />
    <g className="motion-person">
      <g className="motion-leg motion-leg-left">
        <path d="M79 72 L101 76 L101 101" />
        <circle cx="103" cy="102" r="4" />
      </g>
      <g className="motion-leg motion-leg-right">
        <path d="M88 72 L111 78 L116 101" />
        <circle cx="118" cy="102" r="4" />
      </g>
      <g className="motion-torso">
        <path d="M68 39 Q82 34 96 41 L94 72 Q82 78 70 71 Z" />
        <path className="motion-shirt-detail" d="M73 47 Q82 51 92 47" />
      </g>
      <g className="motion-arm motion-arm-left">
        <path d="M72 46 L61 62 L71 73" />
        <circle cx="71" cy="73" r="4" />
      </g>
      <g className="motion-arm motion-arm-right">
        <path d="M93 46 L106 61 L99 74" />
        <circle cx="99" cy="74" r="4" />
      </g>
      <g className="motion-neck">
        <path d="M78 40 L79 33 L85 33 L87 41" />
      </g>
      <g className="motion-head">
        <ellipse cx="83" cy="25" rx="10" ry="12" />
        <path className="motion-hair" d="M73 24 Q74 11 86 13 Q96 14 94 26 Q88 20 73 24" />
        <path className="motion-face" d="M89 26 Q92 27 89 29" />
      </g>
    </g>
  </>
);

const QuadrupedExerciseFigure = () => (
  <>
    <rect className="motion-mat" x="18" y="101" width="144" height="10" rx="5" />
    <ellipse className="motion-shadow" cx="91" cy="100" rx="56" ry="4" />
    <g className="motion-person">
      <g className="motion-torso">
        <path d="M55 50 Q82 42 112 51 L108 68 Q82 72 55 65 Z" />
        <path className="motion-shirt-detail" d="M63 55 Q82 60 103 54" />
      </g>
      <g className="motion-arm motion-arm-left">
        <path d="M101 61 L107 78 L105 98" />
        <circle cx="105" cy="98" r="4" />
      </g>
      <g className="motion-arm motion-arm-right">
        <path d="M111 59 L123 76 L124 98" />
        <circle cx="124" cy="98" r="4" />
      </g>
      <g className="motion-leg motion-leg-left">
        <path d="M61 62 L52 78 L50 98" />
        <circle cx="50" cy="98" r="4" />
      </g>
      <g className="motion-leg motion-leg-right">
        <path d="M72 65 L68 82 L72 98" />
        <circle cx="72" cy="98" r="4" />
      </g>
      <g className="motion-neck">
        <path d="M108 53 L116 48 L120 53" />
      </g>
      <g className="motion-head">
        <ellipse cx="130" cy="54" rx="11" ry="10" />
        <path className="motion-hair" d="M121 50 Q128 38 139 47 L140 55 Q132 49 121 50" />
        <path className="motion-face" d="M137 57 Q140 58 137 60" />
      </g>
    </g>
  </>
);

const KneelingExerciseFigure = () => (
  <>
    <rect className="motion-mat" x="18" y="101" width="144" height="10" rx="5" />
    <ellipse className="motion-shadow" cx="91" cy="101" rx="45" ry="4" />
    <g className="motion-person">
      <g className="motion-leg motion-leg-left">
        <path d="M79 73 L69 89 L53 98" />
        <circle cx="52" cy="98" r="4" />
      </g>
      <g className="motion-leg motion-leg-right">
        <path d="M94 73 L88 90 L73 99" />
        <circle cx="72" cy="99" r="4" />
      </g>
      <g className="motion-torso">
        <path d="M72 40 Q88 34 103 43 L99 75 Q86 81 75 72 Z" />
        <path className="motion-shirt-detail" d="M78 48 Q88 53 98 49" />
      </g>
      <g className="motion-arm motion-arm-left">
        <path d="M77 47 L60 65 L48 84" />
        <circle cx="47" cy="85" r="4" />
      </g>
      <g className="motion-arm motion-arm-right">
        <path d="M100 48 L113 67 L123 85" />
        <circle cx="124" cy="86" r="4" />
      </g>
      <g className="motion-neck">
        <path d="M84 41 L85 34 L91 34 L93 42" />
      </g>
      <g className="motion-head">
        <ellipse cx="89" cy="25" rx="10" ry="12" />
        <path className="motion-hair" d="M79 24 Q80 11 92 13 Q101 15 100 26 Q94 20 79 24" />
        <path className="motion-face" d="M95 26 Q98 27 95 29" />
      </g>
    </g>
  </>
);

const SupineExerciseFigure = () => (
  <>
    <rect className="motion-mat" x="14" y="91" width="152" height="12" rx="6" />
    <ellipse className="motion-shadow" cx="90" cy="89" rx="65" ry="4" />
    <g className="motion-person">
      <g className="motion-torso">
        <path d="M62 66 Q84 58 109 66 L109 82 Q84 87 62 80 Z" />
        <path className="motion-shirt-detail" d="M70 70 Q86 74 102 69" />
      </g>
      <g className="motion-leg motion-leg-left">
        <path d="M65 78 L45 64 L31 85" />
        <circle cx="29" cy="87" r="4" />
      </g>
      <g className="motion-leg motion-leg-right">
        <path d="M75 81 L54 69 L43 89" />
        <circle cx="41" cy="90" r="4" />
      </g>
      <g className="motion-arm motion-arm-left">
        <path d="M104 70 L119 80 L132 86" />
        <circle cx="134" cy="87" r="4" />
      </g>
      <g className="motion-arm motion-arm-right">
        <path d="M102 75 L117 86 L129 90" />
        <circle cx="131" cy="91" r="4" />
      </g>
      <g className="motion-neck">
        <path d="M108 69 L116 66 L119 73" />
      </g>
      <g className="motion-head">
        <ellipse cx="130" cy="72" rx="12" ry="10" />
        <path className="motion-hair" d="M122 68 Q132 57 141 68 L141 75 Q134 69 122 68" />
        <path className="motion-face" d="M138 75 Q141 76 138 78" />
      </g>
    </g>
  </>
);

const exerciseFigureFallbacks = {
  standing: StandingExerciseFigure,
  wall: StandingExerciseFigure,
  seated: SeatedExerciseFigure,
  quadruped: QuadrupedExerciseFigure,
  kneeling: KneelingExerciseFigure,
  supine: SupineExerciseFigure,
};

const exerciseMotionVideos = {
  1: '/exercise-animations/upper-trapezius-stretch.mp4',
  11: '/exercise-animations/cat-cow-mobility.mp4',
};

const IllustratedBody = ({ cx = 100, showLeftArm = true, showRightArm = true }) => (
  <g>
    {/* Shoes */}
    <ellipse cx={cx - 10} cy="151" rx="13" ry="6" fill="#1e293b" />
    <ellipse cx={cx + 10} cy="151" rx="13" ry="6" fill="#1e293b" />
    {/* Leg left */}
    <path d={`M${cx-12} 117 Q${cx-13} 133 ${cx-10} 151`} stroke="#f0c090" strokeWidth="15" strokeLinecap="round" fill="none" />
    {/* Leg right */}
    <path d={`M${cx+12} 117 Q${cx+13} 133 ${cx+10} 151`} stroke="#f0c090" strokeWidth="15" strokeLinecap="round" fill="none" />
    {/* Shorts */}
    <path d={`M${cx-24} 97 Q${cx} 105 ${cx+24} 97 L${cx+22} 117 Q${cx} 122 ${cx-22} 117 Z`} fill="#2d3748" />
    {/* Torso */}
    <path d={`M${cx-25} 57 Q${cx} 50 ${cx+25} 57 L${cx+22} 97 Q${cx} 104 ${cx-22} 97 Z`} fill="#ef6c35" />
    {/* Torso shading */}
    <path d={`M${cx-25} 57 Q${cx-12} 53 ${cx} 51 L${cx} 97 Q${cx-12} 103 ${cx-22} 97 Z`} fill="#d4571f" opacity="0.18" />
    {/* Collar */}
    <path d={`M${cx-7} 57 Q${cx} 64 ${cx+7} 57`} fill="#c94f23" />
    {/* Neck */}
    <rect x={cx-6} y="44" width="12" height="15" rx="5" fill="#f0c090" />
    {/* Ears */}
    <ellipse cx={cx-20} cy="27" rx="5" ry="7" fill="#f0c090" />
    <ellipse cx={cx+20} cy="27" rx="5" ry="7" fill="#f0c090" />
    <ellipse cx={cx-20} cy="27" rx="3" ry="5" fill="#e8a87c" />
    <ellipse cx={cx+20} cy="27" rx="3" ry="5" fill="#e8a87c" />
    {/* Head */}
    <ellipse cx={cx} cy="24" rx="20" ry="22" fill="#f2c497" />
    {/* Hair top */}
    <path d={`M${cx-20} 21 Q${cx-18} 3 ${cx} 2 Q${cx+18} 3 ${cx+20} 21 Q${cx+14} 10 ${cx} 10 Q${cx-14} 10 ${cx-20} 21`} fill="#4a2c17" />
    {/* Hair sides */}
    <path d={`M${cx-20} 21 Q${cx-23} 31 ${cx-21} 40`} stroke="#4a2c17" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d={`M${cx+20} 21 Q${cx+23} 31 ${cx+21} 40`} stroke="#4a2c17" strokeWidth="5" fill="none" strokeLinecap="round" />
    {/* Eyebrows */}
    <path d={`M${cx-13} 18 Q${cx-8} 15 ${cx-3} 17`} stroke="#4a2c17" strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d={`M${cx+3} 17 Q${cx+8} 15 ${cx+13} 18`} stroke="#4a2c17" strokeWidth="2" strokeLinecap="round" fill="none" />
    {/* Eyes whites */}
    <ellipse cx={cx-8} cy="24" rx="4.5" ry="5" fill="white" />
    <ellipse cx={cx+8} cy="24" rx="4.5" ry="5" fill="white" />
    {/* Pupils */}
    <circle cx={cx-7} cy="25" r="2.8" fill="#1e293b" />
    <circle cx={cx+9} cy="25" r="2.8" fill="#1e293b" />
    {/* Eye shine */}
    <circle cx={cx-6} cy="24" r="1" fill="white" />
    <circle cx={cx+10} cy="24" r="1" fill="white" />
    {/* Nose */}
    <ellipse cx={cx} cy="33" rx="3" ry="2" fill="#d9956c" opacity="0.5" />
    <path d={`M${cx-3} 33 Q${cx} 36 ${cx+3} 33`} fill="none" stroke="#c97a55" strokeWidth="1.2" strokeLinecap="round" />
    {/* Smile */}
    <path d={`M${cx-8} 40 Q${cx} 46 ${cx+8} 40`} fill="none" stroke="#c97a55" strokeWidth="2.2" strokeLinecap="round" />
    {/* Cheek blush */}
    <ellipse cx={cx-14} cy="34" rx="5" ry="3" fill="#ffb5a0" opacity="0.3" />
    <ellipse cx={cx+14} cy="34" rx="5" ry="3" fill="#ffb5a0" opacity="0.3" />
    {/* Static left arm */}
    {showLeftArm && (
      <path d={`M${cx-22} 62 Q${cx-38} 72 ${cx-42} 88`} stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" />
    )}
    {/* Static right arm */}
    {showRightArm && (
      <path d={`M${cx+22} 62 Q${cx+38} 72 ${cx+42} 88`} stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" />
    )}
  </g>
);

const BandExternalRotationFigure = () => (
  <svg
    viewBox="0 0 220 160"
    xmlns="http://www.w3.org/2000/svg"
    className="exercise-rendered-animation"
    style={{ width: '100%', height: '100%', display: 'block' }}
    aria-hidden="true"
  >
    {/* Floor shadow */}
    <ellipse cx="95" cy="155" rx="32" ry="5" fill="#00000022" />

    {/* Wall on right */}
    <rect x="195" y="0" width="25" height="160" fill="#e2e8f0" />
    <line x1="195" y1="0" x2="195" y2="160" stroke="#cbd5e0" strokeWidth="2" />
    {/* Wall anchor bolt */}
    <circle cx="197" cy="75" r="5" fill="#94a3b8" />
    <circle cx="197" cy="75" r="3" fill="#64748b" />

    {/* Resistance band from wall to hand (animates with forearm) */}
    <line x1="197" y1="75" x2="155" y2="72" stroke="#60a5fa" strokeWidth="3" strokeDasharray="6 3">
      <animate attributeName="x2" values="155;137;155" dur="2.8s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="y2" values="72;92;72"  dur="2.8s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </line>

    {/* Character body — static parts */}
    <IllustratedBody cx={95} showLeftArm={true} showRightArm={false} />

    {/* Right upper arm — static, elbow at side */}
    <path d="M117 62 L133 72" stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" />
    {/* Elbow joint */}
    <circle cx="133" cy="72" r="6" fill="#f0c090" />

    {/* Right forearm — rotates around elbow (133,72) */}
    <g>
      <animateTransform
        attributeName="transform"
        type="rotate"
        values="0 133 72; 70 133 72; 0 133 72"
        dur="2.8s"
        repeatCount="indefinite"
        calcMode="spline"
        keyTimes="0;0.5;1"
        keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
      <path d="M133 72 L157 72" stroke="#f0c090" strokeWidth="12" strokeLinecap="round" fill="none" />
      {/* Hand / grip */}
      <circle cx="157" cy="72" r="7" fill="#f0c090" />
      <circle cx="157" cy="72" r="4" fill="#60a5fa" opacity="0.9" />
    </g>
  </svg>
);

const FacePullFigure = () => (
  <svg
    viewBox="0 0 220 160"
    xmlns="http://www.w3.org/2000/svg"
    className="exercise-rendered-animation"
    style={{ width: '100%', height: '100%', display: 'block' }}
    aria-hidden="true"
  >
    {/* Floor shadow */}
    <ellipse cx="110" cy="155" rx="32" ry="5" fill="#00000022" />

    {/* Cable machine on left */}
    <rect x="0" y="0" width="22" height="160" fill="#e2e8f0" />
    <line x1="22" y1="0" x2="22" y2="160" stroke="#cbd5e0" strokeWidth="2" />
    <rect x="5" y="38" width="14" height="22" rx="4" fill="#94a3b8" />
    {/* Pulley */}
    <circle cx="15" cy="40" r="6" fill="#64748b" />
    <circle cx="15" cy="40" r="3" fill="#94a3b8" />

    {/* Left band (to left hand) */}
    <line x1="15" y1="40" x2="72" y2="70" stroke="#60a5fa" strokeWidth="3" strokeDasharray="6 3">
      <animate attributeName="x2" values="72;88;72" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="y2" values="70;42;70" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </line>
    {/* Right band (to right hand) */}
    <line x1="15" y1="40" x2="148" y2="70" stroke="#60a5fa" strokeWidth="3" strokeDasharray="6 3">
      <animate attributeName="x2" values="148;132;148" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="y2" values="70;42;70"  dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </line>

    {/* Character body static */}
    <IllustratedBody cx={110} showLeftArm={false} showRightArm={false} />

    {/* Left arm animated — upper arm shoulder to elbow */}
    <path stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" d="M88 62 L72 70">
      <animate attributeName="d" values="M88 62 L72 70;M88 62 L88 42;M88 62 L72 70" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    {/* Left forearm elbow to hand */}
    <path stroke="#f0c090" strokeWidth="12" strokeLinecap="round" fill="none" d="M72 70 L72 70">
      <animate attributeName="d" values="M72 70 L72 70;M88 42 L88 42;M72 70 L72 70" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    {/* Left hand grip */}
    <circle cx="72" cy="70" r="7" fill="#f0c090">
      <animate attributeName="cx" values="72;88;72" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="70;42;70" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>
    <circle cx="72" cy="70" r="4" fill="#60a5fa" opacity="0.9">
      <animate attributeName="cx" values="72;88;72" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="70;42;70" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>

    {/* Right arm animated */}
    <path stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" d="M132 62 L148 70">
      <animate attributeName="d" values="M132 62 L148 70;M132 62 L132 42;M132 62 L148 70" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    <circle cx="148" cy="70" r="7" fill="#f0c090">
      <animate attributeName="cx" values="148;132;148" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="70;42;70"  dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>
    <circle cx="148" cy="70" r="4" fill="#60a5fa" opacity="0.9">
      <animate attributeName="cx" values="148;132;148" dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="70;42;70"  dur="2.5s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>
  </svg>
);

const BandPullApartFigure = () => (
  <svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" className="exercise-rendered-animation" style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden="true">
    {/* Shadow */}
    <ellipse cx="110" cy="155" rx="32" ry="5" fill="#00000022" />

    {/* Static body */}
    <IllustratedBody cx={110} showLeftArm={false} showRightArm={false} />

    {/* Left upper arm (shoulder to elbow) — sweeps left */}
    <path stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" d="M88 62 L68 64">
      <animate attributeName="d" values="M88 62 L68 64;M88 62 L28 62;M88 62 L68 64" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    {/* Left forearm (elbow to hand) */}
    <path stroke="#f0c090" strokeWidth="12" strokeLinecap="round" fill="none" d="M68 64 L92 62">
      <animate attributeName="d" values="M68 64 L92 62;M28 62 L52 62;M68 64 L92 62" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    {/* Left hand */}
    <circle cx="92" cy="62" r="7" fill="#f0c090">
      <animate attributeName="cx" values="92;52;92" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>

    {/* Right upper arm (shoulder to elbow) — sweeps right */}
    <path stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none" d="M132 62 L152 64">
      <animate attributeName="d" values="M132 62 L152 64;M132 62 L192 62;M132 62 L152 64" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    {/* Right forearm */}
    <path stroke="#f0c090" strokeWidth="12" strokeLinecap="round" fill="none" d="M152 64 L128 62">
      <animate attributeName="d" values="M152 64 L128 62;M192 62 L168 62;M152 64 L128 62" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </path>
    {/* Right hand */}
    <circle cx="128" cy="62" r="7" fill="#f0c090">
      <animate attributeName="cx" values="128;168;128" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>

    {/* Resistance band between hands */}
    <line stroke="#60a5fa" strokeWidth="3" strokeDasharray="7 4" x1="92" y1="62" x2="128" y2="62">
      <animate attributeName="x1" values="92;52;92" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="x2" values="128;168;128" dur="2.4s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </line>
  </svg>
);

const HipFlexorStretchFigure = () => (
  <svg
    viewBox="0 0 220 160"
    xmlns="http://www.w3.org/2000/svg"
    className="exercise-rendered-animation"
    style={{ width: '100%', height: '100%', display: 'block' }}
    aria-hidden="true"
  >
    {/* Floor */}
    <rect x="20" y="143" width="180" height="4" rx="2" fill="#cbd5e0" opacity="0.5" />
    {/* Floor shadow */}
    <ellipse cx="110" cy="147" rx="55" ry="5" fill="#00000018" />

    {/* === BACK LEG (kneeling) === */}
    {/* Back shin — vertical on floor */}
    <line x1="85" y1="143" x2="85" y2="110" stroke="#f0c090" strokeWidth="13" strokeLinecap="round" />
    {/* Back knee circle */}
    <circle cx="85" cy="110" r="7" fill="#f0c090" />
    {/* Back thigh — animates with hip rock */}
    <path d="M85 110 L100 80" stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none">
      <animate
        attributeName="d"
        values="M85 110 L100 80;M85 110 L106 77;M85 110 L100 80"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>
    {/* Back shoe */}
    <ellipse cx="85" cy="145" rx="14" ry="5" fill="#1e293b" />

    {/* === FRONT LEG (foot forward) === */}
    {/* Front foot / shoe */}
    <ellipse cx="148" cy="145" rx="16" ry="5" fill="#1e293b" />
    {/* Front shin */}
    <path d="M148 143 L140 110" stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none">
      <animate
        attributeName="d"
        values="M148 143 L140 110;M148 143 L138 108;M148 143 L140 110"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>
    {/* Front knee */}
    <circle cx="140" cy="110" r="7" fill="#f0c090">
      <animate attributeName="cx" values="140;138;140" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="110;108;110" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>
    {/* Front thigh */}
    <path d="M140 110 L115 85" stroke="#f0c090" strokeWidth="13" strokeLinecap="round" fill="none">
      <animate
        attributeName="d"
        values="M140 110 L115 85;M138 108 L112 82;M140 110 L115 85"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>

    {/* === TORSO — rocks forward with hip === */}
    {/* Hips/pelvis */}
    <ellipse cx="108" cy="83" rx="18" ry="10" fill="#2d3748">
      <animate attributeName="cx" values="108;111;108" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="83;80;83" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </ellipse>

    {/* Torso body */}
    <path d="M94 81 Q108 72 122 75 L120 55 Q108 50 96 53 Z" fill="#ef6c35">
      <animate
        attributeName="d"
        values="M94 81 Q108 72 122 75 L120 55 Q108 50 96 53 Z;M97 78 Q111 69 125 72 L122 51 Q110 46 98 49 Z;M94 81 Q108 72 122 75 L120 55 Q108 50 96 53 Z"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>
    {/* Torso shading */}
    <path d="M94 81 Q100 76 107 73 L105 52 Q100 51 96 53 Z" fill="#d4571f" opacity="0.18">
      <animate
        attributeName="d"
        values="M94 81 Q100 76 107 73 L105 52 Q100 51 96 53 Z;M97 78 Q103 73 110 70 L108 49 Q103 48 98 49 Z;M94 81 Q100 76 107 73 L105 52 Q100 51 96 53 Z"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>

    {/* Neck */}
    <rect x="104" y="40" width="10" height="14" rx="4" fill="#f0c090">
      <animate attributeName="x" values="104;107;104" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="y" values="40;37;40" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </rect>

    {/* Head */}
    <ellipse cx="109" cy="30" rx="17" ry="19" fill="#f2c497">
      <animate attributeName="cx" values="109;112;109" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="30;27;30" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </ellipse>
    {/* Hair */}
    <path d="M92 28 Q93 12 109 10 Q125 12 126 28 Q120 16 109 16 Q98 16 92 28" fill="#4a2c17">
      <animate
        attributeName="d"
        values="M92 28 Q93 12 109 10 Q125 12 126 28 Q120 16 109 16 Q98 16 92 28;M95 25 Q96 9 112 7 Q128 9 129 25 Q123 13 112 13 Q101 13 95 25;M92 28 Q93 12 109 10 Q125 12 126 28 Q120 16 109 16 Q98 16 92 28"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>
    {/* Eye */}
    <ellipse cx="116" cy="28" rx="4" ry="4.5" fill="white">
      <animate attributeName="cx" values="116;119;116" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="28;25;28" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </ellipse>
    <circle cx="117" cy="29" r="2.5" fill="#1e293b">
      <animate attributeName="cx" values="117;120;117" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
      <animate attributeName="cy" values="29;26;29" dur="3s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1" />
    </circle>

    {/* Front arm (raised up) */}
    <path d="M120 60 L135 42" stroke="#f0c090" strokeWidth="11" strokeLinecap="round" fill="none">
      <animate
        attributeName="d"
        values="M120 60 L135 42;M123 57 L138 39;M120 60 L135 42"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>
    {/* Front forearm */}
    <path d="M135 42 L145 30" stroke="#f0c090" strokeWidth="10" strokeLinecap="round" fill="none">
      <animate
        attributeName="d"
        values="M135 42 L145 30;M138 39 L148 27;M135 42 L145 30"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>
    {/* Back arm (resting on front knee) */}
    <path d="M96 60 L112 80" stroke="#f0c090" strokeWidth="11" strokeLinecap="round" fill="none">
      <animate
        attributeName="d"
        values="M96 60 L112 80;M99 57 L115 77;M96 60 L112 80"
        dur="3s" repeatCount="indefinite" calcMode="spline"
        keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"
      />
    </path>

    {/* Stretch indicator arc behind back leg */}
    <path d="M78 143 Q60 120 70 100" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="5 3" opacity="0.7">
      <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3s" repeatCount="indefinite" />
    </path>
    <path d="M70 100 L67 93" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" opacity="0.7">
      <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3s" repeatCount="indefinite" />
    </path>
  </svg>
);

const customExerciseAnimations = {
  18: BandExternalRotationFigure,
  19: FacePullFigure,
  20: BandPullApartFigure,
  21: HipFlexorStretchFigure,
};

const ExerciseMotion = ({ exercise, large = false }) => {
  const CustomAnimation = customExerciseAnimations[exercise.id];
  return (
    <div
      className={`exercise-motion exercise-motion-${exercise.id} exercise-pose-${
        exercisePoseTypes[exercise.id] || 'standing'
      } ${large ? 'large' : ''}`}
      role="img"
      aria-label={`${exercise.name} movement animation`}
      data-sprite-source={Boolean(exerciseSpriteFrames[exercise.id])}
      data-pose-fallback={Boolean(
        exerciseFigureFallbacks[exercisePoseTypes[exercise.id] || 'standing']
      )}
    >
      {CustomAnimation ? (
        <CustomAnimation />
      ) : exerciseMotionVideos[exercise.id] ? (
        <video
          className="exercise-rendered-animation exercise-reference-video"
          src={exerciseMotionVideos[exercise.id]}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = 0.7;
          }}
          aria-hidden="true"
        />
      ) : (
        <img
          className="exercise-rendered-animation"
          src={`/exercise-animations/rendered/exercise-${String(exercise.id).padStart(
            2,
            '0'
          )}${[1, 11].includes(exercise.id) ? '' : '-slow'}.webp?v=20260611-11`}
          alt=""
          draggable="false"
        />
      )}
    </div>
  );
};

const ExerciseThumbnail = ({ exercise }) => (
  <div className="exercise-motion exercise-thumbnail" aria-hidden="true">
    <span>{exercise.name?.slice(0, 2).toUpperCase() || 'EX'}</span>
  </div>
);

const buildLiveTags = (analysis) => {
  const issueText = (analysis?.issues || []).join(' ').toLowerCase();
  const summaryText = `${analysis?.summary || ''}`.toLowerCase();
  const combined = `${issueText} ${summaryText}`;
  const tags = new Set();

  if (combined.includes('neck') || combined.includes('chin') || combined.includes('head')) {
    tags.add('neck');
    tags.add('head');
  }

  if (combined.includes('shoulder')) {
    tags.add('shoulders');
    tags.add('upper_back');
  }

  if (combined.includes('chest') || combined.includes('slouch')) {
    tags.add('chest');
    tags.add('upper_back');
  }

  if (combined.includes('back') || combined.includes('spine')) {
    tags.add('mid_back');
    tags.add('spine');
  }

  if (combined.includes('lean') || combined.includes('lower')) {
    tags.add('lower_back');
    tags.add('spine');
  }

  if ((analysis?.metrics?.headCenterOffset || 0) > 0.035) {
    tags.add('neck');
  }

  if ((analysis?.metrics?.shoulderTilt || 0) > 0.02) {
    tags.add('shoulders');
    tags.add('upper_back');
  }

  if ((analysis?.metrics?.neckHeightRatio || 1) < 0.8) {
    tags.add('neck');
  }

  if ((analysis?.metrics?.lean || 0) > 0.08) {
    tags.add('lower_back');
    tags.add('spine');
  }

  return Array.from(tags);
};

const buildTagsFromText = (value) => {
  const text = `${value || ''}`.toLowerCase();
  const tags = new Set();

  if (text.includes('neck') || text.includes('chin') || text.includes('head')) {
    tags.add('neck');
    tags.add('head');
  }

  if (text.includes('shoulder')) {
    tags.add('shoulders');
    tags.add('upper_back');
  }

  if (text.includes('chest') || text.includes('slouch')) {
    tags.add('chest');
    tags.add('upper_back');
  }

  if (text.includes('back') || text.includes('spine')) {
    tags.add('mid_back');
    tags.add('spine');
  }

  if (text.includes('lean') || text.includes('lower')) {
    tags.add('lower_back');
    tags.add('spine');
  }

  return Array.from(tags);
};

const buildDashboardTags = (dashboardData) => {
  const alerts = dashboardData?.alerts || [];
  const tips = dashboardData?.tips || [];
  const summary = dashboardData?.summary || {};
  const postureData = dashboardData?.postureData || {};
  const tags = new Set();

  [...alerts, ...tips].forEach((item) => {
    buildTagsFromText(item.message || item.text || item.title).forEach((tag) => tags.add(tag));
  });

  if ((summary.totalBadSeconds || 0) > (summary.totalGoodSeconds || 0) * 0.25) {
    tags.add('spine');
    tags.add('upper_back');
  }

  if ((summary.alertCount || 0) > 0 || (postureData.alertCount || 0) > 0) {
    tags.add('posture');
  }

  if ((summary.averageScore || postureData.postureScore || 100) < 75) {
    tags.add('neck');
    tags.add('shoulders');
    tags.add('spine');
  }

  return Array.from(tags);
};

const buildRecommendationReasons = (exercise, selectedRegion, liveTags, isMonitoring, analysis) => {
  const reasons = [];
  const tags = exerciseTags[exercise.id] || [];

  if (selectedRegion && tags.includes(selectedRegion.id)) {
    reasons.push(`Matches your selected pain area: ${selectedRegion.label}.`);
  } else if (selectedRegion && selectedRegion.tags.some((tag) => tags.includes(tag))) {
    reasons.push(`Supports the surrounding ${selectedRegion.label.toLowerCase()} region.`);
  }

  if (liveTags.some((tag) => tags.includes(tag))) {
    reasons.push('Fits the posture issue pattern detected by the live monitor.');
  }

  if (!reasons.length && isMonitoring && analysis.posture === 'bad') {
    reasons.push('Useful as a general reset after extended bad posture.');
  }

  if (!reasons.length) {
    reasons.push('Helpful as a preventive posture-support exercise during desk work.');
  }

  return reasons;
};

const Exercises = () => {
  const [data, setData] = useState({ exercises: [], completedIds: [] });
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [recommendationMode, setRecommendationMode] = useState('pain');
  const [selectedPainRegionId, setSelectedPainRegionId] = useState('rhomboids');
  const [selectedPainPoint, setSelectedPainPoint] = useState({ x: 0.5, y: 0.38 });
  const [isDraggingPainSelector, setIsDraggingPainSelector] = useState(false);
  const [selectedPostureTypeId, setSelectedPostureTypeId] = useState('thoracic_kyphosis');
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');
  const painMapRef = useRef(null);
  const { analysis, isMonitoring } = useMonitoring();

  const loadExercises = async () => {
    setIsLoading(true);
    setError('');

    try {
      const exerciseData = await appService.getExercises();
      setData(exerciseData);
      setSelectedExercise((current) => current || exerciseData.exercises[0] || null);
      appService.getDashboardData().then(setDashboardData).catch(() => {});
    } catch (loadError) {
      setError(loadError.message || 'Unable to load exercises.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExercises();
  }, []);

  const selectedPainRegion = useMemo(
    () => painRegions.find((region) => region.id === selectedPainRegionId) || null,
    [selectedPainRegionId]
  );

  const selectedPostureType = useMemo(
    () => postureTypes.find((type) => type.id === selectedPostureTypeId) || null,
    [selectedPostureTypeId]
  );

  const visibleExercises = useMemo(() => {
    const sortByPriority = (exercises, priority) =>
      exercises.slice().sort((left, right) => {
        const l = priority.indexOf(left.id);
        const r = priority.indexOf(right.id);
        return (l === -1 ? Number.MAX_SAFE_INTEGER : l) - (r === -1 ? Number.MAX_SAFE_INTEGER : r) || left.id - right.id;
      });

    if (recommendationMode === 'pain' && selectedPainRegion) {
      const priority = muscleExercisePriority[selectedPainRegion.id] || [];
      return sortByPriority(
        data.exercises.filter((ex) => (exerciseTags[ex.id] || []).includes(selectedPainRegion.id)),
        priority
      );
    }

    if (recommendationMode === 'posture' && selectedPostureType) {
      const priority = postureTypePriority[selectedPostureType.id] || [];
      if (priority.length > 0) {
        return sortByPriority(
          data.exercises.filter((ex) => priority.includes(ex.id)),
          priority
        );
      }
      return sortByPriority(
        data.exercises.filter((ex) =>
          selectedPostureType.tags.some((tag) => (exerciseTags[ex.id] || []).includes(tag))
        ),
        priority
      );
    }

    return data.exercises;
  }, [data.exercises, recommendationMode, selectedPainRegion, selectedPostureType]);

  const recommendationData = useMemo(() => {
    const liveTags = buildLiveTags(analysis);
    const dashboardTags = buildDashboardTags(dashboardData);
    const postureTags = selectedPostureType?.tags || [];
    const activePainRegion = recommendationMode === 'pain' ? selectedPainRegion : null;
    const activePostureTags = recommendationMode === 'posture' ? postureTags : [];
    const activeDashboardTags = recommendationMode === 'data' ? dashboardTags : [];

    const ranked = data.exercises
      .map((exercise) => {
        const tags = exerciseTags[exercise.id] || [];
        let score = 0;

        if (activePainRegion) {
          if (tags.includes(activePainRegion.id)) {
            score += 24;
          }
          score += activePainRegion.tags.filter((tag) => tags.includes(tag)).length * 4;
        }

        score += activePostureTags.filter((tag) => tags.includes(tag)).length * 4;
        score += activeDashboardTags.filter((tag) => tags.includes(tag)).length * 4;
        score += liveTags.filter((tag) => tags.includes(tag)).length * 1;

        if (analysis.posture === 'bad' && tags.includes('posture')) {
          score += 1;
        }

        return {
          ...exercise,
          recommendationScore: score,
          reasons: [
            ...buildRecommendationReasons(
              exercise,
              activePainRegion,
              liveTags,
              isMonitoring,
              analysis
            ),
            ...(recommendationMode === 'posture' &&
            selectedPostureType &&
            selectedPostureType.tags.some((tag) => tags.includes(tag))
              ? [`Matches the posture type you selected: ${selectedPostureType.label}.`]
              : []),
            ...(recommendationMode === 'data' && activeDashboardTags.some((tag) => tags.includes(tag))
              ? ['Matches posture trends and alerts from your monitoring dashboard.']
              : []),
          ],
        };
      })
      .sort((left, right) => {
        const scoreDiff = right.recommendationScore - left.recommendationScore;
        if (scoreDiff !== 0) return scoreDiff;
        // Use posture-type priority order as tiebreaker in posture mode
        if (recommendationMode === 'posture' && selectedPostureType) {
          const priority = postureTypePriority[selectedPostureType.id] || [];
          const lRank = priority.indexOf(left.id);
          const rRank = priority.indexOf(right.id);
          const l = lRank === -1 ? Number.MAX_SAFE_INTEGER : lRank;
          const r = rRank === -1 ? Number.MAX_SAFE_INTEGER : rRank;
          if (l !== r) return l - r;
        }
        return left.id - right.id;
      });

    return {
      liveTags,
      dashboardTags,
      recommended: ranked.slice(0, 3),
    };
  }, [
    analysis,
    dashboardData,
    data.exercises,
    isMonitoring,
    recommendationMode,
    selectedPainRegion,
    selectedPostureType,
  ]);

  useEffect(() => {
    if (!selectedExercise && recommendationData.recommended.length) {
      setSelectedExercise(recommendationData.recommended[0]);
    }
  }, [recommendationData.recommended, selectedExercise]);

  useEffect(() => {
    if (!visibleExercises.length) {
      setSelectedExercise(null);
      return;
    }

    if (!visibleExercises.some((exercise) => exercise.id === selectedExercise?.id)) {
      setSelectedExercise(visibleExercises[0]);
    }
  }, [selectedExercise?.id, visibleExercises]);

  useEffect(() => {
    if (recommendationMode === 'pain' && visibleExercises.length) {
      setSelectedExercise(visibleExercises[0]);
    }
  }, [recommendationMode, selectedPainRegionId, visibleExercises]);

  const handleMarkComplete = async (id) => {
    setIsUpdating(true);
    try {
      const completed = !data.completedIds.includes(id);
      const result = await appService.updateExerciseProgress(id, completed);
      setData((prev) => ({ ...prev, completedIds: result.completedIds }));
    } catch (updateError) {
      setError(updateError.message || 'Unable to update exercise progress.');
    } finally {
      setIsUpdating(false);
    }
  };

  const updatePainSelectorFromPoint = (clientX, clientY) => {
    const stage = painMapRef.current;
    if (!stage) {
      return;
    }

    const bounds = stage.getBoundingClientRect();
    const rawXRatio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    const rawYRatio = Math.min(1, Math.max(0, (clientY - bounds.top) / bounds.height));
    const nextPoint = clampPainPointToBack(rawXRatio, rawYRatio);
    const nextRegionId = inferPainRegionFromClick(nextPoint.x, nextPoint.y);

    setSelectedPainPoint(nextPoint);
    setSelectedPainRegionId(nextRegionId);
  };

  const handlePainPointerDown = (event) => {
    event.preventDefault();
    setIsDraggingPainSelector(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updatePainSelectorFromPoint(event.clientX, event.clientY);
  };

  const handlePainPointerMove = (event) => {
    if (!isDraggingPainSelector) {
      return;
    }

    updatePainSelectorFromPoint(event.clientX, event.clientY);
  };

  const handlePainPointerUp = (event) => {
    setIsDraggingPainSelector(false);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  if (isLoading) {
    return <PageLoader message="Loading exercises..." />;
  }

  if (error && !data.exercises.length) {
    return <ErrorState message={error} onRetry={loadExercises} />;
  }

  if (!data.exercises.length) {
    return (
      <EmptyState
        title="No exercises available"
        message="Add exercises in the backend or mock data layer to see them here."
      />
    );
  }

  const modeOptions = [
    {
      id: 'posture',
      title: 'I know my posture type',
      detail: selectedPostureType?.label || 'Choose a posture pattern',
      description: 'Pick the posture picture that looks closest to your problem.',
    },
    {
      id: 'data',
      title: 'Use my monitoring data',
      detail: dashboardData?.summary?.totalSessions
        ? `${dashboardData.summary.totalSessions} completed sessions`
        : 'Uses dashboard alerts and score trends',
      description: 'Let the system recommend exercises from saved posture history.',
    },
    {
      id: 'pain',
      title: 'I feel pain somewhere',
      detail: selectedPainRegion?.label || 'Click a pain area',
      description: 'Use the back guide to select where discomfort is felt.',
    },
  ];

  return (
    <div className="exercises-container">
      <div className="exercises-header">
        <h1>Posture Exercises and Stretches</h1>
        <p>Choose how you want the system to recommend exercises today.</p>
      </div>

      {error ? <div className="auth-error">{error}</div> : null}

      <div className="exercise-mode-grid">
        {modeOptions.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`exercise-mode-card ${recommendationMode === mode.id ? 'active' : ''}`}
            onClick={() => setRecommendationMode(mode.id)}
          >
            <span className="exercise-mode-kicker">{mode.title}</span>
            <strong>{mode.detail}</strong>
            <span>{mode.description}</span>
          </button>
        ))}
      </div>

      {recommendationMode === 'posture' ? (
        <div className="card posture-picker-card">
          <div className="card-header">
            <h3>Select the Posture That Looks Most Like You</h3>
          </div>
          <div className="card-body posture-picker-body">
            <p className="pain-map-helper">
              These reference images help match exercises to the posture pattern you already
              recognize.
            </p>
            <div className="posture-picker-grid">
              {postureTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={`posture-type-card ${
                    selectedPostureTypeId === type.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedPostureTypeId(type.id)}
                >
                  <div className="posture-type-image-wrap">
                    <img
                      src={type.imageUrl}
                      alt={type.label}
                      className="posture-type-image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="posture-type-content">
                    <strong>{type.label}</strong>
                    <p>{type.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {recommendationMode === 'data' ? (
        <div className="card exercise-data-card">
          <div className="card-header">
            <h3>Monitoring Data Recommendation</h3>
          </div>
          <div className="card-body exercise-data-body">
            <div className="exercise-data-stat">
              <span>Average score</span>
              <strong>{dashboardData?.summary?.averageScore || dashboardData?.postureData?.postureScore || 0}</strong>
            </div>
            <div className="exercise-data-stat">
              <span>Bad posture time</span>
              <strong>{Math.round((dashboardData?.summary?.totalBadSeconds || 0) / 60)} min</strong>
            </div>
            <div className="exercise-data-stat">
              <span>Alerts</span>
              <strong>{dashboardData?.summary?.alertCount || dashboardData?.postureData?.alertCount || 0}</strong>
            </div>
            <div className="exercise-data-tags">
              {recommendationData.dashboardTags.length ? (
                recommendationData.dashboardTags.map((tag) => (
                  <span key={tag} className="meta-badge">
                    {tag.replaceAll('_', ' ')}
                  </span>
                ))
              ) : (
                <span className="meta-badge">general posture maintenance</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {recommendationMode === 'pain' ? (
        <div className="card pain-map-card">
          <div className="card-header">
            <h3>Pain Area Selector</h3>
          </div>
          <div className="card-body pain-map-body">
            <p className="pain-map-helper">
              Drag the selector to the painful muscle region. The system maps its position to
              posture-related back muscles and recommends exercises from that region.
            </p>
            <div className="pain-map-stage">
              <div
                ref={painMapRef}
                className="pain-map-silhouette"
                onPointerDown={handlePainPointerDown}
                onPointerMove={handlePainPointerMove}
                onPointerUp={handlePainPointerUp}
                onPointerCancel={handlePainPointerUp}
                role="slider"
                tabIndex={0}
                onKeyDown={(event) => {
                  const step = event.shiftKey ? 0.08 : 0.035;
                  const keyOffsets = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                  };

                  if (keyOffsets[event.key]) {
                    event.preventDefault();
                    const [dx, dy] = keyOffsets[event.key];
                    const nextPoint = clampPainPointToBack(
                      selectedPainPoint.x + dx,
                      selectedPainPoint.y + dy
                    );
                    setSelectedPainPoint(nextPoint);
                    setSelectedPainRegionId(inferPainRegionFromClick(nextPoint.x, nextPoint.y));
                  }
                }}
                aria-label="Drag the pain selector across the back muscle map"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(selectedPainPoint.y * 100)}
                aria-valuetext={selectedPainRegion?.label}
              >
                <img
                  src="/body-map/blue-muscular-back-transparent.png"
                  alt="Muscular back pain selection map"
                  className="pain-map-back-image"
                  draggable="false"
                />
                <div className="pain-guide-zone pain-guide-infraspinatus pain-guide-infraspinatus-left" />
                <div className="pain-guide-zone pain-guide-infraspinatus pain-guide-infraspinatus-right" />
                <div
                  className={`pain-region-highlight ${selectedPainRegion?.positionClass || ''}`}
                  style={{
                    left: `${selectedPainPoint.x * 100}%`,
                    top: `${selectedPainPoint.y * 100}%`,
                  }}
                />
                <div
                  className={`pain-click-marker ${isDraggingPainSelector ? 'dragging' : ''}`}
                  style={{
                    left: `${selectedPainPoint.x * 100}%`,
                    top: `${selectedPainPoint.y * 100}%`,
                  }}
                />
              </div>
              <div className="pain-map-details">
                <span className="pain-muscle-status">Muscle focus active</span>
                <div className="pain-map-selected">
                  <strong>Selected area:</strong> {selectedPainRegion?.label}
                </div>
                <p>{selectedPainRegion?.description}</p>
                <p className="pain-map-note">
                  This view identifies the area you selected. It does not diagnose pain or
                  recommend treatment.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {recommendationMode !== 'pain' ? (
        <div className="card recommendation-card recommendation-card-wide">
          <div className="card-header">
            <h3>
              {recommendationMode === 'data'
                ? 'Recommended from Your Monitoring Data'
                : 'Recommended for Your Posture Type'}
            </h3>
          </div>
          <div className="card-body recommendation-body recommendation-body-grid">
            {recommendationData.recommended.map((exercise, index) => (
              <button
                key={exercise.id}
                type="button"
                className={`recommendation-item ${
                  selectedExercise?.id === exercise.id ? 'active' : ''
                }`}
                onClick={() => setSelectedExercise(exercise)}
              >
                <div className="recommendation-rank">#{index + 1}</div>
                <div className="recommendation-main">
                  <div className="recommendation-title-row">
                    <ExerciseThumbnail exercise={exercise} />
                    <strong>{exercise.name}</strong>
                  </div>
                  <div className="recommendation-meta">
                    <span className="meta-badge">{exercise.category}</span>
                    <span className="meta-badge">{exercise.duration}</span>
                  </div>
                  <p>{exercise.reasons[0]}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="exercises-content">
        <div className="exercises-list">
          <div className="card">
            <div className="card-header">
              <h3>
                {recommendationMode === 'pain' && selectedPainRegion
                  ? `Exercises for ${selectedPainRegion.label}`
                  : recommendationMode === 'posture' && selectedPostureType
                  ? `Exercises for ${selectedPostureType.label}`
                  : 'Available Exercises'}
              </h3>
            </div>
            <div className="card-body list-body">
              {visibleExercises.map((exercise, index) => (
                <div
                  key={exercise.id}
                  className={`exercise-list-item ${
                    selectedExercise?.id === exercise.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedExercise(exercise)}
                >
                  <ExerciseThumbnail exercise={exercise} />
                  <div className="list-item-info">
                    <div className="list-item-name">
                      {exercise.name}
                      {((recommendationMode === 'pain' && selectedPainRegion) ||
                        (recommendationMode === 'posture' && selectedPostureType)) &&
                      index === 0 ? (
                        <span className="top-exercise-badge">Most effective</span>
                      ) : null}
                    </div>
                    <div className="list-item-meta">
                      <span className="meta-badge">{exercise.category}</span>
                      <span className="meta-badge">{exercise.duration}</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    className="list-item-checkbox"
                    checked={data.completedIds.includes(exercise.id)}
                    onChange={() => handleMarkComplete(exercise.id)}
                    onClick={(event) => event.stopPropagation()}
                    disabled={isUpdating}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="exercise-detail">
          {selectedExercise ? (
            <div className="card">
              <div className="card-header">
                <h3>{selectedExercise.name}</h3>
              </div>
              <div className="card-body detail-body">
                <div className="detail-header">
                  <ExerciseMotion exercise={selectedExercise} large />
                  <div className="detail-meta">
                    <div className="detail-meta-item">
                      <span className="meta-label">Duration</span>
                      <span className="meta-value">{selectedExercise.duration}</span>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">Difficulty</span>
                      <span className="meta-value">{selectedExercise.difficulty}</span>
                    </div>
                    <div className="detail-meta-item">
                      <span className="meta-label">Category</span>
                      <span className="meta-value">{selectedExercise.category}</span>
                    </div>
                  </div>
                </div>

                {recommendationMode !== 'pain' ? (
                  <div className="detail-section">
                    <h4>Why it is recommended</h4>
                    <div className="benefits-list">
                      {(recommendationData.recommended.find(
                        (item) => item.id === selectedExercise.id
                      )?.reasons || ['A solid posture-support exercise for desk workers.']).map(
                        (reason) => (
                          <div key={reason} className="benefit-item">
                            <span className="benefit-icon">OK</span>
                            <span>{reason}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="detail-section detail-overview-section">
                  <h4>Overview</h4>
                  <p>{selectedExercise.description}</p>
                </div>

                <div className="detail-section detail-steps-section">
                  <h4>Step-by-Step Instructions</h4>
                  <ol className="instructions-list">
                    {selectedExercise.instructions.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                <button
                  className={`complete-btn ${
                    data.completedIds.includes(selectedExercise.id) ? 'completed' : ''
                  }`}
                  onClick={() => handleMarkComplete(selectedExercise.id)}
                  disabled={isUpdating}
                >
                  {data.completedIds.includes(selectedExercise.id)
                    ? 'Completed'
                    : 'Mark as Complete'}
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Select an exercise"
              message="Choose an exercise from the list to view details."
            />
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Today&apos;s Progress</h3>
        </div>
        <div className="card-body progress-body">
          <div className="progress-stat">
            <div className="progress-label">Exercises Completed</div>
            <div className="progress-value">
              {data.completedIds.length} / {data.exercises.length}
            </div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-full">
              <div
                className="progress-bar-filled"
                style={{ width: `${(data.completedIds.length / data.exercises.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Exercises;
