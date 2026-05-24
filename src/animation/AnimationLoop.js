import * as THREE from 'three';

export class AnimationLoop {
  constructor({ update, render }) {
    this.update = update;
    this.render = render;
    this.clock = new THREE.Clock();
    this.frameId = null;
    this._running = false;
    this.tick = this.tick.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this.tick();
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  stop() {
    this._running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    document.removeEventListener('visibilitychange', this._onVisibility);
  }

  _onVisibility() {
    if (document.hidden) {
      // 标签页隐藏：暂停 rAF，释放 GPU 资源
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
    } else {
      // 标签页可见：恢复渲染循环
      if (this._running && !this.frameId) {
        // 重置 delta 避免切回时大跳帧
        this.clock.getDelta();
        this.tick();
      }
    }
  }

  tick() {
    const delta = Math.min(this.clock.getDelta(), 0.033);
    const time = this.clock.elapsedTime;

    this.update(time, delta);
    this.render();
    this.frameId = requestAnimationFrame(this.tick);
  }
}
