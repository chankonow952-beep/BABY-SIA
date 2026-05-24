export function createTextTargets({ count, text, width, height }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const scale = 2;
  canvas.width = 1600 * scale;
  canvas.height = 440 * scale;

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 228px "KaiTi", "楷体", "STKaiti", "Kai", serif';
  ctx.fillText(text, 800, 222);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples = [];
  const step = 7;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = imageData[(y * canvas.width + x) * 4 + 3];
      if (alpha > 40) {
        const nx = x / canvas.width - 0.5;
        const ny = 0.5 - y / canvas.height;
        samples.push({
          x: nx * width,
          y: ny * height,
          z: (Math.random() - 0.5) * 0.34,
        });
      }
    }
  }

  return fillTargetsFromSamples(samples, count, 0.018);
}

function fillTargetsFromSamples(samples, count, jitter) {
  const targets = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const sample = samples[Math.floor(Math.random() * samples.length)];
    const index = i * 3;
    targets[index] = sample.x + (Math.random() - 0.5) * jitter;
    targets[index + 1] = sample.y + (Math.random() - 0.5) * jitter;
    targets[index + 2] = sample.z + (Math.random() - 0.5) * jitter * 6;
  }

  return targets;
}
