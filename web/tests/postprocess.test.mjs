import test from 'node:test';
import assert from 'node:assert/strict';
import { letterboxParams, iou, nms, decode, classThresholds } from '../js/postprocess.js';

test('letterbox: landscape image pads top and bottom', () => {
  const lb = letterboxParams(1280, 640, 640);
  assert.equal(lb.scale, 0.5);
  assert.equal(lb.w, 640);
  assert.equal(lb.h, 320);
  assert.equal(lb.padX, 0);
  assert.equal(lb.padY, 160);
});

test('iou of identical and disjoint boxes', () => {
  assert.equal(iou([0, 0, 10, 10], [0, 0, 10, 10]), 1);
  assert.equal(iou([0, 0, 10, 10], [20, 20, 30, 30]), 0);
});

test('nms keeps best overlapping box per class, keeps other classes', () => {
  const kept = nms([
    { cls: 0, score: 0.6, box: [0, 0, 10, 10] },
    { cls: 0, score: 0.9, box: [1, 1, 11, 11] },
    { cls: 1, score: 0.5, box: [0, 0, 10, 10] },
  ], 0.45);
  assert.equal(kept.length, 2);
  assert.equal(kept[0].score, 0.9);
  assert.equal(kept[1].cls, 1);
});

function makeOutput(numClasses, anchors) {
  const A = anchors.length;
  const data = new Float32Array((4 + numClasses) * A);
  anchors.forEach((an, a) => {
    data[a] = an.cx;
    data[A + a] = an.cy;
    data[2 * A + a] = an.w;
    data[3 * A + a] = an.h;
    data[(4 + an.cls) * A + a] = an.score;
  });
  return { data, A };
}

test('decode maps letterboxed box back to source pixels and filters by conf', () => {
  const names = ['helmet', 'no_helmet'];
  const lb = letterboxParams(1280, 640, 640); // scale .5, padY 160
  const { data, A } = makeOutput(2, [
    { cx: 320, cy: 320, w: 100, h: 50, cls: 1, score: 0.8 },
    { cx: 100, cy: 200, w: 20, h: 20, cls: 0, score: 0.1 },
  ]);
  const dets = decode(data, { numClasses: 2, numAnchors: A, names, lb, srcW: 1280, srcH: 640, conf: 0.35 });
  assert.equal(dets.length, 1);
  assert.equal(dets[0].name, 'no_helmet');
  assert.deepEqual(dets[0].box.map((v) => Math.round(v)), [540, 270, 740, 370]);
});

test('classThresholds: per-class base, fallback, offset and clamping', () => {
  const t = classThresholds(['helmet', 'no_helmet', 'Person'], { helmet: 0.5, no_helmet: 0.1 });
  assert.deepEqual(t, [0.5, 0.1, 0.35]);
  const more = classThresholds(['helmet', 'no_helmet'], { helmet: 0.5, no_helmet: 0.1 }, 0.1);
  assert.deepEqual(more.map((v) => +v.toFixed(2)), [0.4, 0.05]); // clamped at 0.05
  const less = classThresholds(['helmet'], { helmet: 0.9 }, -0.2);
  assert.deepEqual(less, [0.95]); // clamped at 0.95
});

test('decode applies per-class thresholds instead of a single conf', () => {
  const names = ['helmet', 'no_helmet'];
  const lb = letterboxParams(640, 640, 640);
  const { data, A } = makeOutput(2, [
    { cx: 100, cy: 100, w: 20, h: 20, cls: 1, score: 0.15 }, // violation, low score
    { cx: 300, cy: 300, w: 20, h: 20, cls: 0, score: 0.45 }, // helmet below its 0.5 threshold
  ]);
  const opts = { numClasses: 2, numAnchors: A, names, lb, srcW: 640, srcH: 640 };
  // single conf 0.35: keeps the helmet, misses the low-score violation
  assert.deepEqual(decode(data, { ...opts, conf: 0.35 }).map((d) => d.name), ['helmet']);
  // per-class: helmet needs 0.5, violation only 0.1
  const dets = decode(data, { ...opts, thresholds: [0.5, 0.1] });
  assert.deepEqual(dets.map((d) => d.name), ['no_helmet']);
});

test('decode clamps boxes to image bounds', () => {
  const lb = letterboxParams(640, 640, 640);
  const { data, A } = makeOutput(1, [{ cx: 5, cy: 5, w: 40, h: 40, cls: 0, score: 0.9 }]);
  const [d] = decode(data, { numClasses: 1, numAnchors: A, names: ['Person'], lb, srcW: 640, srcH: 640 });
  assert.deepEqual(d.box, [0, 0, 25, 25]);
});
