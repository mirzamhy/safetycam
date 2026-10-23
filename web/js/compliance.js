import { classInfo } from './labels.js';

function group(counts, kind) {
  return Object.entries(counts)
    .filter(([name]) => classInfo(name).kind === kind)
    .map(([name, count]) => ({ name, label: classInfo(name).label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Per-image compliance verdict.
 * VIOLATION: any no_* class detected.
 * SAFE: no violation, and at least one worker or PPE item detected.
 * NO_WORKER: nothing relevant detected.
 */
export function assess(detections) {
  const counts = {};
  for (const d of detections) counts[d.name] = (counts[d.name] ?? 0) + 1;

  const violations = group(counts, 'violation');
  const ppe = group(counts, 'ppe');
  const workers = counts.Person ?? 0;

  let status = 'NO_WORKER';
  if (violations.length) status = 'VIOLATION';
  else if (workers || ppe.length) status = 'SAFE';

  const violationTotal = violations.reduce((s, v) => s + v.count, 0);
  return { status, workers, violations, violationTotal, ppe, counts };
}

export function summaryText(result) {
  if (result.status === 'VIOLATION') {
    return result.violations.map((v) => `${v.count} ${v.label.toLowerCase()}`).join(', ');
  }
  if (result.status === 'SAFE') {
    return result.workers
      ? `${result.workers} pekerja terdeteksi, tidak ada APD yang kurang.`
      : 'APD terdeteksi, tidak ada pelanggaran.';
  }
  return 'Tidak ada pekerja atau APD yang terdeteksi.';
}
