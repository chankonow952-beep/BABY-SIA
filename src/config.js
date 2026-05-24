export const State = {
  INTRO_TEXT: 'INTRO_TEXT',
  FISH_SCHOOL: 'FISH_SCHOOL',
  EXPLOSION: 'EXPLOSION',
  FIST_COMPACT: 'FIST_COMPACT',
  BAIT_BALL: 'BAIT_BALL',
};

export const PARTICLE_CONFIG = {
  count: 6000,
  bounds: {
    x: 11,
    y: 6.2,
    z: 4.2,
  },
  morph: {
    free: 0.018,
    text: 0.035,
    symbol: 0.032,
    intro: 0.028,
    idleHeart: 0.026,
    bigHeart: 0.030,
    smallHeart: 0.042,
    fishSchool: 0.048,
    explosion: 0.120,
    compactHeart: 0.095,
    baitBall: 0.160,
  },
  damping: 0.82,
  transitionDuration: 0.55,
  pointerRadius: 1.7,
  pointerForce: 0.010,
};

export const VISUAL_CONFIG = {
  cameraZ: 10.5,
  pixelRatio: 1.5,
  bloomStrength: 0.18,
  bloomRadius: 0.50,
  bloomThreshold: 0.10,
};

// ===== 文字内容配置（修改文字改这里） =====
export const TEXT_CONFIG = {
  intro: 'Hi 赛赛宝贝！',
  love: '我爱你',
};

// ===== 状态切换时序（修改防抖/冷却/延迟改这里） =====
export const STATE_TIMING = {
  introDuration: 3.0,
  debounceMs: 140,
  cooldownMs: 250,
  lossDelayMs: 450,
};

// ===== 形状参数（修改大小/密度/速度改这里） =====
export const SHAPE_CONFIG = {
  idleHeart: {
    width: 7.5,
    height: 6.5,
    rotationSpeed: 0.22,
  },
  smallHeart: {
    width: 3.2,
    height: 2.8,
  },
  bigHeart: {
    width: 10.5,
    height: 9.0,
  },
  orbitHeart: {
    count: 14,
    particleCount: 28,
    radius: 4.0,
    speed: 0.22,
  },
  introText: {
    width: 14.0,
    height: 4.4,
  },
  loveText: {
    width: 9.5,
    height: 4.0,
  },
};

// ===== 鱼群 milling 动画参数 =====
export const FISH_SCHOOL_CONFIG = {
  rotationSpeed: 0.10,
  driftStrength: 0.14,
  driftFrequency: 0.28,
  flowSpeed: 0.0012,
  neighborRadius: 1.8,
  alignmentWeight: 0.15,
  cohesionWeight: 0.70,
};

// ===== 炸裂动画参数 =====
export const EXPLOSION_CONFIG = {
  expansionMin: 2.5,
  expansionMax: 7.5,
  spiralArms: 5,
  spiralStrength: 1.2,
  clusterCount: 14,
  clusterHeartSize: 2.2,
  duration: 1.8,
};

// ===== 诱饵球动画参数 =====
export const BAIT_BALL_CONFIG = {
  orbitRadiusMin: 0.20,
  orbitRadiusMax: 1.40,
  orbitSpeedMin: 0.80,
  orbitSpeedMax: 2.80,
  trailCount: 6,
  trailSpacing: 0.55,
  trailHeartSize: 1.5,
  coreTightness: 0.75,
};

// ===== 性能分级（根据设备能力自动调整） =====
export const PERF_TIER = {
  high: {
    count: 8000,
    pixelRatio: 2.0,
    useComposer: true,
    useBloom: true,
  },
  medium: {
    count: 6000,
    pixelRatio: 1.5,
    useComposer: true,
    useBloom: true,
  },
  low: {
    count: 4000,
    pixelRatio: 1.0,
    useComposer: false,
    useBloom: false,
  },
};

export function detectPerfTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const dpr = window.devicePixelRatio || 1;
  const memory = navigator.deviceMemory || 4;

  if (cores <= 4 || dpr <= 1 || memory <= 4) return 'low';
  if (cores <= 8 || dpr <= 1.5 || memory <= 8) return 'medium';
  return 'high';
}

// ===== 手势识别参数（调整识别灵敏度改这里） =====
export const GESTURE_CONFIG = {
  // 最低置信度阈值：低于此值不触发手势识别
  minConfidence: 0.33,
  // 手势检测节流间隔（秒），越小越灵敏但更耗性能
  detectInterval: 0.05,
  // 单手比心：拇指尖(4)与食指尖(8)距离阈值
  // 值越大越宽松，值越小越严格
  heartFinger: {
    thumbIndexMaxDist: 0.12,
    // 其余手指弯曲判定：tip.y > pip.y + curlMin 表示弯曲
    otherFingerCurlMin: 0.01,
  },
  // 张开手掌：指尖需在关节上方多少
  // 值越大要求手指越直，值越小越宽松
  openPalm: {
    fingerExtensionMin: 0.02,
  },
  // 握拳：指尖需在关节下方多少
  // 值越大要求握得越紧，值越小越宽松
  fist: {
    fingerCurlMin: 0.01,
    thumbCloseToPalmMax: 0.28,
  },
};

// ===== Intro 闪烁爱心参数 =====
export const INTRO_BURST_CONFIG = {
  heartCount: 55,
  particlesPerHeart: 20,
  orbitRadius: 6.5,
  orbitSpeed: 0.55,
  heartScaleMin: 0.22,
  heartScaleMax: 0.92,
};

// ===== 爆炸中心爱心参数 =====
export const CENTER_HEART_CONFIG = {
  coreRatio: 0.18,
  coreScale: 0.78,
  pulseSpeed: 2.6,
  pulseAmp: 0.04,
};

// ===== 握拳爱心参数 =====
export const COMPACT_HEART_CONFIG = {
  heartRatio: 0.60,
  beatSpeed: 2.2,
  beatAmp: 0.045,
};
