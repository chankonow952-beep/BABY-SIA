import { GESTURE_CONFIG } from '../config.js';

export const Gesture = {
  NONE: 'NONE',
  HEART_FINGER: 'HEART_FINGER',
  OPEN_PALM: 'OPEN_PALM',
  FIST: 'FIST',
};

// 关键点 EMA 平滑：alpha 越大越灵敏，越小越平滑
const SMOOTH_ALPHA = 0.38;
// 手势置信度阈值：低于此值视为无效手势
const CONFIDENCE_MIN = 0.32;

function lerp3(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t };
}

export class GestureRecognizer {
  constructor() {
    this.handLandmarker = null;
    this.video = null;
    this.stream = null;
    this.ready = false;
    this.enabled = false;
    this.smoothed = null;          // EMA 平滑后的 21 个关键点
    this.lastGesture = Gesture.NONE;
    this.lastConfidence = 0;
  }

  async init() {
    try {
      const { HandLandmarker, FilesetResolver } = await import(
        '@mediapipe/tasks-vision'
      );

      this.video = document.createElement('video');
      this.video.setAttribute('playsinline', '');
      this.video.setAttribute('muted', '');
      this.video.style.cssText =
        'position:fixed;top:0;left:0;width:4px;height:3px;opacity:0.01;pointer-events:none;z-index:-1;';
      document.body.appendChild(this.video);

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm',
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task',
        },
        runningMode: 'VIDEO',
        numHands: 1,
      });

      this.ready = true;
      this.enabled = true;
      return true;
    } catch (e) {
      console.warn('Gesture recognizer unavailable:', e.message);
      this.ready = false;
      this.enabled = false;
      return false;
    }
  }

  // 返回 { gesture, confidence } — gesture 为 Gesture 枚举，confidence 0~1
  detect() {
    if (!this.ready || !this.handLandmarker) {
      return { gesture: Gesture.NONE, confidence: 0 };
    }

    try {
      const now = performance.now();
      const results = this.handLandmarker.detectForVideo(this.video, now);

      if (!results.landmarks || results.landmarks.length === 0) {
        this.smoothed = null;
        this.lastGesture = Gesture.NONE;
        this.lastConfidence = 0;
        return { gesture: Gesture.NONE, confidence: 0, openness: 0, handNdc: null };
      }

      const raw = results.landmarks[0];
      this.smoothed = this.smoothLandmarks(raw);
      const result = this.classify(this.smoothed);

      // 连续开合度：OPEN_PALM 时用置信度表示手掌张开程度
      const openness =
        result.gesture === Gesture.OPEN_PALM ? result.confidence : 0;

      this.lastGesture = result.gesture;
      this.lastConfidence = result.confidence;

      // 手腕 NDC 坐标：用于 PointerController 跟踪手部位置
      const wrist = this.smoothed[0];
      const handNdc = {
        x: -(wrist.x * 2 - 1),  // 镜像校正
        y: -(wrist.y * 2 - 1),
      };

      return { gesture: result.gesture, confidence: result.confidence, openness, handNdc };
    } catch {
      return { gesture: Gesture.NONE, confidence: 0, openness: 0, handNdc: null };
    }
  }

  // EMA 平滑：减少手部关键点抖动
  smoothLandmarks(raw) {
    if (!this.smoothed) return raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));

    const smoothed = [];
    for (let i = 0; i < raw.length; i++) {
      smoothed.push(lerp3(this.smoothed[i], raw[i], SMOOTH_ALPHA));
    }
    return smoothed;
  }

  classify(lm) {
    // 按优先级依次判断，取置信度最高的
    const results = [];

    const hf = this.evalHeartFinger(lm);
    if (hf.confidence >= CONFIDENCE_MIN) results.push({ ...hf, type: Gesture.HEART_FINGER });

    const op = this.evalOpenPalm(lm);
    if (op.confidence >= CONFIDENCE_MIN) results.push({ ...op, type: Gesture.OPEN_PALM });

    const fi = this.evalFist(lm);
    if (fi.confidence >= CONFIDENCE_MIN) results.push({ ...fi, type: Gesture.FIST });

    if (results.length === 0) {
      return { gesture: Gesture.NONE, confidence: 0 };
    }

    // 按优先级排序：比心 > 张开手掌 > 握拳
    const priority = { HEART_FINGER: 4, OPEN_PALM: 3, FIST: 2 };
    results.sort((a, b) => {
      const pa = priority[a.type] || 0;
      const pb = priority[b.type] || 0;
      if (pa !== pb) return pb - pa;
      return b.confidence - a.confidence;
    });

    return { gesture: results[0].type, confidence: results[0].confidence };
  }

  /* ===== 单手比心置信度 =====
   *   - 拇指尖(4)与食指尖(8)距离越近，置信度越高
   *   - 其余三指弯曲程度越高，置信度越高
   *   - 食指指向偏上方时为加分项（比心时食指通常竖起）
   */
  evalHeartFinger(lm) {
    const cfg = GESTURE_CONFIG.heartFinger;

    const pinchDist = this.dist(lm[4], lm[8]);
    const pinchScore = 1 - Math.min(1, pinchDist / cfg.thumbIndexMaxDist);

    const curlFingers = [
      { tip: 12, pip: 10 },
      { tip: 16, pip: 14 },
      { tip: 20, pip: 18 },
    ];
    let curlScore = 0;
    for (const f of curlFingers) {
      const c = (lm[f.tip].y - lm[f.pip].y - cfg.otherFingerCurlMin) / 0.08;
      curlScore += Math.min(1, Math.max(0, c));
    }
    curlScore /= curlFingers.length;

    // 食指竖起加分：指尖在 MCP 上方
    const indexUp = lm[8].y < lm[5].y ? 1.0 : 0.5;
    // 拇指屈曲加分：拇指尖与拇指 IP 关节(3)的 y 偏移
    const thumbBent = lm[4].y > lm[3].y ? 1.0 : 0.6;

    const confidence = pinchScore * 0.45 + curlScore * 0.35 + indexUp * 0.10 + thumbBent * 0.10;
    return { confidence: Math.min(1, confidence) };
  }

  /* ===== 张开手掌置信度 =====
   *   - 五指伸展程度
   *   - 手指间张开距离（splay）
   */
  evalOpenPalm(lm) {
    const cfg = GESTURE_CONFIG.openPalm;
    let extScore = 0;

    // 拇指水平伸展
    const thumbExt = Math.abs(lm[4].x - lm[2].x);
    extScore += Math.min(1, thumbExt / (cfg.fingerExtensionMin * 3));

    const fingers = [
      { tip: 8, pip: 6 },
      { tip: 12, pip: 10 },
      { tip: 16, pip: 14 },
      { tip: 20, pip: 18 },
    ];
    for (const f of fingers) {
      const ext = (lm[f.pip].y - lm[f.tip].y - cfg.fingerExtensionMin) / 0.06;
      extScore += Math.min(1, Math.max(0, ext));
    }
    extScore /= 5;

    // 手指间张开距离：指尖间距越大表示越伸展
    const splayPairs = [[8, 12], [12, 16], [16, 20]];
    let splayScore = 0;
    for (const [a, b] of splayPairs) {
      splayScore += Math.min(1, this.dist(lm[a], lm[b]) / 0.08);
    }
    splayScore /= splayPairs.length;

    const confidence = extScore * 0.65 + splayScore * 0.35;
    return { confidence: Math.min(1, confidence) };
  }

  /* ===== 握拳置信度 =====
   *   - 四指蜷缩程度
   *   - 拇指靠近掌心程度
   *   - 指尖靠近手腕 = 更紧的拳头
   */
  evalFist(lm) {
    const cfg = GESTURE_CONFIG.fist;
    let curlScore = 0;

    const fingers = [
      { tip: 8, pip: 6 },
      { tip: 12, pip: 10 },
      { tip: 16, pip: 14 },
      { tip: 20, pip: 18 },
    ];
    for (const f of fingers) {
      const c = (lm[f.tip].y - lm[f.pip].y - cfg.fingerCurlMin) / 0.08;
      curlScore += Math.min(1, Math.max(0, c));
    }
    curlScore /= fingers.length;

    // 拇指靠近中指 MCP 关节(9)
    const thumbClose = 1 - Math.min(1, this.dist(lm[4], lm[9]) / cfg.thumbCloseToPalmMax);

    // 指尖靠近手腕：拳头越紧，指尖离手腕越近
    let tightScore = 0;
    for (const f of fingers) {
      tightScore += 1 - Math.min(1, this.dist(lm[f.tip], lm[0]) / 0.45);
    }
    tightScore /= fingers.length;

    const confidence = curlScore * 0.45 + thumbClose * 0.30 + tightScore * 0.25;
    return { confidence: Math.min(1, confidence) };
  }

  dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = (a.z || 0) - (b.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  dispose() {
    this.enabled = false;
    this.ready = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.video && this.video.parentNode) {
      this.video.remove();
      this.video = null;
    }
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }
}
