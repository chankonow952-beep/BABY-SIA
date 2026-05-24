import * as THREE from 'three';
import { PARTICLE_CONFIG, FISH_SCHOOL_CONFIG, EXPLOSION_CONFIG, BAIT_BALL_CONFIG, CENTER_HEART_CONFIG, COMPACT_HEART_CONFIG } from '../config.js';

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute vec4 aSeed;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vDepth;
  uniform float uTime;

  void main() {
    // 呼吸 + 漂浮 — 从 CPU 迁移至 GPU
    float breathing = sin(uTime * (0.22 + aSeed.w * 0.14) + aSeed.x) * 0.10;
    vec3 wobble = vec3(
      sin(uTime * 0.14 + aSeed.x) * 0.045,
      cos(uTime * 0.12 + aSeed.z) * 0.045,
      breathing
    );
    vec3 displaced = position + wobble;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    float depth = -mvPosition.z;
    float depthScale = 1.0 / max(0.18, depth * 0.08);
    gl_PointSize = aSize * depthScale * 7.2;
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = aAlpha;
    vColor = aColor;
    vDepth = depth;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vDepth;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    float core = smoothstep(0.40, 0.0, radius);
    float midGlow = smoothstep(0.56, 0.20, radius) * 0.14;
    float outerHalo = smoothstep(0.70, 0.36, radius) * 0.06;
    float alpha = (core + midGlow + outerHalo) * vAlpha;

    if (alpha < 0.004) {
      discard;
    }

    float depthNorm = clamp((vDepth - 7.5) / 5.5, 0.0, 1.0);

    vec3 palePink    = vec3(1.0, 0.88, 0.92);
    vec3 richRose    = vec3(0.95, 0.38, 0.48);
    vec3 deepCrimson = vec3(0.82, 0.16, 0.28);

    vec3 nearTinted = mix(vColor, palePink,    0.32);
    vec3 midTinted  = mix(vColor, richRose,    0.38);
    vec3 farTinted  = mix(vColor, deepCrimson, 0.48);

    vec3 depthColor = depthNorm < 0.5
      ? mix(nearTinted, midTinted, depthNorm * 2.0)
      : mix(midTinted,  farTinted,  (depthNorm - 0.5) * 2.0);

    float brightness = mix(1.06, 0.72, depthNorm);

    gl_FragColor = vec4(depthColor * brightness, alpha);
  }
`;

const MORPH_UPDATERS = {
  fishSchool: updateFishSchoolTargets,
  explosion: updateExplosionTargets,
  compactHeart: updateCompactHeartTargets,
  baitBall: updateBaitBallTargets,
};

const FLOW_FNS = {
  free: flowFree,
  fishSchool: flowFishSchool,
  compactHeart: flowCompactHeart,
  baitBall: flowBaitBall,
};

export class ParticleSystem {
  constructor({ count, scene, targets }) {
    this.count = count;
    this.targets = targets;
    this.mode = 'free';
    this.bounds = PARTICLE_CONFIG.bounds;
    this.transitionProgress = 1;
    this.transitionDuration = PARTICLE_CONFIG.transitionDuration;
    this.currentMorphSpeed = PARTICLE_CONFIG.morph.free;
    this.currentMorphType = 'free';
    this.sphereBaseTargets = null;
    this.compactTextBase = null;
    this.compactHeartRatio = COMPACT_HEART_CONFIG.heartRatio;

    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.freeTargets = new Float32Array(count * 3);
    this.activeTargets = new Float32Array(count * 3);
    this.transitionFrom = new Float32Array(count * 3);
    this.seeds = new Float32Array(count * 4);
    this.sizes = new Float32Array(count);
    this.alphas = new Float32Array(count);
    this.colors = new Float32Array(count * 3);

    this._morphUpdateFn = null;
    this._flowFn = FLOW_FNS.free;

    this.bloomOpenness = 0;
    this.bloomBaseTargets = null;
    this.bloomScatterTargets = null;

    this.createInitialData();
    this.geometry = this.createGeometry();
    this.material = this.createMaterial();
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  createInitialData() {
    for (let i = 0; i < this.count; i += 1) {
      const index = i * 3;
      const point = this.randomFreePoint(i);

      this.positions[index] = point.x;
      this.positions[index + 1] = point.y;
      this.positions[index + 2] = point.z;

      this.freeTargets[index] = point.x;
      this.freeTargets[index + 1] = point.y;
      this.freeTargets[index + 2] = point.z;

      this.activeTargets[index] = point.x;
      this.activeTargets[index + 1] = point.y;
      this.activeTargets[index + 2] = point.z;

      this.seeds[i * 4] = Math.random() * Math.PI * 2;
      this.seeds[i * 4 + 1] = 0.45 + Math.random() * 0.85;
      this.seeds[i * 4 + 2] = Math.random() * Math.PI * 2;
      this.seeds[i * 4 + 3] = 0.35 + Math.random() * 0.75;

      this.sizes[i] = 0.55 + Math.random() * 1.65;
      this.alphas[i] = 0.20 + Math.random() * 0.44;

      const color = this.pickColor(Math.random());
      this.colors[index] = color.r;
      this.colors[index + 1] = color.g;
      this.colors[index + 2] = color.b;
    }
  }

  createGeometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    geometry.setAttribute('aColor', new THREE.BufferAttribute(this.colors, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(this.seeds, 4));
    return geometry;
  }

  createMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  setTargets(targetArray, morphSpeed, morphType = 'static') {
    this.captureTransitionStart();
    this.transitionProgress = 0;
    this.activeTargets.set(targetArray);
    this.currentMorphSpeed = morphSpeed;
    this.currentMorphType = morphType;

    this._morphUpdateFn = MORPH_UPDATERS[morphType] || null;
    this._flowFn = FLOW_FNS[morphType] || null;

    const needsSphereBase =
      morphType === 'fishSchool' || morphType === 'compactHeart';

    if (needsSphereBase) {
      if (!this.sphereBaseTargets) {
        this.sphereBaseTargets = new Float32Array(targetArray.length);
      }
      this.sphereBaseTargets.set(targetArray);
    }

    if (morphType === 'explosion') {
      if (!this.bloomBaseTargets) {
        this.bloomBaseTargets = new Float32Array(targetArray.length);
      }
      this.bloomBaseTargets.set(targetArray);
      this.bloomScatterTargets = computeBloomScatter(this, targetArray);
      this.transitionProgress = 1;
      this.bloomOpenness = 0;
    }
  }

  setCompactTextTargets(textArray) {
    if (!this.compactTextBase) {
      this.compactTextBase = new Float32Array(textArray.length);
    }
    this.compactTextBase.set(textArray);
  }

  update(time, delta, pointer) {
    const targetEase = this.currentMorphSpeed;
    const damping = Math.pow(PARTICLE_CONFIG.damping, delta * 60);
    const pointerRadiusSq = pointer.radius * pointer.radius;
    this.transitionProgress = Math.min(
      1,
      this.transitionProgress + delta / this.transitionDuration,
    );
    const transitionEase = easeInOutCubic(this.transitionProgress);

    this.material.uniforms.uTime.value = time;

    if (this._morphUpdateFn) {
      this._morphUpdateFn(this, time, pointer);
    }

    const flowFn = this._flowFn;
    const isFree = this.currentMorphType === 'free';
    const isBaitBall = this.currentMorphType === 'baitBall';
    const isDynamic = isBaitBall || this.currentMorphType === 'explosion';

    const morphEase = isDynamic ? 1.0 : transitionEase;

    for (let i = 0; i < this.count; i += 1) {
      const index = i * 3;
      const seedIndex = i * 4;
      const seedA = this.seeds[seedIndex];

      if (isFree) {
        this.updateFreeTarget(index, time, seedA,
          this.seeds[seedIndex + 1], this.seeds[seedIndex + 2], this.seeds[seedIndex + 3]);
      }

      const tx =
        this.transitionFrom[index] +
        (this.activeTargets[index] - this.transitionFrom[index]) * morphEase;
      const ty =
        this.transitionFrom[index + 1] +
        (this.activeTargets[index + 1] - this.transitionFrom[index + 1]) * morphEase;
      const tz =
        this.transitionFrom[index + 2] +
        (this.activeTargets[index + 2] - this.transitionFrom[index + 2]) * morphEase;

      let px = this.positions[index];
      let py = this.positions[index + 1];
      let pz = this.positions[index + 2];

      let vx = this.velocities[index];
      let vy = this.velocities[index + 1];
      let vz = this.velocities[index + 2];

      vx += (tx - px) * targetEase;
      vy += (ty - py) * targetEase;
      vz += (tz - pz) * targetEase;

      const dx = px - pointer.world.x;
      const dy = py - pointer.world.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < pointerRadiusSq && pointer.strength > 0.002 && !isBaitBall) {
        const distance = Math.sqrt(distanceSq) + 0.001;
        const normalized = distance / pointer.radius;
        const influence = 1 - normalized;
        const repel = influence * influence * 0.7;
        const ringAttraction = Math.sin(normalized * Math.PI) * 0.18;
        const directionForce = pointer.isDown ? -repel * 0.55 : repel - ringAttraction;
        const force = pointer.strength * PARTICLE_CONFIG.pointerForce;
        const nx = dx / distance;
        const ny = dy / distance;
        const swirl = (1 - normalized) * pointer.strength * 0.0025;

        vx += nx * force * directionForce - ny * swirl + pointer.velocity.x * 0.0005;
        vy += ny * force * directionForce + nx * swirl + pointer.velocity.y * 0.0005;
        vz += Math.sin(seedA + time) * force * influence * 0.22;
      }

      if (flowFn) {
        flowFn(this, i, px, py, pz, time);
      }

      vx *= damping;
      vy *= damping;
      vz *= damping;

      px += vx * delta * 60;
      py += vy * delta * 60;
      pz += vz * delta * 60;

      this.velocities[index] = vx;
      this.velocities[index + 1] = vy;
      this.velocities[index + 2] = vz;

      this.positions[index] = px;
      this.positions[index + 1] = py;
      this.positions[index + 2] = pz;
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  updateFreeTarget(index, time, seedA, seedB, seedC, seedD) {
    const orbit = time * (0.036 + seedB * 0.014);
    const wave = Math.sin(time * 0.055 + this.freeTargets[index] * 0.2 + seedC);
    this.activeTargets[index] =
      this.freeTargets[index] + Math.sin(orbit + seedA + wave * 0.45) * 0.55 * seedD;
    this.activeTargets[index + 1] =
      this.freeTargets[index + 1] + Math.cos(orbit * 0.9 + seedC) * 0.32 * seedB;
    this.activeTargets[index + 2] =
      this.freeTargets[index + 2] + Math.sin(orbit * 0.6 + seedC + wave) * 0.28;
  }

  captureTransitionStart() {
    const easedProgress = easeInOutCubic(this.transitionProgress);

    if (this.transitionProgress >= 1) {
      this.transitionFrom.set(this.activeTargets);
      return;
    }

    for (let i = 0; i < this.transitionFrom.length; i += 1) {
      this.transitionFrom[i] =
        this.transitionFrom[i] + (this.activeTargets[i] - this.transitionFrom[i]) * easedProgress;
    }
  }

  randomFreePoint(i) {
    const t = i / this.count;
    const angle = t * Math.PI * 2 * 7.5 + Math.random() * 0.7;
    const radius = Math.sqrt(Math.random());
    const band = Math.sin(t * Math.PI * 5.0) * 0.22;

    return {
      x: Math.cos(angle) * radius * this.bounds.x * 0.48 + (Math.random() - 0.5) * 1.4,
      y: Math.sin(angle * 0.72) * radius * this.bounds.y * 0.42 + band,
      z: (Math.random() - 0.5) * this.bounds.z,
    };
  }

  pickColor(t) {
    const palette = [
      new THREE.Color('#ffe8ee'),
      new THREE.Color('#fcd0dc'),
      new THREE.Color('#f8b8c8'),
      new THREE.Color('#f4a0b4'),
      new THREE.Color('#f090a4'),
      new THREE.Color('#ec8094'),
      new THREE.Color('#e87084'),
      new THREE.Color('#e46074'),
      new THREE.Color('#e05064'),
      new THREE.Color('#dc4054'),
      new THREE.Color('#f8c4d4'),
      new THREE.Color('#fce0e8'),
      new THREE.Color('#fcc8d8'),
      new THREE.Color('#f0b0c0'),
      new THREE.Color('#e890a0'),
    ];
    return palette[Math.floor(t * palette.length) % palette.length];
  }
}

// ===== 鱼群 milling 动画 =====
function updateFishSchoolTargets(self, time) {
  const base = self.sphereBaseTargets;
  if (!base) return;
  const cfg = FISH_SCHOOL_CONFIG;
  const targets = self.activeTargets;
  const count = self.count;
  const seeds = self.seeds;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const si = i * 4;
    const bx = base[idx];
    const by = base[idx + 1];
    const bz = base[idx + 2];

    const seedA = seeds[si];
    const seedB = seeds[si + 1];
    const seedC = seeds[si + 2];
    const seedD = seeds[si + 3];
    const driftX = Math.sin(time * cfg.driftFrequency + seedA) * cfg.driftStrength * seedB;
    const driftY = Math.cos(time * cfg.driftFrequency * 0.8 + seedC) * cfg.driftStrength * 0.7 * seedB;
    const driftZ = Math.sin(time * cfg.driftFrequency * 0.6 + seedA + seedC) * cfg.driftStrength * 0.5;
    const jitterX = Math.cos(time * 0.35 + seedD) * 0.052;
    const jitterY = Math.sin(time * 0.40 + seedA + seedC) * 0.046;

    targets[idx] = bx + driftX + jitterX;
    targets[idx + 1] = by + driftY + jitterY;
    targets[idx + 2] = bz + driftZ;
  }
}

// ===== 紧实心形动画（握拳） =====
function updateCompactHeartTargets(self, time, pointer) {
  const heartBase = self.sphereBaseTargets;
  const textBase = self.compactTextBase;
  if (!heartBase) return;

  const cfg = COMPACT_HEART_CONFIG;
  const beatRaw = Math.sin(time * cfg.beatSpeed);
  const beat = Math.pow(Math.abs(beatRaw), 0.6) * Math.sign(beatRaw);
  const beatScale = 1 + beat * cfg.beatAmp;
  const targets = self.activeTargets;
  const count = self.count;
  const seeds = self.seeds;
  const heartSplit = Math.floor(count * self.compactHeartRatio);

  const ox = pointer.isActive ? pointer.world.x : 0;
  const oy = pointer.isActive ? pointer.world.y : 0;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const si = i * 4;

    if (i < heartSplit) {
      const bx = heartBase[idx];
      const by = heartBase[idx + 1];
      const bz = heartBase[idx + 2];
      const dist = Math.sqrt(bx * bx + by * by + bz * bz) + 0.01;

      const tighten = 1 - beat * 0.04 * Math.min(1, dist / 2.5);
      const scale = beatScale * tighten;

      const seedD = seeds[si + 3];
      const seedA = seeds[si];
      const seedC = seeds[si + 2];
      const shimmerX = Math.sin(time * 2.8 + dist * 1.5 + seedD) * 0.014;
      const shimmerY = Math.cos(time * 2.5 + dist * 1.3 + seedA) * 0.012;
      const shimmerZ = Math.cos(time * 2.1 + dist * 1.2 + seedC) * 0.010;

      targets[idx] = bx * scale + ox + shimmerX;
      targets[idx + 1] = by * scale + oy + shimmerY;
      targets[idx + 2] = bz * scale + shimmerZ;
    } else if (textBase) {
      const ti = i - heartSplit;
      const tLen = textBase.length / 3;
      const tIdx = (ti % Math.floor(tLen)) * 3;

      const seedD = seeds[si + 3];
      const seedA = seeds[si];
      const subtleX = Math.sin(time * 1.8 + seedD) * 0.008;
      const subtleY = Math.cos(time * 1.6 + seedA) * 0.006;
      const subtleZ = Math.sin(time * 1.4 + seedD + seedA) * 0.005;

      targets[idx] = textBase[tIdx] + subtleX;
      targets[idx + 1] = textBase[tIdx + 1] + subtleY;
      targets[idx + 2] = textBase[tIdx + 2] + subtleZ;
    }
  }
}

// ===== 诱饵球动画 =====
function updateBaitBallTargets(self, time, pointer) {
  const cfg = BAIT_BALL_CONFIG;
  const targets = self.activeTargets;
  const count = self.count;
  const seeds = self.seeds;
  const cx = pointer.world.x;
  const cy = pointer.world.y;

  const vx = pointer.velocity.x;
  const vy = pointer.velocity.y;
  const speed = Math.sqrt(vx * vx + vy * vy) + 0.001;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const si = i * 4;
    const seedA = seeds[si];
    const seedB = seeds[si + 1];
    const seedC = seeds[si + 2];
    const seedD = seeds[si + 3];

    if (i < count * 0.75) {
      const orbitRadius = cfg.orbitRadiusMin + seedB * (cfg.orbitRadiusMax - cfg.orbitRadiusMin);
      const orbitSpeed = cfg.orbitSpeedMin + seedC * (cfg.orbitSpeedMax - cfg.orbitSpeedMin);
      const angle = seedA + time * orbitSpeed;
      const phi = (seedD - 0.5) * Math.PI;

      targets[idx] = cx + Math.cos(angle) * Math.cos(phi) * orbitRadius;
      targets[idx + 1] = cy + Math.sin(angle) * Math.cos(phi) * orbitRadius * 0.7;
      targets[idx + 2] = Math.sin(phi) * orbitRadius * 0.5;
    } else {
      const trailIdx = i - Math.floor(count * 0.75);
      const trailTotal = count - Math.floor(count * 0.75);
      const trailT = trailIdx / trailTotal;
      const trailDist = (trailT + 0.2) * cfg.trailSpacing * (1 + speed * 0.5);

      const nx = speed > 0.01 ? -vx / speed : 0;
      const ny = speed > 0.01 ? -vy / speed : -1;
      const trailX = cx + nx * trailDist;
      const trailY = cy + ny * trailDist;

      const heartAngle = trailT * Math.PI * 2;
      const hx = 16 * Math.sin(heartAngle) ** 3;
      const hy = 13 * Math.cos(heartAngle) -
        5 * Math.cos(2 * heartAngle) -
        2 * Math.cos(3 * heartAngle) -
        Math.cos(4 * heartAngle);
      const hs = cfg.trailHeartSize * 0.018;

      const jitter = 0.06 + trailT * 0.15;
      targets[idx] = trailX + hx * hs + (seedB - 0.5) * jitter;
      targets[idx + 1] = trailY + hy * hs + (seedC - 0.5) * jitter;
      targets[idx + 2] = (seedD - 0.5) * jitter * 0.5;
    }
  }
}

// ===== bloom 散开目标预计算 =====
function computeBloomScatter(self, baseTargets) {
  const count = self.count;
  const scatter = new Float32Array(count * 3);
  const cfg = EXPLOSION_CONFIG;
  const seeds = self.seeds;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;
    const bx = baseTargets[idx];
    const by = baseTargets[idx + 1];
    const bz = baseTargets[idx + 2];

    const dist = Math.sqrt(bx * bx + by * by + bz * bz) + 0.01;
    const nx = bx / dist;
    const ny = by / dist;
    const nz = bz / dist;

    const seedD = seeds[i * 4 + 3];
    const expansion = cfg.expansionMin + seedD * (cfg.expansionMax - cfg.expansionMin);
    const spiralAngle = (i / count) * Math.PI * 2 * cfg.spiralArms;
    const spiralX = Math.cos(spiralAngle) * cfg.spiralStrength;
    const spiralY = Math.sin(spiralAngle) * cfg.spiralStrength;

    scatter[idx] = bx + nx * expansion + spiralX;
    scatter[idx + 1] = by + ny * expansion + spiralY;
    scatter[idx + 2] = bz + nz * expansion * 0.6;
  }
  return scatter;
}

// ===== bloom 连续散开动画（跟随手掌开合度） =====
function updateExplosionTargets(self, time, pointer) {
  const base = self.bloomBaseTargets;
  const scatter = self.bloomScatterTargets;
  if (!base || !scatter) return;

  const openness = self.bloomOpenness;
  const targets = self.activeTargets;
  const count = self.count;
  const seeds = self.seeds;
  const cfg = CENTER_HEART_CONFIG;
  const coreCount = Math.floor(count * cfg.coreRatio);
  const coreScale = cfg.coreScale;

  for (let i = 0; i < count; i++) {
    const idx = i * 3;

    if (i < coreCount && openness > 0.05) {
      const ox = pointer.isActive ? pointer.world.x : 0;
      const oy = pointer.isActive ? pointer.world.y : 0;
      const pulse = 1 + Math.sin(time * cfg.pulseSpeed + seeds[i * 4 + 3]) * cfg.pulseAmp;
      const s = coreScale * pulse;
      targets[idx] = base[idx] * s + ox;
      targets[idx + 1] = base[idx + 1] * s + oy;
      targets[idx + 2] = base[idx + 2] * s;
    } else {
      targets[idx] = base[idx] + (scatter[idx] - base[idx]) * openness;
      targets[idx + 1] = base[idx + 1] + (scatter[idx + 1] - base[idx + 1]) * openness;
      targets[idx + 2] = base[idx + 2] + (scatter[idx + 2] - base[idx + 2]) * openness;
    }
  }
}

// ===== 流场函数 =====

function flowFree(self, i, px, py, pz, time) {
  const si = i * 4;
  const seedA = self.seeds[si];
  const seedC = self.seeds[si + 2];
  const flow = Math.sin(time * 0.12 + px * 0.42 + seedA) * 0.0008;
  self.velocities[i * 3] += Math.cos(seedC + time * 0.08) * flow;
  self.velocities[i * 3 + 1] += Math.sin(seedA + time * 0.09) * flow;
}

function flowFishSchool(self, i, px, py, pz, time) {
  const si = i * 4;
  const seedA = self.seeds[si];
  const seedB = self.seeds[si + 1];
  const seedC = self.seeds[si + 2];
  const drift = Math.sin(time * 0.15 + px * 0.28 + seedA) * 0.0016;
  self.velocities[i * 3] += Math.cos(seedC + time * 0.10) * drift;
  self.velocities[i * 3 + 1] += Math.sin(seedA + time * 0.11) * drift;
  self.velocities[i * 3 + 2] += Math.cos(seedB + time * 0.08) * drift * 0.35;
}

function flowCompactHeart(self, i, px, py, pz, time) {
  const si = i * 4;
  const seedA = self.seeds[si];
  const seedB = self.seeds[si + 1];
  const seedC = self.seeds[si + 2];
  const flicker = Math.sin(time * 2.2 + self.seeds[si + 3] * 2.5) * 0.0005;
  self.velocities[i * 3] += Math.cos(seedA + time * 0.7) * flicker;
  self.velocities[i * 3 + 1] += Math.sin(seedC + time * 0.8) * flicker;
  self.velocities[i * 3 + 2] += Math.cos(seedB + time * 0.6) * flicker;
}

function flowBaitBall(self, i, px, py, pz, time) {
  const si = i * 4;
  const seedA = self.seeds[si];
  const seedC = self.seeds[si + 2];
  const swirl = Math.sin(time * 0.9 + seedA) * 0.0004;
  self.velocities[i * 3] += Math.cos(seedC + time * 0.7) * swirl;
  self.velocities[i * 3 + 1] += Math.sin(seedA + time * 0.8) * swirl;
  self.velocities[i * 3 + 2] += Math.cos(seedC + time * 0.5) * swirl * 0.3;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
