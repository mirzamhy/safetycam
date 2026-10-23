// Display names (Bahasa Indonesia) and role of each model class.
// kind: 'ppe' = gear worn, 'violation' = gear missing, 'person', 'other'.
export const CLASS_INFO = {
  helmet: { label: 'Helm', kind: 'ppe' },
  gloves: { label: 'Sarung tangan', kind: 'ppe' },
  vest: { label: 'Rompi', kind: 'ppe' },
  boots: { label: 'Sepatu safety', kind: 'ppe' },
  goggles: { label: 'Kacamata', kind: 'ppe' },
  // Dataset has no no_vest class; "none" boxes mark a torso without a vest.
  none: { label: 'Tanpa rompi', kind: 'violation' },
  Person: { label: 'Pekerja', kind: 'person' },
  no_helmet: { label: 'Tanpa helm', kind: 'violation' },
  no_goggle: { label: 'Tanpa kacamata', kind: 'violation' },
  no_gloves: { label: 'Tanpa sarung tangan', kind: 'violation' },
  no_boots: { label: 'Tanpa sepatu safety', kind: 'violation' },
};

export function classInfo(name) {
  return CLASS_INFO[name] ?? { label: name, kind: name.startsWith('no_') ? 'violation' : 'other' };
}
