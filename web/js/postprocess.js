// Pure helpers for YOLO11 ONNX output. No DOM, so they run in Node tests too.

/** Letterbox geometry used both for preprocessing and for mapping boxes back. */
export function letterboxParams(srcW, srcH, size = 640) {
  const scale = Math.min(size / srcW, size / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return { size, scale, w, h, padX: Math.floor((size - w) / 2), padY: Math.floor((size - h) / 2) };
}

export function iou(a, b) {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = (a[2] - a[0]) * (a[3] - a[1]);
  const areaB = (b[2] - b[0]) * (b[3] - b[1]);
  const union = areaA + areaB - inter;
  return union > 0 ? inter / union : 0;
}

/** Class-wise non-max suppression. Returns kept detections sorted by score. */
export function nms(dets, iouThreshold = 0.45) {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept = [];
  for (const d of sorted) {
    if (!kept.some((k) => k.cls === d.cls && iou(k.box, d.box) > iouThreshold)) kept.push(d);
  }
  return kept;
}

/**
 * Decode raw output [1, 4 + numClasses, numAnchors] (row-major Float32Array).
 * Rows 0-3 are cx, cy, w, h in letterboxed pixels; the rest are class scores.
 */
export function decode(data, { numClasses, numAnchors, names, lb, srcW, srcH, conf = 0.35, iouThreshold = 0.45 }) {
  const A = numAnchors;
  const dets = [];
  for (let a = 0; a < A; a++) {
    let best = -1;
    let score = conf;
    for (let c = 0; c < numClasses; c++) {
      const s = data[(4 + c) * A + a];
      if (s >= score) {
        score = s;
        best = c;
      }
    }
    if (best < 0) continue;

    const cx = data[a];
    const cy = data[A + a];
    const w = data[2 * A + a];
    const h = data[3 * A + a];
    const x1 = Math.min(srcW, Math.max(0, (cx - w / 2 - lb.padX) / lb.scale));
    const y1 = Math.min(srcH, Math.max(0, (cy - h / 2 - lb.padY) / lb.scale));
    const x2 = Math.min(srcW, Math.max(0, (cx + w / 2 - lb.padX) / lb.scale));
    const y2 = Math.min(srcH, Math.max(0, (cy + h / 2 - lb.padY) / lb.scale));
    if (x2 - x1 < 1 || y2 - y1 < 1) continue;

    dets.push({ cls: best, name: names[best], score, box: [x1, y1, x2, y2] });
  }
  return nms(dets, iouThreshold);
}
