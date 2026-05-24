export function createSymbolTargets({ count, type = 'heart', width, height }) {
  const samples = type === 'star' ? createStarSamples(width, height) : createHeartSamples(width, height);
  const targets = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const sample = samples[Math.floor(Math.random() * samples.length)];
    const index = i * 3;

    targets[index] = sample.x + (Math.random() - 0.5) * 0.025;
    targets[index + 1] = sample.y + (Math.random() - 0.5) * 0.025;
    targets[index + 2] = (Math.random() - 0.5) * 0.42;
  }

  return targets;
}

function createHeartSamples(width, height) {
  const samples = [];
  const outline = [];

  for (let i = 0; i < 1800; i += 1) {
    const t = (i / 1800) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);

    outline.push({
      x: (x / 18) * width * 0.5,
      y: ((y - 2.5) / 18) * height * 0.5,
    });
  }

  for (let i = 0; i < 6200; i += 1) {
    const x = Math.random() * 2.8 - 1.4;
    const y = Math.random() * 2.6 - 1.35;
    const heart = (x * x + y * y - 1) ** 3 - x * x * y ** 3;

    if (heart <= 0) {
      samples.push({
        x: x * width * 0.5,
        y: -y * height * 0.5,
      });
    }
  }

  samples.push(...outline);
  return samples;
}

function createStarSamples(width, height) {
  const vertices = [];
  const points = 5;

  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? 1 : 0.43;
    vertices.push({
      x: Math.cos(angle) * radius * width * 0.5,
      y: Math.sin(angle) * radius * height * 0.5,
    });
  }

  const outline = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    for (let j = 0; j < 160; j += 1) {
      const t = j / 160;
      outline.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      });
    }
  }

  const samples = [...outline];
  for (let i = 0; i < 4600; i += 1) {
    const x = (Math.random() - 0.5) * width;
    const y = (Math.random() - 0.5) * height;

    if (isInsidePolygon({ x, y }, vertices)) {
      samples.push({ x, y });
    }
  }

  return samples;
}

function isInsidePolygon(point, polygon) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}
