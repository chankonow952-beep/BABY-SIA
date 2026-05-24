import * as THREE from 'three';
import { SHAPE_CONFIG } from '../config.js';

const orbitVertexShader = `
  attribute float aSize;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float depthScale = 1.0 / max(0.18, -mvPosition.z * 0.08);
    gl_PointSize = aSize * depthScale * 6.5;
    gl_Position = projectionMatrix * mvPosition;
    vAlpha = 0.72;
    vColor = vec3(1.0, 0.72, 0.80);
  }
`;

const orbitFragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 point = gl_PointCoord - vec2(0.5);
    float radius = length(point);
    float core = smoothstep(0.45, 0.0, radius);
    float glow = smoothstep(0.60, 0.22, radius) * 0.14;
    float alpha = (core + glow) * vAlpha;

    if (alpha < 0.005) discard;

    vec3 tinted = mix(vColor, vec3(1.0, 0.88, 0.92), 0.30);
    gl_FragColor = vec4(tinted * 0.95, alpha);
  }
`;

function heartOutline(particleCount) {
  const positions = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  for (let i = 0; i < particleCount; i++) {
    const t = (i / particleCount) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    const s = 0.018;
    positions[i * 3] = x * s;
    positions[i * 3 + 1] = y * s;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
    sizes[i] = 0.30 + Math.random() * 0.55;
  }
  return { positions, sizes };
}

export class OrbitingHearts {
  constructor(scene) {
    this.scene = scene;
    this.hearts = [];
    this.visible = false;
    this.meshGroup = new THREE.Group();
    scene.add(this.meshGroup);

    const cfg = SHAPE_CONFIG.orbitHeart;

    for (let i = 0; i < cfg.count; i++) {
      const { positions, sizes } = heartOutline(cfg.particleCount);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute(
        'aSize',
        new THREE.BufferAttribute(sizes, 1),
      );

      const material = new THREE.ShaderMaterial({
        vertexShader: orbitVertexShader,
        fragmentShader: orbitFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geometry, material);
      points.visible = false;
      this.meshGroup.add(points);

      this.hearts.push({
        points,
        angle: (i / cfg.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        radius: cfg.radius * (0.70 + Math.random() * 0.60),
        speed: cfg.speed * (0.60 + Math.random() * 0.8),
        yBase: (Math.random() - 0.5) * 1.5,
        bobAmp: 0.10 + Math.random() * 0.42,
        bobFreq: 0.30 + Math.random() * 0.60,
        tilt: (Math.random() - 0.5) * 0.7,
        scale: 0.75 + Math.random() * 0.50,
      });
    }
  }

  update(time, delta) {
    if (!this.visible) return;

    for (const h of this.hearts) {
      h.angle += h.speed * delta;
      const x = Math.cos(h.angle) * h.radius;
      const z = Math.sin(h.angle) * h.radius * 0.45;
      const y = h.yBase + Math.sin(time * h.bobFreq) * h.bobAmp;
      h.points.position.set(x, y, z);
      h.points.rotation.z += delta * 0.20;
      h.points.rotation.x = h.tilt;
      h.points.scale.setScalar(h.scale);
    }
  }

  setVisible(v) {
    if (this.visible === v) return;
    this.visible = v;
    for (const h of this.hearts) {
      h.points.visible = v;
    }
  }

  dispose() {
    for (const h of this.hearts) {
      h.points.geometry.dispose();
      h.points.material.dispose();
    }
    this.scene.remove(this.meshGroup);
  }
}
