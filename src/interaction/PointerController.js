import * as THREE from 'three';
import { PARTICLE_CONFIG } from '../config.js';

export class PointerController {
  constructor(canvas, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.ndc = new THREE.Vector2(10, 10);
    this.world = new THREE.Vector3(999, 999, 0);
    this.previousWorld = new THREE.Vector3(999, 999, 0);
    this.velocity = new THREE.Vector2();
    this.hasWorld = false;
    this.isActive = false;
    this.targetStrength = 0;
    this.strength = 0;
    this.isDown = false;
    this.radius = PARTICLE_CONFIG.pointerRadius;
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    // 手势 NDC 平滑：手势检测帧率低（~20Hz），lerp 避免跳变
    this._gestureActive = false;
    this._gestureTarget = new THREE.Vector2();

    this.bind();
  }

  bind() {
    const move = (clientX, clientY) => {
      const rect = this.canvas.getBoundingClientRect();
      this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.ndc.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
      this._gestureActive = false;
      this.isActive = true;
      this.targetStrength = 1;
    };

    this.canvas.addEventListener('pointermove', (event) => {
      move(event.clientX, event.clientY);
    });

    this.canvas.addEventListener('pointerdown', (event) => {
      this.canvas.setPointerCapture?.(event.pointerId);
      move(event.clientX, event.clientY);
      this.isDown = true;
      this.targetStrength = 0.9;
    });

    this.canvas.addEventListener('pointerup', () => {
      this.isDown = false;
      this.targetStrength = 0.22;
    });

    this.canvas.addEventListener('pointerleave', () => {
      this.isDown = false;
      this.targetStrength = 0;
      this.ndc.set(10, 10);
      this.hasWorld = false;
      this.isActive = false;
      this.velocity.set(0, 0);
    });

    this.canvas.addEventListener(
      'touchmove',
      (event) => {
        const touch = event.touches[0];
        if (touch) {
          move(touch.clientX, touch.clientY);
        }
      },
      { passive: true },
    );
  }

  setGestureNdc(ndc) {
    if (!ndc) return;
    if (!this._gestureActive) {
      this.ndc.set(ndc.x, ndc.y);
    }
    this._gestureTarget.set(ndc.x, ndc.y);
    this._gestureActive = true;
    this.isActive = true;
    this.targetStrength = 0.9;
  }

  resize() {
    this.ndc.set(10, 10);
    this.world.set(999, 999, 0);
    this.previousWorld.copy(this.world);
    this.velocity.set(0, 0);
    this.hasWorld = false;
    this.isActive = false;
  }

  update(delta) {
    this.strength += (this.targetStrength - this.strength) * Math.min(1, delta * 6);
    this.targetStrength *= this.isDown ? 0.998 : 0.988;

    // 手势 NDC 平滑：低帧率手势输入 → 逐帧 lerp 消除跳变
    if (this._gestureActive) {
      const s = Math.min(1, delta * 18);
      this.ndc.lerp(this._gestureTarget, s);
    }

    if (!this.isActive) {
      this.world.set(999, 999, 0);
      this.previousWorld.copy(this.world);
      this.velocity.multiplyScalar(0.8);
      return;
    }

    this.raycaster.setFromCamera(this.ndc, this.camera);
    this.previousWorld.copy(this.world);

    if (this.raycaster.ray.intersectPlane(this.plane, this.world)) {
      if (!this.hasWorld) {
        this.previousWorld.copy(this.world);
        this.hasWorld = true;
      }

      const invDelta = 1 / Math.max(delta, 0.016);
      this.velocity.x +=
        (this.world.x - this.previousWorld.x) * invDelta * 0.08 - this.velocity.x * 0.22;
      this.velocity.y +=
        (this.world.y - this.previousWorld.y) * invDelta * 0.08 - this.velocity.y * 0.22;
    }
  }
}
