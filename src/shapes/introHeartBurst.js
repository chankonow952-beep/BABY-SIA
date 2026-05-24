import * as THREE from 'three';
import { INTRO_BURST_CONFIG } from '../config.js';

const vertexShader = `
  attribute float aSize;
  attribute float aSeed;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uTime;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float depthScale = 1.0 / max(0.18, -mvPosition.z * 0.06);
    gl_PointSize = aSize * depthScale * 7.5;
    gl_Position = projectionMatrix * mvPosition;

    float flicker = sin(uTime * (9.0 + aSeed * 26.0) + aSeed * 6.283);
    vAlpha = (0.15 + 0.85 * abs(flicker)) * (0.40 + aSeed * 0.60);
    vColor = vec3(1.0, 0.48, 0.72);
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    float core = smoothstep(0.46, 0.0, radius);
    float glow = smoothstep(0.60, 0.22, radius) * 0.18;
    float alpha = (core + glow) * vAlpha;
    if (alpha < 0.004) discard;
    vec3 tint = mix(vColor, vec3(1.0, 0.82, 0.90), 0.22);
    gl_FragColor = vec4(tint * 0.95, alpha);
  }
`;

function sampleHeartFill(hScale) {
  const SF = 0.018;
  for (let attempt = 0; attempt < 60; attempt++) {
    const x = Math.random() * 2.8 - 1.4;
    const y = Math.random() * 2.6 - 1.35;
    const val = (x * x + y * y - 1) ** 3 - x * x * y * y * y;
    if (val <= 0) {
      return { x: x * hScale * 0.24, y: -y * hScale * 0.24 };
    }
  }
  const t = Math.random() * Math.PI * 2;
  return {
    x: 16 * Math.sin(t) ** 3 * SF * hScale,
    y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * SF * hScale,
  };
}

export class IntroHeartBurst {
  constructor(scene, heartCount) {
    const cfg = INTRO_BURST_CONFIG;
    const hc = heartCount || cfg.heartCount;
    const particlesPerHeart = cfg.particlesPerHeart;
    const total = hc * particlesPerHeart;
    const positions = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const seeds = new Float32Array(total);

    this.localOffsets = new Float32Array(total * 3);
    this.heartData = [];
    this.heartCount = hc;
    this.particlesPerHeart = particlesPerHeart;
    this.orbitRadius = cfg.orbitRadius;
    this.orbitSpeed = cfg.orbitSpeed;

    for (let h = 0; h < hc; h++) {
      const baseAngle = (h / hc) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const radius = this.orbitRadius + (Math.random() - 0.5) * 2.2;
      const yOffset = (Math.random() - 0.5) * 1.8;

      this.heartData.push({ baseAngle, radius, yOffset });

      const cx = Math.cos(baseAngle) * radius;
      const cy = yOffset;
      const cz = Math.sin(baseAngle) * radius;
      const hScale = cfg.heartScaleMin + Math.random() * (cfg.heartScaleMax - cfg.heartScaleMin);

      for (let p = 0; p < particlesPerHeart; p++) {
        const idx = (h * particlesPerHeart + p) * 3;
        const fill = sampleHeartFill(hScale);

        this.localOffsets[idx] = fill.x + (Math.random() - 0.5) * 0.03;
        this.localOffsets[idx + 1] = fill.y + (Math.random() - 0.5) * 0.03;
        this.localOffsets[idx + 2] = (Math.random() - 0.5) * 0.10;

        positions[idx] = cx + this.localOffsets[idx];
        positions[idx + 1] = cy + this.localOffsets[idx + 1];
        positions[idx + 2] = cz + this.localOffsets[idx + 2];

        sizes[h * particlesPerHeart + p] = 0.15 + Math.random() * 0.38;
        seeds[h * particlesPerHeart + p] = Math.random();
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, this.material);
    this.points.visible = false;
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(time) {
    this.material.uniforms.uTime.value = time;

    const posArr = this.points.geometry.attributes.position.array;
    const angle = time * this.orbitSpeed;

    for (let h = 0; h < this.heartCount; h++) {
      const hd = this.heartData[h];
      const a = hd.baseAngle + angle;
      const cx = Math.cos(a) * hd.radius;
      const cz = Math.sin(a) * hd.radius;
      const cy = hd.yOffset;

      for (let p = 0; p < this.particlesPerHeart; p++) {
        const idx = (h * this.particlesPerHeart + p) * 3;
        posArr[idx] = cx + this.localOffsets[idx];
        posArr[idx + 1] = cy + this.localOffsets[idx + 1];
        posArr[idx + 2] = cz + this.localOffsets[idx + 2];
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  setVisible(v) {
    this.points.visible = v;
  }
}
