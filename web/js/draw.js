import { classInfo } from './labels.js';

// Box colors mirror the CSS tokens: hi-vis = PPE worn, red = PPE missing.
const COLORS = {
  ppe: { stroke: '#B6F23A', fill: '#B6F23A', text: '#0B0B0C' },
  violation: { stroke: '#FF3340', fill: '#D91C27', text: '#FFFFFF' },
  person: { stroke: '#F3F3F1', fill: '#F3F3F1', text: '#0B0B0C' },
  other: { stroke: '#8D8D94', fill: '#8D8D94', text: '#0B0B0C' },
};

/** Draw detections on a canvas whose pixel size equals the source image size. */
export function drawDetections(ctx, detections, { showPerson = true } = {}) {
  const { width: W, height: H } = ctx.canvas;
  const unit = Math.max(1, Math.min(W, H) / 400);
  const fontSize = Math.round(Math.max(11, 12 * unit));
  ctx.lineWidth = Math.max(2, 2 * unit);
  ctx.font = `600 ${fontSize}px "Barlow", system-ui, sans-serif`;
  ctx.textBaseline = 'top';

  // Person boxes first so gear boxes sit on top.
  const isPerson = (d) => classInfo(d.name).kind === 'person';
  const ordered = [...detections.filter(isPerson), ...detections.filter((d) => !isPerson(d))];

  for (const d of ordered) {
    const info = classInfo(d.name);
    if (info.kind === 'person' && !showPerson) continue;
    const c = COLORS[info.kind] ?? COLORS.other;
    const [x1, y1, x2, y2] = d.box;

    ctx.strokeStyle = c.stroke;
    ctx.setLineDash(info.kind === 'person' ? [6 * unit, 4 * unit] : []);
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.setLineDash([]);

    const text = `${info.label} ${Math.round(d.score * 100)}%`;
    const padX = 5 * unit;
    const tagH = fontSize + 6 * unit;
    const tagW = ctx.measureText(text).width + padX * 2;
    const tagY = y1 - tagH >= 0 ? y1 - tagH : y1;
    const tagX = Math.min(Math.max(0, x1 - ctx.lineWidth / 2), W - tagW);
    ctx.fillStyle = c.fill;
    ctx.fillRect(tagX, tagY, tagW, tagH);
    ctx.fillStyle = c.text;
    ctx.fillText(text, tagX + padX, tagY + 3 * unit);
  }
}
