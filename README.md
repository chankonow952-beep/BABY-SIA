# DITTO Particle Installation

一个从零搭建的 Vite + vanilla JavaScript + Three.js 粒子互动网页。整体风格偏黑色科技艺术装置：10000 个发光粒子在自由漂浮、文字聚合和图案聚合之间平滑过渡，并支持鼠标与触摸互动。

## 运行

```bash
npm install
npm run dev
```

打开终端中显示的本地地址即可预览。

Windows PowerShell 如果提示 `npm.ps1` 被执行策略拦截，可以改用：

```bash
npm.cmd install
npm.cmd run dev
```

生产构建：

```bash
npm run build
```

## 交互

- 点击右上角 `Float`、`Text`、`Symbol` 切换状态
- 键盘 `1`、`2`、`3` 也可以切换状态
- 鼠标或触摸在画面中移动会轻微推开粒子

## 项目结构

```text
src/
  animation/
    AnimationLoop.js       # requestAnimationFrame 主循环
  interaction/
    PointerController.js   # 鼠标/触摸输入，后续可替换或接入 MediaPipe Hands
  particles/
    ParticleSystem.js      # 粒子几何、shader、状态缓动、互动受力
  scene/
    createScene.js         # Three.js 场景、相机、Bloom 后处理
  shapes/
    createShapeTargets.js  # 聚合目标入口
    textShape.js           # Canvas 文字采样
    symbolShape.js         # 爱心/星星图案采样
  config.js                # 粒子数量、速度、镜头、Bloom 等参数
  main.js                  # 应用入口和 UI 绑定
  styles.css               # 页面样式
```

## 修改文字

编辑 `src/shapes/createShapeTargets.js`：

```js
text: createTextTargets({
  count,
  text: 'DITTO',
  width: 8.3,
  height: 2.9,
}),
```

把 `text` 改成想要的内容即可。字越长，建议适当增大 `width` 或减小 `src/shapes/textShape.js` 里的字体大小。

## 修改图案

同样编辑 `src/shapes/createShapeTargets.js`：

```js
symbol: createSymbolTargets({
  count,
  type: 'heart',
  width: 4.6,
  height: 4.0,
}),
```

`type` 可改为：

- `heart`
- `star`

如果要增加新图案，可以在 `src/shapes/symbolShape.js` 中新增采样函数，然后在 `createSymbolTargets` 里分发到新函数。

## 调整粒子数量和手感

编辑 `src/config.js`：

```js
export const PARTICLE_CONFIG = {
  count: 10000,
  morph: {
    free: 0.018,
    text: 0.045,
    symbol: 0.04,
  },
  pointerRadius: 1.35,
  pointerForce: 0.018,
};
```

- `count` 建议保持在 `8000-12000`
- `morph` 越大，聚合越快
- `pointerRadius` 控制互动影响范围
- `pointerForce` 控制鼠标/触摸推力

## 后续接入 MediaPipe Hands

当前粒子系统只依赖 `PointerController` 暴露的三个字段：

```js
pointer.world     // THREE.Vector3，手势映射到 z=0 平面的世界坐标
pointer.strength  // 互动强度
pointer.radius    // 互动半径
```

接 MediaPipe Hands 时，可以保留 `ParticleSystem.update(time, delta, pointer)` 不变，只需要写一个新的 hand controller，把手掌中心或食指指尖坐标转换成 Three.js 世界坐标，并输出同样的字段即可。
