import * as THREE from 'three';

export class CameraBackground {
  constructor(scene, video) {
    this.scene = scene;
    this.video = video;
    this.mesh = null;
    this.texture = null;

    if (!video) return;

    this.texture = new THREE.VideoTexture(video);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.PlaneGeometry(40, 24);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: this.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTexture;
        void main() {
          vec4 color = texture2D(uTexture, vUv);
          // 压低亮度 70%，保持暗调氛围，粒子可见
          float darken = 0.30;
          vec3 darkened = color.rgb * darken;
          // 极淡暖色 tint
          darkened = mix(darkened, vec3(0.04, 0.02, 0.03), 0.12);
          gl_FragColor = vec4(darkened, 1.0);
        }
      `,
      depthTest: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = -999;
    this.mesh.position.z = -5.5;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  update() {
    // VideoTexture 自动更新，无需手动操作
  }

  setVideo(video) {
    if (this.texture) {
      this.texture.dispose();
    }
    this.video = video;
    if (video && this.mesh) {
      this.texture = new THREE.VideoTexture(video);
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.mesh.material.uniforms.uTexture.value = this.texture;
    }
  }

  dispose() {
    if (this.texture) {
      this.texture.dispose();
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.scene.remove(this.mesh);
    }
  }
}
