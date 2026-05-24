import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { VISUAL_CONFIG, PERF_TIER } from '../config.js';

export function createScene(canvas, options = {}) {
  const tier = PERF_TIER[options.performanceTier] || PERF_TIER.medium;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0610, 0.034);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    120,
  );
  camera.position.set(0, 0, VISUAL_CONFIG.cameraZ);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x0a0608, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let composer = null;
  let bloomPass = null;

  if (tier.useComposer) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));

    if (tier.useBloom) {
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        VISUAL_CONFIG.bloomStrength,
        VISUAL_CONFIG.bloomRadius,
        VISUAL_CONFIG.bloomThreshold,
      );
      composer.addPass(bloomPass);
    }
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier.pixelRatio));
    renderer.setSize(width, height);
    if (composer) {
      composer.setSize(width, height);
    }
  }

  function update(time) {
    const driftX = Math.sin(time * 0.12) * 0.28;
    const driftY = Math.cos(time * 0.10) * 0.16;
    const driftZ = 10.5 + Math.sin(time * 0.08) * 0.35;
    camera.position.x = driftX;
    camera.position.y = driftY;
    camera.position.z = driftZ;
    camera.lookAt(0, 0, 0);
  }

  function render() {
    if (composer) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  return {
    scene,
    camera,
    renderer,
    composer,
    bloomPass,
    resize,
    update,
    render,
  };
}
