import { SHAPE_CONFIG } from '../config.js';

export function createPlanetTargets(count, radius) {
  const cfg = SHAPE_CONFIG.planet;
  const bodyCount = Math.floor(count * cfg.bodyRatio);
  const ringCount = count - bodyCount;
  const targets = new Float32Array(count * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));

  // 星球主体：Fibonacci 球面 + 表面起伏
  for (let i = 0; i < bodyCount; i++) {
    const y = 1 - (i / (bodyCount - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = phi * i;

    const surfaceNoise =
      1.0 +
      Math.sin(theta * 14) * 0.06 +
      Math.sin(y * 10) * 0.05 +
      Math.sin(theta * 5 + y * 7) * 0.04;

    const r = radius * (0.68 + Math.random() * 0.32) * surfaceNoise;

    targets[i * 3] = Math.cos(theta) * radiusAtY * r;
    targets[i * 3 + 1] = y * r;
    targets[i * 3 + 2] = Math.sin(theta) * radiusAtY * r;
  }

  // 行星环：赤道面扁平分布
  for (let i = 0; i < ringCount; i++) {
    const angle = (i / ringCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
    const ringR = radius * (cfg.ringInner + Math.random() * cfg.ringWidth);
    const height = (Math.random() - 0.5) * cfg.ringThickness;

    targets[(bodyCount + i) * 3] = Math.cos(angle) * ringR;
    targets[(bodyCount + i) * 3 + 1] = height;
    targets[(bodyCount + i) * 3 + 2] = Math.sin(angle) * ringR * 0.28;
  }

  return targets;
}
