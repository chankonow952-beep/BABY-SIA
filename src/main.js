import './styles.css';
import { createScene } from './scene/createScene.js';
import { ParticleSystem } from './particles/ParticleSystem.js';
import { createShapeTargets } from './shapes/createShapeTargets.js';
import { OrbitingHearts } from './shapes/heartOrbit.js';
import { IntroHeartBurst } from './shapes/introHeartBurst.js';
import { PointerController } from './interaction/PointerController.js';
import { AnimationLoop } from './animation/AnimationLoop.js';
import { StateMachine, State } from './state/StateMachine.js';
import { GestureRecognizer, Gesture } from './gesture/GestureRecognizer.js';
import { PARTICLE_CONFIG, STATE_TIMING, GESTURE_CONFIG, detectPerfTier, PERF_TIER } from './config.js';

const canvas = document.querySelector('#experience');
const perfTier = detectPerfTier();
const particleCount = PERF_TIER[perfTier].count;

const sceneView = createScene(canvas, { performanceTier: perfTier });
const pointer = new PointerController(canvas, sceneView.camera);
const targets = createShapeTargets(particleCount);
const particles = new ParticleSystem({
  count: particleCount,
  scene: sceneView.scene,
  targets,
});
const orbitingHearts = new OrbitingHearts(sceneView.scene);
const introBurst = new IntroHeartBurst(sceneView.scene);
const stateMachine = new StateMachine();
const gestureRecognizer = new GestureRecognizer();

let gestureThrottle = 0;
const GESTURE_INTERVAL = GESTURE_CONFIG.detectInterval;

function applyState(state) {
  switch (state) {
    case State.INTRO_TEXT:
      particles.setTargets(
        targets.introText,
        PARTICLE_CONFIG.morph.intro,
        'static',
      );
      orbitingHearts.setVisible(false);
      introBurst.setVisible(true);
      break;

    case State.FISH_SCHOOL:
      particles.setTargets(
        targets.bigHeart,
        PARTICLE_CONFIG.morph.fishSchool,
        'fishSchool',
      );
      orbitingHearts.setVisible(false);
      introBurst.setVisible(false);
      break;

    case State.EXPLOSION:
      // bloom 模式：bigHeart 为基础，每帧根据手掌开合度在基础与散射间插值
      particles.setTargets(
        targets.bigHeart,
        PARTICLE_CONFIG.morph.explosion,
        'explosion',
      );
      orbitingHearts.setVisible(false);
      introBurst.setVisible(false);
      break;

    case State.FIST_COMPACT:
      // 爱心主体（60%）跟随 pointer，"我爱你"（40%）固定上方
      particles.setTargets(
        targets.smallHeart,
        PARTICLE_CONFIG.morph.compactHeart,
        'compactHeart',
      );
      particles.setCompactTextTargets(targets.loveText);
      orbitingHearts.setVisible(false);
      introBurst.setVisible(false);
      break;

    case State.BAIT_BALL:
      particles.setTargets(
        new Float32Array(particleCount * 3),
        PARTICLE_CONFIG.morph.baitBall,
        'baitBall',
      );
      orbitingHearts.setVisible(false);
      introBurst.setVisible(false);
      break;
  }
}

// 初始：显示 intro 文字，introDuration 后自动切球型
applyState(State.INTRO_TEXT);
stateMachine.startIntro();

stateMachine.onTransition = (newState) => {
  applyState(newState);
};

// 异步初始化手势识别（不阻塞首屏渲染）
gestureRecognizer.init().then((ok) => {
  if (!ok) {
    console.warn('摄像头不可用，保留鼠标/触摸交互，自动切换球型模式');
  }
});

// ===== Debug 面板 =====
const debugPanel = document.querySelector('#debug-panel');
const dbGesture = document.querySelector('#dbGesture');
const dbConf = document.querySelector('#dbConf');
const dbState = document.querySelector('#dbState');
const dbStable = document.querySelector('#dbStable');
const dbTrig = document.querySelector('#dbTrig');

// ===== 手势说明面板 =====
const gestureGuide = document.querySelector('#gesture-guide');
let guideVisible = true;

// 8 秒后自动隐藏手势说明
setTimeout(() => {
  if (guideVisible) {
    guideVisible = false;
    gestureGuide.classList.add('hidden');
  }
}, 8000);

let debugVisible = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    debugVisible = !debugVisible;
    debugPanel.style.display = debugVisible ? 'block' : 'none';
  }
  if (e.key === 'h' || e.key === 'H') {
    guideVisible = !guideVisible;
    gestureGuide.classList.toggle('hidden', !guideVisible);
  }
});

function updateDebug() {
  if (!debugVisible) return;
  const d = stateMachine.debug;
  dbGesture.textContent = d.gesture;
  dbConf.textContent = (d.confidence * 100).toFixed(0) + '%';
  dbState.textContent = d.state;
  dbStable.textContent = d.stableMs.toFixed(0);
  dbTrig.textContent = d.triggered ? 'YES' : '-';
}

const loop = new AnimationLoop({
  update: (time, delta) => {
    // 手势检测（节流）—— 先于 pointer.update()，使手部位置及时传入
    gestureThrottle += delta;
    if (
      gestureRecognizer.enabled &&
      gestureThrottle >= GESTURE_INTERVAL
    ) {
      gestureThrottle = 0;
      const result = gestureRecognizer.detect();

      // 手势 NDC 传入 PointerController，驱动粒子跟随手部位置
      if (result.handNdc) {
        pointer.setGestureNdc(result.handNdc);
      }

      // 连续 bloom：OPEN_PALM 时根据开合度实时驱动粒子散开
      if (result.gesture === Gesture.OPEN_PALM) {
        particles.bloomOpenness = result.openness;
      } else {
        // 非张开状态逐渐收回
        particles.bloomOpenness *= 0.92;
      }

      const newState = stateMachine.evaluateGesture(result);
      if (newState) {
        applyState(newState);
      }
    }

    pointer.update(delta);
    particles.update(time, delta, pointer);
    orbitingHearts.update(time, delta);
    introBurst.update(time);
    sceneView.update(time, delta);

    updateDebug();
  },
  render: () => sceneView.render(),
});

window.addEventListener('resize', () => {
  sceneView.resize();
  pointer.resize();
});

loop.start();
